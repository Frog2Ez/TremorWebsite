// calendar.js

const COLORS = {
    none: '#00c853',
    mild: '#ffd600',
    moderate: '#ff6d00',
    severe: '#dd2c00',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PX_PER_POINT = 8;


// -------------------- Helpers ------------------------------------------------


const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const sortByTime = (batches) =>
    [...batches].sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));

const getY = (mag, height) =>
    height / 2 - (mag / 12) * (height / 2 - 8);


// -------------------- Drawing Functions ------------------------------------------------

function drawCentreLine(ctx, W, H) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawWaveform(ctx, data, H) {
    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];

        ctx.strokeStyle = COLORS[curr.severity || 'none'];
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo((i - 1) * PX_PER_POINT, getY(prev.magnitude, H));
        ctx.lineTo(i * PX_PER_POINT, getY(curr.magnitude, H));
        ctx.stroke();
    }
}

function drawTimeLabels(ctx, data, H) {
    const step = Math.max(1, Math.floor(120 / PX_PER_POINT));

    ctx.font = '9px IBM Plex Mono';
    ctx.fillStyle = '#3a5060';

    data.forEach((b, i) => {
        if (i % step !== 0) return;
        ctx.fillText(formatTime(b.receivedAt), i * PX_PER_POINT + 2, H - 4);
    });
}


// -------------------- UI Components ------------------------------------------------


function Label({ text }) {
    return (
        <div style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: 10,
            color: '#4a6070',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 5
        }}>
            {text}
        </div>
    );
}

function Loading() {
    return (
        <div style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: 12,
            color: '#3a5060'
        }}>
            Loading...
        </div>
    );
}

function Header({ label, onClose }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
        }}>
            <div style={{
                fontFamily: 'IBM Plex Mono',
                fontSize: 13,
                color: '#ccd6e0'
            }}>
                {label}
            </div>

            <button onClick={onClose} style={{
                background: 'none',
                border: '1px solid #1e2a3a',
                color: '#3a5060',
                borderRadius: 4,
                padding: '3px 10px',
                fontFamily: 'IBM Plex Mono',
                fontSize: 11,
                cursor: 'pointer'
            }}>
                CLOSE
            </button>
        </div>
    );
}

function Dot({ active, color }) {
    return (
        <div style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: active ? 'rgba(255,255,255,0.6)' : color
        }} />
    );
}


// -------------------- History Seismograph ------------------------------------------------
// Displays a waveform visualization of tremor data for a given day.

function HistorySeismograph({ title, batches }) {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { width: W, height: H } = canvas;

        ctx.fillStyle = '#060b10';
        ctx.fillRect(0, 0, W, H);

        if (!batches.length) {
            ctx.fillStyle = '#2a3a48';
            ctx.font = '11px IBM Plex Mono';
            ctx.fillText('No data', 10, H / 2);
            return;
        }

        const data = sortByTime(batches);

        drawCentreLine(ctx, W, H);
        drawWaveform(ctx, data, H);
        drawTimeLabels(ctx, data, H);

    }, [batches]);

    const canvasWidth = Math.max(900, batches.length * PX_PER_POINT);

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
// When a date is selected on the calendar, this panel fetches and displays detailed data for that day.
// It shows separate seismographs for gyroscope and accelerometer data.


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

            <HistorySeismograph
                title="Gyroscope"
                batches={dayData.batches.filter(b => b.sensor === 'GYROSCOPE')}
            />

            <HistorySeismograph
                title="Accelerometer"
                batches={dayData.batches.filter(b => b.sensor === 'ACCELEROMETER')}
            />
        </div>
    );
}


// ------------ Calendar Day Cell ------------------------------------------------
// Renders an individual day cell in the calendar grid.
// Indicates if data is available for that day and its severity level.
// Highlights the cell if it's today or currently selected.


function DayCell({ day, dateStr, worst, isToday, isSelected, onClick }) {
    const hasData = !!worst;

    const bg =
        isSelected ? COLORS[worst] :
        isToday ? '#6964ff' :
        'transparent';

    const border =
        !isSelected && hasData && !isToday
            ? `2px dotted ${COLORS[worst]}`
            : 'none';

    return (
        <div style={styles.cellWrap}>
            <div
                onClick={() => hasData && onClick()}
                style={{
                    ...styles.cell,
                    background: bg,
                    border,
                    cursor: hasData ? 'pointer' : 'default',
                    color: isSelected || isToday
                        ? '#fff'
                        : hasData
                        ? '#8899aa'
                        : '#2a3a48',
                }}
            >
                {day}
                {hasData && (
                    <Dot active={isSelected || isToday} color={COLORS[worst]} />
                )}
            </div>
        </div>
    );
}


// ------------- Calendar -------------------------------------------------
// Renders the calendar grid and handles month navigation.
// Fetches available dates from the server and indicates them on the calendar.
// When a date is selected, shows the DayDetail view above the calendar.


function Calendar({ onSelectDate, selectedDate }) {
    const [dates, setDates] = React.useState([]);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    React.useEffect(() => {
        fetch('/api/history/dates')
            .then(r => r.json())
            .then(setDates);
    }, []);

    const dateMap = {};
    dates.forEach(d => { dateMap[d.date] = d.worst; });

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div style={styles.calendar}>

            {/* Header */}
            <div style={styles.calendarHeader}>
                <div style={styles.monthLabel}>
                    {MONTHS[month]} {year}
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={styles.navBtn}>‹</button>
                    <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={styles.navBtn}>›</button>
                </div>
            </div>

            {/* Weekdays */}
            <div style={styles.grid}>
                {WEEKDAYS.map(d => (
                    <div key={d} style={styles.weekday}>{d}</div>
                ))}
            </div>

            {/* Days */}
            <div style={styles.grid}>
                {cells.map((day, i) => {
                    if (!day) return <div key={i} style={{ padding: '14px 0' }} />;

                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const worst = dateMap[dateStr];

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

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

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