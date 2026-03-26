// calendar.js

const COLORS = {
    none:     '#00c853',
    mild:     '#ffd600',
    moderate: '#ff6d00',
    severe:   '#dd2c00',
};

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PX_PER_POINT = 8;
const AXIS_W       = 34;   // pixels reserved on the left for Y axis
const Y_TICKS      = [0, 3, 6, 9, 12];


// -------------------- Helpers ------------------------------------------------

const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const sortByTime = (batches) =>
    [...batches].sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));

const getY = (mag, H) =>
    H / 2 - (mag / 12) * (H / 2 - 8);


// -------------------- Drawing Functions ------------------------------------------------

// Draws Y axis labels and horizontal grid lines at each tick value
function drawYAxis(ctx, W, H) {
    ctx.font      = '9px IBM Plex Mono';
    ctx.textAlign = 'right';

    Y_TICKS.forEach(mag => {
        const y = getY(mag, H);

        // Horizontal grid line — solid for 0 (baseline), dotted for the rest
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

// Draws the waveform, offset by AXIS_W so it doesn't overlap the Y axis labels
function drawWaveform(ctx, data, H) {
    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];

        ctx.strokeStyle = COLORS[curr.severity || 'none'];
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(AXIS_W + (i - 1) * PX_PER_POINT, getY(prev.magnitude, H));
        ctx.lineTo(AXIS_W + i       * PX_PER_POINT, getY(curr.magnitude, H));
        ctx.stroke();
    }
}

// Draws time labels along the bottom, offset by AXIS_W
function drawTimeLabels(ctx, data, H) {
    const step = Math.max(1, Math.floor(120 / PX_PER_POINT));

    ctx.font      = '9px IBM Plex Mono';
    ctx.fillStyle = '#3a5060';
    ctx.textAlign = 'left';

    data.forEach((b, i) => {
        if (i % step !== 0) return;
        ctx.fillText(formatTime(b.receivedAt), AXIS_W + i * PX_PER_POINT + 2, H - 4);
    });
}


// -------------------- UI Components ------------------------------------------------

function Label({ text }) {
    return (
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#4a6070', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 5 }}>
            {text}
        </div>
    );
}

function Loading() {
    return (
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#3a5060' }}>
            Loading...
        </div>
    );
}

function Header({ label, onClose }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: '#ccd6e0' }}>{label}</div>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e2a3a', color: '#3a5060', borderRadius: 4, padding: '3px 10px', fontFamily: 'IBM Plex Mono', fontSize: 11, cursor: 'pointer' }}>
                CLOSE
            </button>
        </div>
    );
}

function Dot({ active, color }) {
    return (
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: active ? 'rgba(255,255,255,0.6)' : color }} />
    );
}


// -------------------- History Seismograph ------------------------------------------------

