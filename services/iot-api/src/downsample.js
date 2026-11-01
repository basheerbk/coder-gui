/**
 * Largest-Triangle-Three-Buckets: keeps the visual shape of a series (peaks included)
 * with at most `threshold` points. Input/output rows are [ts, value, ...extra].
 */
export function lttb (rows, threshold) {
    const n = rows.length;
    if (threshold >= n || threshold < 3) {
        return rows.slice();
    }
    const out = [rows[0]];
    const every = (n - 2) / (threshold - 2);
    let a = 0;
    for (let i = 0; i < threshold - 2; i++) {
        const avgStart = Math.floor((i + 1) * every) + 1;
        const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
        let avgX = 0;
        let avgY = 0;
        const len = Math.max(1, avgEnd - avgStart);
        for (let j = avgStart; j < avgEnd; j++) {
            avgX += rows[j][0];
            avgY += rows[j][1];
        }
        avgX /= len;
        avgY /= len;

        const rangeStart = Math.floor(i * every) + 1;
        const rangeEnd = Math.floor((i + 1) * every) + 1;
        const ax = rows[a][0];
        const ay = rows[a][1];
        let maxArea = -1;
        let next = rangeStart;
        for (let j = rangeStart; j < rangeEnd; j++) {
            const area = Math.abs(((ax - avgX) * (rows[j][1] - ay)) - ((ax - rows[j][0]) * (avgY - ay)));
            if (area > maxArea) {
                maxArea = area;
                next = j;
            }
        }
        out.push(rows[next]);
        a = next;
    }
    out.push(rows[n - 1]);
    return out;
}

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Pick the storage tier that still holds [from, to] at useful resolution. */
export function pickTier (from, to, now) {
    const span = to - from;
    if (from >= now - (48 * HOUR) && span <= 6 * HOUR) {
        return 'raw';
    }
    if (from >= now - (30 * DAY) && span <= 7 * DAY) {
        return '1m';
    }
    return '1h';
}
