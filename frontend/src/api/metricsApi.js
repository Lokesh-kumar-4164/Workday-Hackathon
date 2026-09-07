import api from './setup';

/**
 * Fetch instant summary metrics for the admin dashboard stat cards.
 * @returns {Promise<{
 *   requestsPerSec: number|null,
 *   avgLatencyMs: number|null,
 *   p95LatencyMs: number|null,
 *   errorRate: number|null,
 *   fourxxPerSec: number|null,
 *   fivexxPerSec: number|null,
 *   activeInstances: number|null,
 * }>}
 */
export const fetchMetricsSummary = async () => {
    const { data } = await api.get('/admin/metrics/summary');
    return data;
};

/**
 * Fetch time-series metrics for the admin dashboard charts.
 * @param {number} [windowSeconds=3600]  Look-back window
 * @param {string} [step='15s']          Resolution step
 * @returns {Promise<{
 *   requestRate:  Array<{label:string, values:{t:number,v:number}[]}>,
 *   latencyMs:    Array<{label:string, values:{t:number,v:number}[]}>,
 *   errorRate:    Array<{label:string, values:{t:number,v:number}[]}>,
 *   byInstance:   Array<{label:string, values:{t:number,v:number}[]}>,
 * }>}
 */
export const fetchMetricsRange = async (windowSeconds = 3600, step = '15s') => {
    const { data } = await api.get('/admin/metrics/range', {
        params: { window: windowSeconds, step },
    });
    return data;
};

/**
 * Fetch Redis rate limiter real-time status, health, active buckets, and stats.
 */
export const fetchRateLimitStatusApi = async () => {
    const { data } = await api.get('/admin/ratelimit/status');
    return data;
};

/**
 * Update Redis rate limiter configuration.
 * @param {{ maxTokens: number, refillRate: number }} config
 */
export const updateRateLimitConfigApi = async (config) => {
    const { data } = await api.post('/admin/ratelimit/config', config);
    return data;
};

/**
 * Reset an IP's rate limit bucket or all buckets.
 * @param {string|null} ip
 * @param {boolean} [all=false]
 */
export const resetRateLimitApi = async (ip = null, all = false) => {
    const { data } = await api.post('/admin/ratelimit/reset', { ip, all });
    return data;
};
