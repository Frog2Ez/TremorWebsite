// calendar.js

const COLORS = {
    none:     '#00c853',
    mild:     '#ffd600',
    moderate: '#ff6d00',
    severe:   '#dd2c00',
};

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Pixels per batch point — wider = more spread out = easier to scroll
const PX_PER_POINT = 8;

// ── History Seismograph ───────────────────────────────────────────
// Draws all batches for a day on a wide canvas with horizontal scroll.

function HistorySeismograph({ title, batches }) {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const W   = canvas.width;
        const H   = canvas.height;

        ctx.fillStyle = '#060b10';
        ctx.fillRect(0, 0, W, H);

        if (batches.length === 0) {
            ctx.fillStyle = '#2a3a48';
            ctx.font = '11px IBM Plex Mono';
            ctx.fillText('No data', 10, H / 2 + 4);
            return;
        }

        // Sort by time so the waveform flows left to right chronologically
        const sorted = [...batches].sort((a, b) =>
            new Date(a.receivedAt) - new Date(b.receivedAt)
        );

        // Dashed centre line
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
        ctx.setLineDash([]);

        // Waveform — each point is PX_PER_POINT pixels wide
        for (let i = 1; i < sorted.length; i++) {
            const x1  = (i - 1) * PX_PER_POINT;
            const x2  = i * PX_PER_POINT;
            const y1  = H / 2 - (sorted[i - 1].magnitude / 12) * (H / 2 - 8);
            const y2  = H / 2 - (sorted[i].magnitude     / 12) * (H / 2 - 8);
            const col = COLORS[sorted[i].severity || 'none'];

            ctx.strokeStyle = col;
            ctx.lineWidth   = 1.5;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }

        // Timestamp labels every ~120px
        const labelEvery = Math.max(1, Math.floor(120 / PX_PER_POINT));
        ctx.font      = '9px IBM Plex Mono';
        ctx.fillStyle = '#3a5060';
        sorted.forEach((b, i) => {
            if (i % labelEvery !== 0) return;
            const x    = i * PX_PER_POINT;
            const time = b.receivedAt
                ? new Date(b.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
            ctx.fillText(time, x + 2, H - 4);
        });

    }, [batches]);

    // Canvas is wide enough to show every point at PX_PER_POINT each
    const canvasWidth = Math.max(900, batches.length * PX_PER_POINT);

    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#4a6070', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 5 }}>
                {title}
            </div>
            {/* overflowX scroll wrapper */}
            <div style={{ overflowX: 'auto', border: '1px solid #111d28', borderRadius: 4 }}>
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={100}
                    style={{ height: 100, display: 'block' }}
                />
            </div>
        </div>
    );
}

// ── Day Detail ────────────────────────────────────────────────────

function DayDetail({ dateStr, onClose }) {
    const [dayData, setDayData] = React.useState(null);

    React.useEffect(() => {
        setDayData(null);
        fetch(`/api/history/${dateStr}`)
            .then(r => r.json())
            .then(setDayData);
    }, [dateStr]);

    const [year, month, day] = dateStr.split('-').map(Number);
    const label = `${MONTHS[month - 1]} ${day}, ${year}`;

    return (
        <div style={{ background: '#0d1117', border: '1px solid #111d28', borderRadius: 6, padding: 16 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#ccd6e0' }}>{label}</div>
                <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e2a3a', color: '#3a5060', borderRadius: 4, padding: '3px 10px', fontFamily: 'IBM Plex Mono', fontSize: 11, cursor: 'pointer' }}>
                    CLOSE
                </button>
            </div>

            {!dayData ? (
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#3a5060' }}>Loading...</div>
            ) : (
                <>
                    <HistorySeismograph title="Gyroscope"     batches={dayData.batches.filter(b => b.sensor === 'GYROSCOPE')}     />
                    <HistorySeismograph title="Accelerometer" batches={dayData.batches.filter(b => b.sensor === 'ACCELEROMETER')} />
                </>
            )}
        </div>
    );
}

// ── Calendar ──────────────────────────────────────────────────────

function Calendar({ onSelectDate, selectedDate }) {
    const [dates,        setDates]        = React.useState([]);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    React.useEffect(() => {
        fetch('/api/history/dates')
            .then(r => r.json())
            .then(setDates);
    }, []);

    const dateMap = {};
    dates.forEach(d => { dateMap[d.date] = d.worst; });

    const year        = currentMonth.getFullYear();
    const month       = currentMonth.getMonth();
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr    = new Date().toISOString().split('T')[0];

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div style={{ background: '#0d1117', border: '1px solid #111d28', borderRadius: 10, padding: 16 }}>

            {/* Month + nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 500, color: '#ccd6e0' }}>
                    {MONTHS[month]} {year}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{
                        width: 30, height: 30, borderRadius: '50%', background: 'none',
                        border: '1px solid #1e2a3a', color: '#4a6070', fontSize: 16,
                        cursor: 'pointer', lineHeight: '28px', textAlign: 'center',
                    }}>‹</button>
                    <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{
                        width: 30, height: 30, borderRadius: '50%', background: 'none',
                        border: '1px solid #1e2a3a', color: '#4a6070', fontSize: 16,
                        cursor: 'pointer', lineHeight: '28px', textAlign: 'center',
                    }}>›</button>
                </div>
            </div>

            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {WEEKDAYS.map(d => (
                    <div key={d} style={{
                        textAlign: 'center', fontFamily: 'IBM Plex Mono',
                        fontSize: 10, color: '#2a4050', padding: '6px 0',
                        fontWeight: 500,
                    }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells — circular highlight style */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {cells.map((day, i) => {
                    if (!day) return <div key={i} style={{ padding: '14px 0' }} />;

                    const dateStr    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const worst      = dateMap[dateStr];
                    const isToday    = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    const hasData    = !!worst;

                    // Circle background colour
                    let circleBg = 'transparent';
                    if (isSelected) circleBg = COLORS[worst];
                    else if (isToday) circleBg = '#6964ff';

                    return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                            <div
                                onClick={() => hasData && onSelectDate(isSelected ? null : dateStr)}
                                style={{
                                    position: 'relative',
                                    width: 34, height: 34,
                                    borderRadius: '50%',
                                    background: circleBg,
                                    border: isSelected ? 'none' : hasData && !isToday ? `2px dotted ${COLORS[worst]}` : 'none',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    cursor: hasData ? 'pointer' : 'default',
                                    fontFamily: 'IBM Plex Mono',
                                    fontSize: 12,
                                    color: isSelected || isToday ? '#fff' : hasData ? '#8899aa' : '#2a3a48',
                                    gap: 2,
                                }}
                            >
                                {day}
                                {hasData && (
                                    <div style={{
                                        width: 4, height: 4, borderRadius: '50%',
                                        background: isSelected || isToday ? 'rgba(255,255,255,0.6)' : COLORS[worst],
                                    }} />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}