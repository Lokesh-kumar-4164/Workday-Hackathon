import { Counter, Histogram, Gauge, register } from 'prom-client';
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

    // ── Downstream Notification Resilience Metrics ──
    global.__notificationAttemptsTotal = new Counter({
        name: 'notification_attempts_total',
        help: 'Total number of downstream notification dispatch attempts',
    });

    global.__notificationSuccessTotal = new Counter({
        name: 'notification_success_total',
        help: 'Total number of successful downstream notifications delivered',
    });

    global.__notificationFailuresTotal = new Counter({
        name: 'notification_failures_total',
        help: 'Total number of failed downstream notification attempts',
        labelNames: ['reason'],
    });

    global.__notificationRetriesTotal = new Counter({
        name: 'notification_retries_total',
        help: 'Total number of notification retry attempts executed by worker',
    });

    global.__notificationTimeoutsTotal = new Counter({
        name: 'notification_timeouts_total',
        help: 'Total number of downstream notification requests that timed out',
    });

    global.__downstreamEmailLatencySeconds = new Histogram({
        name: 'downstream_email_latency_seconds',
        help: 'Downstream email service request latency in seconds',
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10],
    });

    global.__circuitBreakerStateGauge = new Gauge({
        name: 'circuit_breaker_state',
        help: 'Circuit breaker state (0=CLOSED, 1=HALF-OPEN, 2=OPEN)',
        labelNames: ['service'],
    });
}

const httpRequestsTotal          = global.__httpRequestsTotal;
const httpRequestDurationSeconds = global.__httpRequestDurationSeconds;

export const notificationAttemptsTotal      = global.__notificationAttemptsTotal;
export const notificationSuccessTotal       = global.__notificationSuccessTotal;
export const notificationFailuresTotal      = global.__notificationFailuresTotal;
export const notificationRetriesTotal       = global.__notificationRetriesTotal;
export const notificationTimeoutsTotal      = global.__notificationTimeoutsTotal;
export const downstreamEmailLatencySeconds  = global.__downstreamEmailLatencySeconds;
export const circuitBreakerStateGauge       = global.__circuitBreakerStateGauge;


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