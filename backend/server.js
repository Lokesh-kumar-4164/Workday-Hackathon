import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import userRoutes from './routes/userApis.js';
import eventRoutes from './routes/eventApis.js';
import adminRoutes from './routes/adminApis.js';
import metricsRoute from './routes/metricsRoute.js';
import prometheusMetrics from './middleware/requestMetrics.js';

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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
