from flask import Flask, request, jsonify, render_template
from datetime import datetime, date, timedelta
import collections
import random
import sqlite3

app = Flask(__name__)

# ── Live session — in-memory store for current session
live_sessions = collections.deque(maxlen=1000)

# ── SQLite setup ──────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect("tremor.db")
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor TEXT,
            magnitude REAL,
            severity TEXT,
            detected INTEGER,
            receivedAt TEXT
        )
    """)

    conn.commit()
    conn.close()

init_db()

# ── Dummy data ────────────────────────────────────────────────────
# Generates realistic-looking tremor data for the past 5 days

def make_dummy_batch(sensor, severity, magnitude):
    return {
        "sensor":       sensor,
        "magnitude":    magnitude,
        "peakMagnitude": magnitude * 1.3,
        "severity":     severity,
        "detected":     severity != "none",
        "sampleCount":  50,
    }

def generate_dummy_day(date_str, profile):
    """profile is a list of (sensor, severity, magnitude, count) tuples"""
    batches = []
    base_time = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=9)
    for sensor, severity, magnitude, count in profile:
        for i in range(count):
            b = make_dummy_batch(sensor, severity, round(magnitude + random.uniform(-0.3, 0.3), 3))
            offset_mins = random.randint(0, 480)
            b["receivedAt"] = (base_time + timedelta(minutes=offset_mins)).isoformat()
            b["timestamp"]  = int((base_time + timedelta(minutes=offset_mins)).timestamp() * 1000)
            batches.append(b)
    random.shuffle(batches)
    return batches

today = date.today()

# Prepopulate dummy data into SQLite
for days_ago, profile in [
    (5, [
        ("GYROSCOPE",     "none",     0.7, 120),
        ("GYROSCOPE",     "mild",     2.0,  60),
        ("GYROSCOPE",     "moderate", 4.0,  40),
        ("GYROSCOPE",     "severe",   7.0,  20),
        ("ACCELEROMETER", "none",     0.8, 120),
        ("ACCELEROMETER", "mild",     2.2,  60),
        ("ACCELEROMETER", "moderate", 3.8,  40),
        ("ACCELEROMETER", "severe",   6.5,  20),
    ]),
    (4, [
        ("GYROSCOPE",     "none",     0.8,  30),
        ("GYROSCOPE",     "mild",     1.8,  10),
        ("ACCELEROMETER", "none",     0.9,  30),
        ("ACCELEROMETER", "mild",     2.0,   8),
    ]),
    (3, [
        ("GYROSCOPE",     "none",     0.6,  20),
        ("GYROSCOPE",     "mild",     2.1,  15),
        ("GYROSCOPE",     "moderate", 3.5,   8),
        ("ACCELEROMETER", "none",     0.7,  20),
        ("ACCELEROMETER", "moderate", 3.8,  10),
    ]),
    (2, [
        ("GYROSCOPE",     "none",     0.5,  40),
        ("GYROSCOPE",     "mild",     1.6,   5),
        ("ACCELEROMETER", "none",     0.6,  40),
        ("ACCELEROMETER", "mild",     1.9,   4),
    ]),
    (1, [
        ("GYROSCOPE",     "none",     0.7,  15),
        ("GYROSCOPE",     "mild",     2.0,  12),
        ("GYROSCOPE",     "moderate", 4.1,  10),
        ("GYROSCOPE",     "severe",   7.2,   6),
        ("ACCELEROMETER", "none",     0.8,  15),
        ("ACCELEROMETER", "moderate", 3.9,   8),
        ("ACCELEROMETER", "severe",   6.8,   5),
    ])
]:
    date_str = (today - timedelta(days=days_ago)).isoformat()
    batches = generate_dummy_day(date_str, profile)
    conn = sqlite3.connect("tremor.db")
    c = conn.cursor()
    for b in batches:
        c.execute("""
            INSERT INTO batches (sensor, magnitude, severity, detected, receivedAt)
            VALUES (?, ?, ?, ?, ?)
        """, (
            b["sensor"],
            b["magnitude"],
            b["severity"],
            int(b["detected"]),
            b["receivedAt"]
        ))
    conn.commit()
    conn.close()

# ── Live API ──────────────────────────────────────────────────────

@app.route("/data", methods=["POST"])
def receive_data():
    try:
        payload = request.get_json(force=True)
        payload["receivedAt"] = datetime.now().isoformat()
        live_sessions.append(payload)

        # 💾 Save to SQLite
        conn = sqlite3.connect("tremor.db")
        c = conn.cursor()
        c.execute("""
            INSERT INTO batches (sensor, magnitude, severity, detected, receivedAt)
            VALUES (?, ?, ?, ?, ?)
        """, (
            payload.get("sensor"),
            payload.get("magnitude"),
            payload.get("severity"),
            int(payload.get("detected", False)),
            payload.get("receivedAt")
        ))
        conn.commit()
        conn.close()

        print(f"[{payload['receivedAt']}] {payload.get('sensor')} | "
              f"severity={payload.get('severity')} | "
              f"magnitude={payload.get('magnitude', 0):.3f}")
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/batches")
def get_batches():
    limit = int(request.args.get("limit", 100))
    return jsonify(list(live_sessions)[-limit:])


@app.route("/api/summary")
def get_summary():
    summary = {"none": 0, "mild": 0, "moderate": 0, "severe": 0}
    for batch in live_sessions:
        sev = batch.get("severity", "none")
        if sev in summary:
            summary[sev] += 1
    return jsonify({"totalBatches": len(live_sessions), "summary": summary})


@app.route("/api/clear", methods=["POST"])
def clear_data():
    live_sessions.clear()
    return jsonify({"status": "cleared"})

# ── History API ───────────────────────────────────────────────────

@app.route("/api/history/dates")
def get_history_dates():
    """Returns list of dates that have data, with severity summary for each."""
    conn = sqlite3.connect("tremor.db")
    c = conn.cursor()

    c.execute("""
        SELECT substr(receivedAt,1,10) as date, severity
        FROM batches
    """)
    rows = c.fetchall()
    conn.close()

    grouped = {}
    for date_str, severity in rows:
        if date_str not in grouped:
            grouped[date_str] = {"none":0,"mild":0,"moderate":0,"severe":0}
        if severity in grouped[date_str]:
            grouped[date_str][severity] += 1

    result = []
    for date_str, summary in grouped.items():
        if summary["severe"] > 0:
            worst = "severe"
        elif summary["moderate"] > 0:
            worst = "moderate"
        elif summary["mild"] > 0:
            worst = "mild"
        else:
            worst = "none"
        result.append({
            "date": date_str,
            "total": sum(summary.values()),
            "summary": summary,
            "worst": worst
        })

    return jsonify(sorted(result, key=lambda x: x["date"]))


@app.route("/api/history/<date_str>")
def get_history_for_date(date_str):
    """Returns all batches for a specific date."""
    conn = sqlite3.connect("tremor.db")
    c = conn.cursor()

    c.execute("""
        SELECT sensor, magnitude, severity, detected, receivedAt
        FROM batches
        WHERE substr(receivedAt,1,10) = ?
    """, (date_str,))
    rows = c.fetchall()
    conn.close()

    batches = []
    summary = {"none":0,"mild":0,"moderate":0,"severe":0}
    for row in rows:
        b = {
            "sensor": row[0],
            "magnitude": row[1],
            "severity": row[2],
            "detected": bool(row[3]),
            "receivedAt": row[4]
        }
        batches.append(b)
        if b["severity"] in summary:
            summary[b["severity"]] += 1

    return jsonify({
        "date": date_str,
        "batches": batches,
        "summary": summary,
        "total": len(batches)
    })


# ── Dashboard ─────────────────────────────────────────────────────

@app.route("/")
def dashboard():
    return render_template("index.html")


if __name__ == "__main__":
    print("Tremor Tracker server running at http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)