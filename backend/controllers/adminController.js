import redis from "../config/redis.js";
import { getEffectiveRateLimitConfig } from "../middleware/rateLimit.js";

/**
 * GET /admin/ratelimit/status
 * Provides real-time Redis connectivity, rate limit configuration,
 * aggregate counters, active client token buckets, and recent rate limit logs.
 */
export const getRateLimitStatus = async (req, res) => {
    try {
        const start = Date.now();
        const pong = await redis.ping();
        const pingMs = Date.now() - start;

        const effectiveConfig = await getEffectiveRateLimitConfig();

        // Fetch stats counters
        const [totalStr, allowedStr, blockedStr, rawLogs] = await Promise.all([
            redis.get("ratelimit:stats:total"),
            redis.get("ratelimit:stats:allowed"),
            redis.get("ratelimit:stats:blocked"),
            redis.lrange("ratelimit:logs", 0, 49),
        ]);

        const total = Number(totalStr) || 0;
        const allowed = Number(allowedStr) || 0;
        const blocked = Number(blockedStr) || 0;

        // Parse recent logs
        const recentLogs = (rawLogs || []).map((entry) => {
            try {
                return typeof entry === "string" ? JSON.parse(entry) : entry;
            } catch {
                return null;
            }
        }).filter(Boolean);

        // Fetch active client rate-limiting buckets
        let activeBuckets = [];
        try {
            const keys = await redis.keys("rate_limit:*");
            if (keys && keys.length > 0) {
                // Fetch details for up to 30 most recent buckets
                const sliceKeys = keys.slice(0, 30);
                const bucketPromises = sliceKeys.map(async (key) => {
                    const [data, ttl] = await Promise.all([
                        redis.hgetall(key),
                        redis.ttl(key),
                    ]);
                    const ip = key.replace(/^rate_limit:/, "");
                    const tokens = data?.tokens != null ? Number(data.tokens) : 0;
                    const lastRefill = data?.last_refill ? Number(data.last_refill) : null;
                    return {
                        key,
                        ip,
                        tokens: Math.round(tokens * 10) / 10,
                        maxTokens: effectiveConfig.maxTokens,
                        ttl: ttl > 0 ? ttl : 0,
                        lastRefill,
                        isThrottled: tokens < 1,
                    };
                });
                activeBuckets = await Promise.all(bucketPromises);
            }
        } catch (keyErr) {
            console.error("[RateLimit Status] Error fetching keys:", keyErr);
        }

        res.json({
            connected: pong === "PONG" || !!pong,
            pingMs,
            config: {
                maxTokens: effectiveConfig.maxTokens,
                refillRate: effectiveConfig.refillRate,
            },
            stats: {
                total,
                allowed,
                blocked,
                blockedRate: total > 0 ? Number(((blocked / total) * 100).toFixed(2)) : 0,
            },
            activeBuckets,
            recentLogs,
        });

    } catch (error) {
        console.error("[RateLimit Status] Error:", error);
        res.status(500).json({
            connected: false,
            message: "Failed to connect to Redis rate limiter",
            error: error.message,
        });
    }
};

/**
 * POST /admin/ratelimit/config
 * Dynamically updates rate limit parameters in Redis.
 */
export const updateRateLimitConfig = async (req, res) => {
    try {
        const { maxTokens, refillRate } = req.body;

        const max = Number(maxTokens);
        const refill = Number(refillRate);

        if (isNaN(max) || max < 1 || max > 5000) {
            return res.status(400).json({
                message: "Max tokens must be a number between 1 and 5000.",
            });
        }

        if (isNaN(refill) || refill < 0.1 || refill > 500) {
            return res.status(400).json({
                message: "Refill rate must be a number between 0.1 and 500.",
            });
        }

        await redis.hset("ratelimit:config", {
            maxTokens: String(max),
            refillRate: String(refill),
        });

        res.json({
            success: true,
            message: "Rate limit configuration updated successfully.",
            config: { maxTokens: max, refillRate: refill },
        });

    } catch (error) {
        console.error("[RateLimit Config] Error:", error);
        res.status(500).json({
            message: "Failed to update rate limit configuration",
            error: error.message,
        });
    }
};

/**
 * POST /admin/ratelimit/reset
 * Resets/unblocks an IP or all rate-limiting buckets.
 */
export const resetRateLimit = async (req, res) => {
    try {
        const { ip, all } = req.body;

        if (all) {
            const keys = await redis.keys("rate_limit:*");
            if (keys && keys.length > 0) {
                await Promise.all(keys.map((k) => redis.del(k)));
            }
            return res.json({
                success: true,
                message: `Reset all ${keys ? keys.length : 0} rate limit buckets.`,
            });
        }

        if (!ip) {
            return res.status(400).json({
                message: "Please specify an IP address or pass { all: true }.",
            });
        }

        const key = `rate_limit:${ip}`;
        const deleted = await redis.del(key);

        res.json({
            success: true,
            message: deleted ? `Rate limit reset for ${ip}.` : `No active rate limit bucket found for ${ip}.`,
        });

    } catch (error) {
        console.error("[RateLimit Reset] Error:", error);
        res.status(500).json({
            message: "Failed to reset rate limit",
            error: error.message,
        });
    }
};

/**
 * Legacy getMetrics endpoint (fixed to use @upstash/redis hgetall)
 */
export const getMetrics = async (req, res) => {
    try {
        const metrics = (await redis.hgetall("api:metrics")) || {};

        const total = Number(metrics.total || 0);
        const successful = Number(metrics.successful || 0);
        const clientErrors = Number(metrics.clientErrors || 0);
        const serverErrors = Number(metrics.serverErrors || 0);

        const successRate =
            total > 0
                ? (successful / total) * 100
                : 0;

        res.json({
            total,
            successful,
            clientErrors,
            serverErrors,
            successRate: Number(successRate.toFixed(2)),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch metrics",
        });
    }
};