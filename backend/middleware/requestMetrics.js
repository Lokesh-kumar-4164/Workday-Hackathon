import { Counter, Histogram, register } from 'prom-client';
import os from 'os';
import { record as storeRecord } from '../services/metricsStore.js';

// Instance identifier — set INSTANCE_ID env var per replica, falls back to hostname.
const INSTANCE = process.env.INSTANCE_ID || os.hostname();

// ── Metrics definitions ────────────────────────────────────────────────────────
// Guard with a symbol so nodemon hot-reloads don't re-register the same metric.
const INIT_KEY = Symbol.for('prom_metrics_init');

if (!global[INIT_KEY]) {
    global[INIT_KEY] = true;

    // Total request counter
    global.__httpRequestsTotal = new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code', 'instance'],
    });

    // Request duration histogram (seconds)
    global.__httpRequestDurationSeconds = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'route', 'status_code', 'instance'],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });
}

const httpRequestsTotal          = global.__httpRequestsTotal;
const httpRequestDurationSeconds = global.__httpRequestDurationSeconds;

// ── Middleware ─────────────────────────────────────────────────────────────────
/**
 * Express middleware that instruments every request with Prometheus metrics
 * AND feeds the in-memory time-series store used by the admin dashboard.
 *
 * Errors inside this middleware are caught and logged — they NEVER propagate
 * to the request handler so application functionality is never affected.
 */
const prometheusMetrics = (req, res, next) => {
    // Track start time with high-resolution timer
    const startHr = process.hrtime.bigint();
    let endTimer;
    try {
        endTimer = httpRequestDurationSeconds.startTimer();
    } catch (err) {
        console.error('[metrics] Failed to start timer:', err);
    }

    res.on('finish', () => {
        try {
            // Normalise route: use matched Express route pattern when available,
            // otherwise fall back to the raw URL path (replace numeric IDs to avoid
            // high cardinality, e.g. /events/42 → /events/:id).
            const route = req.route?.path
                ? (req.baseUrl || '') + req.route.path
                : req.path?.replace(/\/\d+/g, '/:id') || 'unknown';

            const labels = {
                method:      req.method,
                route,
                status_code: String(res.statusCode),
                instance:    INSTANCE,
            };

            // ── prom-client (for /metrics scraping by Prometheus) ────────────
            httpRequestsTotal.inc(labels);
            if (endTimer) endTimer(labels);

            // ── in-memory store (for admin dashboard charts, no Prometheus needed) ──
            const durationSec = Number(process.hrtime.bigint() - startHr) / 1e9;
            storeRecord({
                method:      req.method,
                route,
                statusCode:  String(res.statusCode),
                instance:    INSTANCE,
                durationSec,
            });
        } catch (err) {
            console.error('[metrics] Failed to record metrics:', err);
        }
    });

    next();
};

export default prometheusMetrics;
export { httpRequestsTotal, httpRequestDurationSeconds, register };