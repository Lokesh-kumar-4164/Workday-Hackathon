import { getSummary, getRange } from '../services/metricsStore.js';

// ── Optional Prometheus enrichment ───────────────────────────────────────────
// If PROMETHEUS_URL is set and reachable, richer PromQL data (p95 quantile,
// true rates from scrapes) are used. Otherwise the in-memory store provides
// all chart and summary data with no extra infrastructure required.

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || '';

async function promQuery(expr) {
    if (!PROMETHEUS_URL) throw new Error('No Prometheus URL configured');
    const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(expr)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`Prometheus HTTP ${r.status}`);
    return r.json();
}

async function promRangeQuery(expr, rangeSeconds, step) {
    if (!PROMETHEUS_URL) throw new Error('No Prometheus URL configured');
    const end   = Math.floor(Date.now() / 1000);
    const start = end - rangeSeconds;
    const url =
        `${PROMETHEUS_URL}/api/v1/query_range` +
        `?query=${encodeURIComponent(expr)}&start=${start}&end=${end}&step=${step}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`Prometheus HTTP ${r.status}`);
    return r.json();
}

function firstPromValue(data, decimals = 4) {
    const result = data?.data?.result;
    if (!result?.length) return null;
    const v = parseFloat(result[0].value?.[1]);
    return isNaN(v) ? null : parseFloat(v.toFixed(decimals));
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /admin/metrics/summary
 * Instant summary stats for the dashboard stat cards.
 * Primary source: in-memory store. Prometheus enriches p95 if available.
 */
export const getMetricsSummary = async (req, res) => {
    try {
        // Always start from the in-memory store (available immediately)
        const summary = getSummary();

        // Optionally enrich with Prometheus p95 (non-blocking; failure is OK)
        if (PROMETHEUS_URL) {
            try {
                const p95data = await promQuery(
                    'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))'
                );
                const p95 = firstPromValue(p95data);
                if (p95 != null) {
                    summary.p95LatencyMs = parseFloat((p95 * 1000).toFixed(2));
                }
            } catch (_) {
                // Prometheus not reachable — p95 stays null; that's fine
            }
        }

        res.json(summary);
    } catch (error) {
        console.error('[admin/metrics/summary]', error);
        res.status(500).json({ message: 'Failed to compute metrics', detail: error.message });
    }
};

/**
 * GET /admin/metrics/range?window=3600&step=15s
 * Time-series data for the dashboard charts.
 * Primary source: in-memory store. Prometheus used if available (richer data).
 */
export const getMetricsRange = async (req, res) => {
    const windowSeconds = Math.min(parseInt(req.query.window ?? '3600', 10), 3600);
    const step = req.query.step ?? '15s';

    // Try Prometheus first (richer, survives restarts)
    if (PROMETHEUS_URL) {
        try {
            const [rpsRange, latRange, errRange, instanceRange] = await Promise.all([
                promRangeQuery('sum(rate(http_requests_total[1m]))', windowSeconds, step),
                promRangeQuery('sum(rate(http_request_duration_seconds_sum[1m])) / sum(rate(http_request_duration_seconds_count[1m]))', windowSeconds, step),
                promRangeQuery('sum(rate(http_requests_total{status_code=~"[45].."}[1m])) / sum(rate(http_requests_total[1m]))', windowSeconds, step),
                promRangeQuery('sum by (instance) (rate(http_requests_total[1m]))', windowSeconds, step),
            ]);

            function toSeries(raw, scale = 1) {
                return (raw?.data?.result ?? []).map(r => ({
                    label:  r.metric?.instance ?? r.metric?.job ?? 'total',
                    values: r.values.map(([t, v]) => ({
                        t,
                        v: isNaN(parseFloat(v)) ? null : parseFloat((parseFloat(v) * scale).toFixed(4)),
                    })),
                }));
            }

            return res.json({
                requestRate: toSeries(rpsRange),
                latencyMs:   toSeries(latRange, 1000),
                errorRate:   toSeries(errRange),
                byInstance:  toSeries(instanceRange),
                source:      'prometheus',
            });
        } catch (_) {
            // Prometheus unreachable — fall through to in-memory store
        }
    }

    // Fallback: in-memory store (no Prometheus needed)
    try {
        const data = getRange(windowSeconds);
        res.json({ ...data, source: 'local' });
    } catch (error) {
        console.error('[admin/metrics/range]', error);
        res.status(500).json({ message: 'Failed to compute range data', detail: error.message });
    }
};
