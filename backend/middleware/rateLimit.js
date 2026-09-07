import redis from "../config/redis.js";

const MAX_TOKENS =
    Number(process.env.RATE_LIMIT_MAX_TOKENS) || 10;

const REFILL_RATE =
    Number(process.env.RATE_LIMIT_REFILL_RATE) || 1;


// Atomic Token Bucket Lua script
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]

local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call("HMGET", key, "tokens", "last_refill")

local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

-- First request
if not tokens or not last_refill then
    tokens = max_tokens
    last_refill = now
else
    -- Calculate elapsed time
    local elapsed = math.max(0, now - last_refill)

    -- Refill tokens
    tokens = math.min(
        max_tokens,
        tokens + (elapsed * refill_rate)
    )

    last_refill = now
end

local allowed = 0
local retry_after = 0

-- Token available
if tokens >= 1 then

    tokens = tokens - 1
    allowed = 1

else

    -- No token available
    allowed = 0

    local needed = 1 - tokens

    retry_after = math.ceil(
        needed / refill_rate
    )

    if retry_after < 1 then
        retry_after = 1
    end

end

-- Save state
redis.call(
    "HSET",
    key,
    "tokens",
    tostring(tokens),
    "last_refill",
    tostring(last_refill)
)

-- Expire unused bucket
local ttl = math.ceil(max_tokens / refill_rate) * 2

if ttl < 60 then
    ttl = 60
end

redis.call("EXPIRE", key, ttl)

return {
    allowed,
    math.floor(tokens),
    retry_after
}
`;


export async function rateLimiter(req, res, next) {

    try {

        const ip =
            req.ip ||
            req.socket?.remoteAddress ||
            "unknown";

        const key = `rate_limit:${ip}`;

        // Use milliseconds converted to seconds
        // so refill calculation can be more precise.
        const now = Date.now() / 1000;

        console.log(
            `[RateLimit] ${req.method} ${req.originalUrl} | IP: ${ip}`
        );

        const result = await redis.eval(
            TOKEN_BUCKET_SCRIPT,
            [key],
            [
                String(MAX_TOKENS),
                String(REFILL_RATE),
                String(now)
            ]
        );

        console.log("[RateLimit] Redis result:", result);

        const allowed = Number(result[0]);
        const remaining = Number(result[1]);
        const retryAfter = Number(result[2]);

        // Headers
        res.setHeader(
            "X-RateLimit-Limit",
            String(MAX_TOKENS)
        );

        res.setHeader(
            "X-RateLimit-Remaining",
            String(Math.max(0, remaining))
        );

        // Request allowed
        if (allowed === 1) {

            console.log(
                `[RateLimit] ALLOWED | Remaining: ${remaining}`
            );

            return next();
        }

        // Request blocked
        console.log(
            `[RateLimit] BLOCKED | Retry after: ${retryAfter}s`
        );

        res.setHeader(
            "Retry-After",
            String(retryAfter || 1)
        );

        return res.status(429).json({
            success: false,
            message: "Too many requests. Please try again later."
        });

    } catch (error) {

        console.error(
            "[RateLimit] Redis error:",
            error
        );

        // SurgeShield: fail open
        return next();
    }
}