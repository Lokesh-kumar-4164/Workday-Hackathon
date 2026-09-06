import express from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

const router = express.Router();

// Collect Node.js runtime metrics (event loop lag, heap, GC, etc.) once.
const DEFAULT_METRICS_KEY = Symbol.for('prom_default_metrics_init');
if (!global[DEFAULT_METRICS_KEY]) {
    global[DEFAULT_METRICS_KEY] = true;
    collectDefaultMetrics({ register });
}

/**
 * GET /metrics
 * Standard Prometheus scrape endpoint. No authentication — Prometheus scrapes
 * this directly. Only aggregate counters are exposed; no PII.
 */
router.get('/', async (_req, res) => {
    try {
        const metrics = await register.metrics();
        res.set('Content-Type', register.contentType);
        res.end(metrics);
    } catch (err) {
        console.error('[metrics route] Failed to collect metrics:', err);
        res.status(500).end('# metrics collection error\n');
    }
});

export default router;
