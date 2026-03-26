// dashboard.js

const { useState, useEffect, useRef } = React;

const COLORS = {
    none:     '#00c853',
    mild:     '#ffd600',
    moderate: '#ff6d00',
    severe:   '#dd2c00',
};

// Width in pixels reserved on the left for Y axis labels
const AXIS_W = 34;

// Y axis tick values — magnitude goes 0 to 12
const Y_TICKS = [0, 3, 6, 9, 12];

// Converts a magnitude value to a canvas Y coordinate.
// The waveform only uses the top half of the canvas (above centre line).
function magToY(mag, H) {
    return H / 2 - (mag / 12) * (H / 2 - 8);
}

// Draws Y axis labels and faint horizontal grid lines
function drawYAxis(ctx, W, H) {
    ctx.font      = '9px IBM Plex Mono';
    ctx.textAlign = 'right';

    Y_TICKS.forEach(mag => {
        const y = magToY(mag, H);

        // Faint horizontal grid line across the full width
        ctx.strokeStyle = mag === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
        ctx.lineWidth   = 1;
        ctx.setLineDash(mag === 0 ? [4, 6] : [2, 6]);
        ctx.beginPath();
        ctx.moveTo(AXIS_W, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = mag === 0 ? '#3a5060' : '#2a3a48';
        ctx.fillText(mag, AXIS_W - 4, y + 3);
    });

    ctx.textAlign = 'left';
}

// ── Live Seismograph ──────────────────────────────────────────────

function Seismograph({ title, data }) {
    const canvasRef        = useRef(null);
    const buffer           = useRef([]);
    const lastTimestampRef = useRef(null);

    // Only push new points into the buffer based on timestamp
    useEffect(() => {
        if (!data || data.length === 0) return;

        const newPoints = data.filter(point =>
            !lastTimestampRef.current ||
            new Date(point.receivedAt) > new Date(lastTimestampRef.current)
        );

        if (newPoints.length > 0) {
            lastTimestampRef.current = newPoints[newPoints.length - 1].receivedAt;
        }

        newPoints.forEach(point => {
            buffer.current.push({
                mag: point.magnitude || 0,
                sev: point.severity  || 'none',
            });
        });
    }, [data]);

    // 60fps draw loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext('2d');
        let   frame;

        function draw() {
            const W   = canvas.width;
            const H   = canvas.height;
            const buf = buffer.current;
            const plotW = W - AXIS_W;  // usable width after the axis

            // Trim buffer to the usable plot width
            while (buf.length > plotW) buf.shift();

            // Clear
            ctx.fillStyle = '#060b10';
            ctx.fillRect(0, 0, W, H);

            // Y axis background separator
            ctx.fillStyle = '#060b10';
            ctx.fillRect(0, 0, AXIS_W, H);

            // Y axis grid lines and labels
            drawYAxis(ctx, W, H);

            // Waveform — offset everything by AXIS_W on the X axis
            for (let i = 1; i < buf.length; i++) {
                const x1  = AXIS_W + (plotW - buf.length + i - 1);
                const x2  = AXIS_W + (plotW - buf.length + i);
                const y1  = magToY(buf[i - 1].mag, H);
                const y2  = magToY(buf[i].mag,     H);
                const col = COLORS[buf[i].sev];

                ctx.strokeStyle = col;
                ctx.lineWidth   = 1.5;
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            }

            frame = requestAnimationFrame(draw);
        }

        draw();
        return () => cancelAnimationFrame(frame);
    }, []);

    const latest  = buffer.current[buffer.current.length - 1];
    const lastMag = latest ? latest.mag.toFixed(3) : '—';
    const lastSev = latest ? latest.sev : 'none';

    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
                <span style={{ color: '#4a6070', textTransform: 'uppercase', letterSpacing: 2 }}>{title}</span>
                <span style={{ color: COLORS[lastSev] }}>{lastMag} — {lastSev}</span>
            </div>
            <canvas
                ref={canvasRef}
                width={900}
                height={120}
                style={{ width: '100%', height: 120, borderRadius: 4, border: '1px solid #111d28', display: 'block' }}
            />
        </div>
    );
}

