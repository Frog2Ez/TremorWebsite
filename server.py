from flask import Flask, request, jsonify, render_template
from datetime import datetime, date, timedelta
import collections
import random
import sqlite3
from dummy_data import seed_dummy_data

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

seed_dummy_data()

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

    conn = sqlite3.connect("tremor.db")
    c = conn.cursor()

    c.execute("""
        SELECT sensor, magnitude, severity, detected, receivedAt
        FROM batches
        ORDER BY receivedAt DESC
        LIMIT ?
    """, (limit,))

    rows = c.fetchall()
    conn.close()

    batches = [{
        "sensor": r[0],
        "magnitude": r[1],
        "severity": r[2],
        "detected": bool(r[3]),
        "receivedAt": r[4]
    } for r in rows]

    return jsonify(list(reversed(batches)))


@app.route("/api/summary")
def get_summary():
    conn = sqlite3.connect("tremor.db")
    c = conn.cursor()

    # Total number of rows in DB
    c.execute("SELECT COUNT(*) FROM batches")
    total = c.fetchone()[0]

    # Count per severity
    c.execute("""
        SELECT severity, COUNT(*)
        FROM batches
        GROUP BY severity
    """)

    summary = {"none": 0, "mild": 0, "moderate": 0, "severe": 0}

    for severity, count in c.fetchall():
        if severity in summary:
            summary[severity] = count

    conn.close()

    return jsonify({
        "totalBatches": total,
        "summary": summary
    })


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