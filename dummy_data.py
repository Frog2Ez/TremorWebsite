# dummy_data.py

from datetime import datetime, timedelta, date
import random
import os
import psycopg2


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def make_dummy_batch(sensor, severity, magnitude):
    return {
        "sensor":        sensor,
        "magnitude":     magnitude,
        "peakMagnitude": magnitude * 1.3,
        "severity":      severity,
        "detected":      severity != "none",
        "sampleCount":   50,
    }


def generate_dummy_day(date_str, profile):
    batches = []
    base_time = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=9)

    for sensor, severity, magnitude, count in profile:
        for _ in range(count):
            b = make_dummy_batch(
                sensor,
                severity,
                round(magnitude + random.uniform(-0.3, 0.3), 3)
            )
            offset_mins = random.randint(0, 480)
            b["receivedAt"] = (base_time + timedelta(minutes=offset_mins)).isoformat()
            batches.append(b)

    random.shuffle(batches)
    return batches


def seed_dummy_data():
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM batches")
    count = c.fetchone()[0]

    if count > 0:
        print("Database already contains data — skipping seed.")
        conn.close()
        return

    print("Seeding dummy data...")

    today = date.today()

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
            ("GYROSCOPE",     "none", 0.8, 30),
            ("GYROSCOPE",     "mild", 1.8, 10),
            ("ACCELEROMETER", "none", 0.9, 30),
            ("ACCELEROMETER", "mild", 2.0,  8),
        ]),
        (3, [
            ("GYROSCOPE",     "none",     0.6, 20),
            ("GYROSCOPE",     "mild",     2.1, 15),
            ("GYROSCOPE",     "moderate", 3.5,  8),
            ("ACCELEROMETER", "none",     0.7, 20),
            ("ACCELEROMETER", "moderate", 3.8, 10),
        ]),
        (2, [
            ("GYROSCOPE",     "none", 0.5, 40),
            ("GYROSCOPE",     "mild", 1.6,  5),
            ("ACCELEROMETER", "none", 0.6, 40),
            ("ACCELEROMETER", "mild", 1.9,  4),
        ]),
        (1, [
            ("GYROSCOPE",     "none",     0.7, 15),
            ("GYROSCOPE",     "mild",     2.0, 12),
            ("GYROSCOPE",     "moderate", 4.1, 10),
            ("GYROSCOPE",     "severe",   7.2,  6),
            ("ACCELEROMETER", "none",     0.8, 15),
            ("ACCELEROMETER", "moderate", 3.9,  8),
            ("ACCELEROMETER", "severe",   6.8,  5),
        ])
    ]:
        date_str = (today - timedelta(days=days_ago)).isoformat()
        batches  = generate_dummy_day(date_str, profile)

        for b in batches:
            c.execute("""
                INSERT INTO batches (sensor, magnitude, severity, detected, receivedAt)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                b["sensor"],
                b["magnitude"],
                b["severity"],
                b["detected"],
                b["receivedAt"]
            ))

    conn.commit()
    conn.close()
    print("Dummy data seeded.")