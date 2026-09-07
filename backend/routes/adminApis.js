import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getMetricsSummary, getMetricsRange } from '../controllers/prometheusController.js';
import {
    getRateLimitStatus,
    updateRateLimitConfig,
    resetRateLimit,
    getMetrics,
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication + admin role.
router.use(requireAuth, requireAdmin);

/**
 * GET /admin/metrics/summary
 * Instant Prometheus metrics for dashboard stat cards.
 */
router.get('/metrics/summary', getMetricsSummary);

/**
 * GET /admin/metrics/range
 * Range query for chart time-series.
 * Query params: window (seconds, default 3600), step (default "15s")
 */
router.get('/metrics/range', getMetricsRange);

/**
 * Rate Limiter Endpoints
 */
router.get('/ratelimit/status', getRateLimitStatus);
router.post('/ratelimit/config', updateRateLimitConfig);
router.post('/ratelimit/reset', resetRateLimit);

// Legacy metrics endpoint
router.get('/metrics', getMetrics);

export default router;
