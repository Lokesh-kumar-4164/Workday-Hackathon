import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import userRoutes from './routes/userApis.js';
import eventRoutes from './routes/eventApis.js';

const app = express();
const PORT = process.env.PORT || 5000;
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
    origin: frontendOrigin,
    credentials: true,
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());

app.use('/user', userRoutes);
app.use('/events', eventRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
