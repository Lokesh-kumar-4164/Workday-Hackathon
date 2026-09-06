import redis from "../config/redis.js";

export const getMetrics = async (req, res) => {
    try {
        const metrics = await redis.hGetAll("api:metrics");

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