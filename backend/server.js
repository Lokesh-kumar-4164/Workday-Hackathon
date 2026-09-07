import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import userRoutes from './routes/userApis.js';
import eventRoutes from './routes/eventApis.js';
import adminRoutes from './routes/adminApis.js';
import metricsRoute from './routes/metricsRoute.js';
import downstreamRoutes from './routes/downstreamMockRoutes.js';
import prometheusMetrics from './middleware/requestMetrics.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { startNotificationWorker, stopNotificationWorker } from './workers/notificationWorker.js';

const app = express();
const PORT = process.env.PORT || 5000;
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
    origin: frontendOrigin,
    credentials: true,
}));

// ── Prometheus metrics middleware (must be first — records all routes) ────────
app.use(prometheusMetrics);

// ── Prometheus scrape endpoint (unauthenticated, aggregate counters only) ─────
app.use('/metrics', metricsRoute);

// ── Standard middleware ───────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());

// ── Application routes ────────────────────────────────────────────────────────
app.use('/user', userRoutes);
app.use('/events', eventRoutes);
app.use('/admin', adminRoutes);
app.use('/api/downstream', downstreamRoutes);

const server = app.listen(PORT, () => {
    console.log(` SERVER RUNNING ON PORT ${PORT}`);
    // Start BullMQ background notification worker
    startNotificationWorker();
});

// Graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
    await stopNotificationWorker();
    server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

