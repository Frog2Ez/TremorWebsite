from flask import Flask, request, jsonify, render_template
from datetime import datetime
import collections

app = Flask(__name__)

# In-memory store — keeps last 1000 batches
sessions = collections.deque(maxlen=1000)

# ─── REST API ────────────────────────────────────────────────────────────────

@app.route("/data", methods=["POST"])
def receive_data():
    try:
        payload = request.get_json(force=True)
        payload["receivedAt"] = datetime.now().isoformat()
        sessions.append(payload)
        print(f"[{payload['receivedAt']}] {payload.get('sensor')} | "
              f"severity={payload.get('severity')} | "
              f"magnitude={payload.get('magnitude', 0):.3f}")
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/batches")
def get_batches():
    limit = int(request.args.get("limit", 100))
    return jsonify(list(sessions)[-limit:])


@app.route("/api/summary")
def get_summary():
    summary = {"none": 0, "mild": 0, "moderate": 0, "severe": 0}
    for batch in sessions:
        sev = batch.get("severity", "none")
        if sev in summary:
            summary[sev] += 1
    return jsonify({"totalBatches": len(sessions), "summary": summary})


@app.route("/api/clear", methods=["POST"])
def clear_data():
    sessions.clear()
    return jsonify({"status": "cleared"})


# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.route("/")
def dashboard():
    return render_template("index.html")


if __name__ == "__main__":
    print("Tremor Tracker server running at http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
