// seismograph.js
// Shared constants and drawing utilities used by both dashboard.js and calendar.js.

const COLORS = {
    none:     '#00c853',
    mild:     '#ffd600',
    moderate: '#ff6d00',
    severe:   '#dd2c00',
};

// Pixels reserved on the left of every canvas for Y axis labels
const AXIS_W = 34;

// Magnitude values at which grid lines and labels are drawn
const Y_TICKS = [0, 2, 4, 6, 8, 10, 12];

// Converts a magnitude value (0–12) to a canvas Y coordinate.
// Maps 0 to the bottom and 12 to the top, using the full canvas height.
function magToY(mag, H) {
    return H - 8 - (mag / 12) * (H - 16);
}

// Draws horizontal grid lines and Y axis labels at each tick value.
// All waveform drawing should start at x = AXIS_W to avoid overlapping labels.
function drawYAxis(ctx, W, H) {
    ctx.font      = '9px IBM Plex Mono';
    ctx.textAlign = 'right';

    Y_TICKS.forEach(mag => {
        const y = magToY(mag, H);

        ctx.strokeStyle = mag === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
        ctx.lineWidth   = 1;
        ctx.setLineDash(mag === 0 ? [4, 6] : [2, 6]);
        ctx.beginPath();
        ctx.moveTo(AXIS_W, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = mag === 0 ? '#3a5060' : '#2a3a48';
        ctx.fillText(mag, AXIS_W - 4, y + 3);
    });

    ctx.textAlign = 'left';
}
