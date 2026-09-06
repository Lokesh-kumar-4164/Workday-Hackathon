/**
 * metricsStore.js
 *
 * Lightweight in-memory time-series store.
 * Aggregates request metrics into 15-second buckets and keeps 1 hour of history.
 * Used as the primary data source for the admin monitoring dashboard when a
 * standalone Prometheus server is not running.
 *
 * Prometheus (when running) scrapes /metrics and provides richer PromQL queries;
 * this store gives equivalent data with no extra infrastructure.
 */

const BUCKET_MS  = 15_000;   // 15-second resolution
const MAX_BUCKETS = 240;     // 240 × 15 s = 1 hour of history

// Ring buffer of aggregated buckets.
// Each bucket: { ts: <epoch-ms>, rows: Map<labelKey, RowEntry> }
const buckets = [];
let currentBucket = null;

/** Round a timestamp down to the nearest bucket boundary. */
function bucketTs(now = Date.now()) {
    return Math.floor(now / BUCKET_MS) * BUCKET_MS;
}

/** Return (and create if necessary) the bucket for the current 15-second window. */
function getOrCreate(ts) {
    if (currentBucket?.ts === ts) return currentBucket;
    currentBucket = { ts, rows: new Map() };
    buckets.push(currentBucket);
    // Trim oldest buckets beyond the 1-hour window
    while (buckets.length > MAX_BUCKETS) buckets.shift();
    return currentBucket;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record one completed request into the current bucket.
 * Called from the metrics middleware — all errors are suppressed.
 *
 * @param {{ method: string, route: string, statusCode: string, instance: string, durationSec: number }} opts
 */
export function record({ method, route, statusCode, instance, durationSec }) {
    try {
        const ts  = bucketTs();
        const bucket = getOrCreate(ts);
        const key = `${method}||${route}||${statusCode}||${instance}`;

        let row = bucket.rows.get(key);
        if (!row) {
            row = { method, route, statusCode, instance, total: 0, durationSum: 0, fourxx: 0, fivexx: 0 };
            bucket.rows.set(key, row);
        }
        row.total       += 1;
        row.durationSum += durationSec;
        const code = parseInt(statusCode, 10);
        if (code >= 400 && code < 500) row.fourxx += 1;
        if (code >= 500)               row.fivexx += 1;
    } catch (_) {
        // Never throw — metrics must not affect requests
    }
}

/**
 * Compute instant summary stats from the last 60 seconds of data.
 * Returns the same shape expected by the frontend MetricCard components.
 */
export function getSummary() {
    const now = Date.now();
    const cutoff = now - 60_000; // last 60 seconds

    let total = 0, fourxx = 0, fivexx = 0, durationSum = 0;
    const instances = new Set();

    for (const b of buckets) {
        if (b.ts < cutoff) continue;
        for (const r of b.rows.values()) {
            total       += r.total;
            fourxx      += r.fourxx;
            fivexx      += r.fivexx;
            durationSum += r.durationSum;
            instances.add(r.instance);
        }
    }

    const errors = fourxx + fivexx;
    const windowSec = 60;

    return {
        requestsPerSec:  parseFloat((total  / windowSec).toFixed(3)),
        avgLatencyMs:    total > 0 ? parseFloat(((durationSum / total) * 1000).toFixed(2)) : null,
        p95LatencyMs:    null,   // requires histogram data; not available without Prometheus
        errorRate:       total > 0 ? parseFloat((errors / total).toFixed(4)) : 0,
        fourxxPerSec:    parseFloat((fourxx / windowSec).toFixed(4)),
        fivexxPerSec:    parseFloat((fivexx / windowSec).toFixed(4)),
        activeInstances: instances.size || null,
    };
}

/**
 * Build time-series arrays from the bucket history.
 * Returns the same shape as the Prometheus range-query proxy.
 *
 * @param {number} windowSeconds  How far back to look (max 3600)
 */
export function getRange(windowSeconds = 3600) {
    const now    = Date.now();
    const cutoff = now - Math.min(windowSeconds, 3600) * 1000;

    // Aggregate per bucket-timestamp
    const byTs       = new Map();   // ts → { total, durationSum, errors, fourxx, fivexx }
    const byInstance = new Map();   // instance → Map<ts, count>

    for (const b of buckets) {
        if (b.ts < cutoff) continue;
        const tsSec = b.ts / 1000;

        if (!byTs.has(tsSec)) byTs.set(tsSec, { total: 0, durationSum: 0, errors: 0, fourxx: 0, fivexx: 0 });
        const agg = byTs.get(tsSec);

        for (const r of b.rows.values()) {
            agg.total       += r.total;
            agg.durationSum += r.durationSum;
            agg.fourxx      += r.fourxx;
            agg.fivexx      += r.fivexx;
            agg.errors      += r.fourxx + r.fivexx;

            // Per-instance breakdown
            if (!byInstance.has(r.instance)) byInstance.set(r.instance, new Map());
            const instMap = byInstance.get(r.instance);
            instMap.set(tsSec, (instMap.get(tsSec) ?? 0) + r.total);
        }
    }

    const bucketSec = BUCKET_MS / 1000;  // 15

    const sortedTs = [...byTs.keys()].sort((a, b) => a - b);

    const ratePoints = sortedTs.map(t => {
        const d = byTs.get(t);
        return { t, v: parseFloat((d.total / bucketSec).toFixed(4)) };
    });

    const latencyPoints = sortedTs.map(t => {
        const d = byTs.get(t);
        return { t, v: d.total > 0 ? parseFloat(((d.durationSum / d.total) * 1000).toFixed(2)) : null };
    });

    const errRatePoints = sortedTs.map(t => {
        const d = byTs.get(t);
        return { t, v: d.total > 0 ? parseFloat((d.errors / d.total).toFixed(4)) : 0 };
    });

    const byInstanceSeries = [...byInstance.entries()].map(([label, tsMap]) => ({
        label,
        values: [...tsMap.entries()]
            .sort(([a], [b]) => a - b)
            .map(([t, count]) => ({ t, v: parseFloat((count / bucketSec).toFixed(4)) })),
    }));

    return {
        requestRate: ratePoints.length  ? [{ label: 'total', values: ratePoints }]   : [],
        latencyMs:   latencyPoints.length ? [{ label: 'avg ms', values: latencyPoints }] : [],
        errorRate:   errRatePoints.length ? [{ label: 'error rate', values: errRatePoints }] : [],
        byInstance:  byInstanceSeries,
    };
}
