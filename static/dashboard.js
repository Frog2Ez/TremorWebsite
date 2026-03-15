let lastBatchCount = 0;

// ── Fetch & render summary cards ────────────────────────────────

async function fetchSummary() {
    try {
        const res = await fetch('/api/summary');
        const data = await res.json();

        document.getElementById('totalBatches').textContent = data.totalBatches;
        document.getElementById('countNone').textContent     = data.summary.none;
        document.getElementById('countMild').textContent     = data.summary.mild;
        document.getElementById('countModerate').textContent = data.summary.moderate;
        document.getElementById('countSevere').textContent   = data.summary.severe;
    } catch (e) {
        setOffline();
    }
}

// ── Fetch & render live feed ────────────────────────────────────

async function fetchFeed() {
    try {
        const res = await fetch('/api/batches?limit=50');
        const batches = await res.json();

        setOnline();

        // Only re-render if new data arrived
        if (batches.length === lastBatchCount) return;
        lastBatchCount = batches.length;

        const tbody = document.getElementById('feedBody');
        tbody.innerHTML = '';

        // Show newest first
        const reversed = [...batches].reverse();

        for (const b of reversed) {
            const time = new Date(b.receivedAt).toLocaleTimeString();
            const mag  = typeof b.magnitude === 'number' ? b.magnitude.toFixed(3) : '—';
            const sev  = b.severity || 'none';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${time}</td>
                <td>${b.sensor || '—'}</td>
                <td><span class="badge ${sev}">${sev}</span></td>
                <td>${mag}</td>
                <td>${b.sampleCount || '—'}</td>
            `;
            tbody.appendChild(row);
        }
    } catch (e) {
        setOffline();
    }
}

// ── Connection state helpers ────────────────────────────────────

function setOnline() {
    document.getElementById('dot').classList.add('live');
    document.getElementById('statusText').textContent = 'Receiving data';
}

function setOffline() {
    document.getElementById('dot').classList.remove('live');
    document.getElementById('statusText').textContent = 'No connection';
}

// ── Clear button ────────────────────────────────────────────────

async function clearData() {
    await fetch('/api/clear', { method: 'POST' });
    lastBatchCount = 0;
    fetchSummary();
    fetchFeed();
}

// ── Poll every 2 seconds ────────────────────────────────────────

setInterval(() => {
    fetchSummary();
    fetchFeed();
}, 2000);

// Initial load
fetchSummary();
fetchFeed();