// ── Live View ─────────────────────────────────────────────────────

function LiveView() {
    const [allBatches, setAllBatches] = useState([]);
    const [summary,    setSummary]    = useState({ totalBatches: 0, summary: { none: 0, mild: 0, moderate: 0, severe: 0 } });
    const [online,     setOnline]     = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [bRes, sRes] = await Promise.all([
                    fetch('/api/batches?limit=500'),
                    fetch('/api/summary'),
                ]);
                setAllBatches(await bRes.json());
                setSummary(await sRes.json());
                setOnline(true);
            } catch { setOnline(false); }
        }
        fetchData();
        const id = setInterval(fetchData, 2000);
        return () => clearInterval(id);
    }, []);

    const gyro  = allBatches.filter(b => b.sensor === 'GYROSCOPE');
    const accel = allBatches.filter(b => b.sensor === 'ACCELEROMETER');
    const s     = summary.summary;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'IBM Plex Mono', fontSize: 11, color: online ? '#00c853' : '#dd2c00', marginBottom: 20 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#00c853' : '#dd2c00' }} />
                {online ? 'LIVE' : 'OFFLINE'}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                {[
                    { label: 'Total',    value: summary.totalBatches, color: '#ccd6e0' },
                    { label: 'None',     value: s.none,               color: COLORS.none },
                    { label: 'Mild',     value: s.mild,               color: COLORS.mild },
                    { label: 'Moderate', value: s.moderate,           color: COLORS.moderate },
                    { label: 'Severe',   value: s.severe,             color: COLORS.severe },
                ].map(card => (
                    <div key={card.label} style={{ flex: 1, background: '#0d1117', border: '1px solid #111d28', borderRadius: 6, padding: '12px 16px' }}>
                        <div style={{ fontSize: 10, color: '#3a5060', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontFamily: 'IBM Plex Mono' }}>{card.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 500, fontFamily: 'IBM Plex Mono', color: card.color }}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ background: '#0d1117', border: '1px solid #111d28', borderRadius: 6, padding: 16 }}>
                <div style={{ fontSize: 10, color: '#3a5060', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, fontFamily: 'IBM Plex Mono' }}>Seismograph</div>
                <Seismograph title="Gyroscope"     data={gyro}  />
                <Seismograph title="Accelerometer" data={accel} />
            </div>
        </div>
    );
}

// ── History View ──────────────────────────────────────────────────

function HistoryView() {
    const [selectedDate, setSelectedDate] = useState(null);

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                {selectedDate
                    ? <DayDetail dateStr={selectedDate} onClose={() => setSelectedDate(null)} />
                    : <div style={{ background: '#0d1117', border: '1px solid #111d28', borderRadius: 6, padding: 24, fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#2a4050' }}>
                        Select a day on the calendar to view tremor data
                      </div>
                }
            </div>
            <Calendar onSelectDate={setSelectedDate} selectedDate={selectedDate} />
        </div>
    );
}

// ── App ───────────────────────────────────────────────────────────

function App() {
    const [tab, setTab] = useState('live');

    const tabStyle = active => ({
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid #ccd6e0' : '2px solid transparent',
        color: active ? '#ccd6e0' : '#3a5060',
        fontFamily: 'IBM Plex Mono',
        fontSize: 12,
        letterSpacing: 1,
        padding: '8px 0',
        marginRight: 24,
        cursor: 'pointer',
        textTransform: 'uppercase',
    });

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ paddingBottom: 16, marginBottom: 4, fontFamily: 'IBM Plex Mono', fontSize: 18, color: '#ccd6e0', letterSpacing: 1 }}>
                TREMOR TRACKER
            </div>
            <div style={{ borderBottom: '1px solid #111d28', marginBottom: 24 }}>
                <button style={tabStyle(tab === 'live')}    onClick={() => setTab('live')}>Live</button>
                <button style={tabStyle(tab === 'history')} onClick={() => setTab('history')}>History</button>
            </div>
            {tab === 'live'    && <LiveView />}
            {tab === 'history' && <HistoryView />}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);