function HistorySeismograph({ title, batches }) {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx       = canvas.getContext('2d');
        const { width: W, height: H } = canvas;

        ctx.fillStyle = '#060b10';
        ctx.fillRect(0, 0, W, H);

        if (!batches.length) {
            ctx.fillStyle = '#2a3a48';
            ctx.font      = '11px IBM Plex Mono';
            ctx.fillText('No data', AXIS_W + 10, H / 2);
            return;
        }

        const data = sortByTime(batches);

        drawYAxis(ctx, W, H);
        drawWaveform(ctx, data, H);
        drawTimeLabels(ctx, data, H);

    }, [batches]);

    // Canvas is wide enough for all points plus the axis area
    const canvasWidth = AXIS_W + Math.max(900 - AXIS_W, batches.length * PX_PER_POINT);

    return (
        <div style={{ marginBottom: 14 }}>
            <Label text={title} />
            <div style={styles.scrollBox}>
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


// -------------------- Day Detail Panel ------------------------------------------------

function DayDetail({ dateStr, onClose }) {
    const [dayData, setDayData] = React.useState(null);

    React.useEffect(() => {
        setDayData(null);
        fetch(`/api/history/${dateStr}`)
            .then(r => r.json())
            .then(setDayData);
    }, [dateStr]);

    const [y, m, d] = dateStr.split('-');
    const label = `${MONTHS[m - 1]} ${d}, ${y}`;

    if (!dayData) {
        return (
            <div style={styles.panel}>
                <Header label={label} onClose={onClose} />
                <Loading />
            </div>
        );
    }

    return (
        <div style={styles.panel}>
            <Header label={label} onClose={onClose} />
            <HistorySeismograph title="Gyroscope"     batches={dayData.batches.filter(b => b.sensor === 'GYROSCOPE')}     />
            <HistorySeismograph title="Accelerometer" batches={dayData.batches.filter(b => b.sensor === 'ACCELEROMETER')} />
        </div>
    );
}


// -------------------- Calendar Day Cell ------------------------------------------------

function DayCell({ day, dateStr, worst, isToday, isSelected, onClick }) {
    const hasData = !!worst;

    const bg     = isSelected ? COLORS[worst] : isToday ? '#6964ff' : 'transparent';
    const border = !isSelected && hasData && !isToday ? `2px dotted ${COLORS[worst]}` : 'none';

    return (
        <div style={styles.cellWrap}>
            <div
                onClick={() => hasData && onClick()}
                style={{
                    ...styles.cell,
                    background: bg,
                    border,
                    cursor: hasData ? 'pointer' : 'default',
                    color: isSelected || isToday ? '#fff' : hasData ? '#8899aa' : '#2a3a48',
                }}
            >
                {day}
                {hasData && <Dot active={isSelected || isToday} color={COLORS[worst]} />}
            </div>
        </div>
    );
}


// -------------------- Calendar ------------------------------------------------

function Calendar({ onSelectDate, selectedDate }) {
    const [dates,        setDates]        = React.useState([]);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    React.useEffect(() => {
        fetch('/api/history/dates').then(r => r.json()).then(setDates);
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
        <div style={styles.calendar}>
            <div style={styles.calendarHeader}>
                <div style={styles.monthLabel}>{MONTHS[month]} {year}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={styles.navBtn}>‹</button>
                    <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={styles.navBtn}>›</button>
                </div>
            </div>

            <div style={styles.grid}>
                {WEEKDAYS.map(d => <div key={d} style={styles.weekday}>{d}</div>)}
            </div>

            <div style={styles.grid}>
                {cells.map((day, i) => {
                    if (!day) return <div key={i} style={{ padding: '14px 0' }} />;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const worst   = dateMap[dateStr];
                    return (
                        <DayCell
                            key={i}
                            day={day}
                            dateStr={dateStr}
                            worst={worst}
                            isToday={dateStr === todayStr}
                            isSelected={dateStr === selectedDate}
                            onClick={() => onSelectDate(dateStr === selectedDate ? null : dateStr)}
                        />
                    );
                })}
            </div>
        </div>
    );
}


// -------------------- Styles ------------------------------------------------

const styles = {
    panel: {
        background: '#0d1117',
        border: '1px solid #111d28',
        borderRadius: 6,
        padding: 16,
    },
    scrollBox: {
        overflowX: 'auto',
        border: '1px solid #111d28',
        borderRadius: 4,
    },
    calendar: {
        background: '#0d1117',
        border: '1px solid #111d28',
        borderRadius: 10,
        padding: 16,
    },
    calendarHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '0 4px',
    },
    monthLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: 14,
        color: '#ccd6e0',
    },
    navBtn: {
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: 'none',
        border: '1px solid #1e2a3a',
        color: '#4a6070',
        fontSize: 16,
        cursor: 'pointer',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
    },
    weekday: {
        textAlign: 'center',
        fontFamily: 'IBM Plex Mono',
        fontSize: 10,
        color: '#2a4050',
        padding: '6px 0',
    },
    cellWrap: {
        display: 'flex',
        justifyContent: 'center',
        padding: '4px 0',
    },
    cell: {
        width: 34,
        height: 34,
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'IBM Plex Mono',
        fontSize: 12,
        gap: 2,
    },
};