/**
 * bullmqE2E.test.js
 *
 * End-to-end test for BullMQ queue, worker, circuit breaker, and downstream email.
 */

import 'dotenv/config';
import http from 'http';
import express from 'express';
import { enqueueRegistrationNotification, notificationQueue } from '../services/notificationQueue.js';
import { startNotificationWorker, stopNotificationWorker } from '../workers/notificationWorker.js';

let mockServer;
const port = 4998;

function startMockServer() {
    return new Promise((resolve) => {
        const app = express();
        app.use(express.json());
        app.post('/api/downstream/email', (req, res) => {
            console.log('[E2E Mock Server] Received notification for:', req.body.to);
            res.json({ success: true, messageId: `msg_${Date.now()}` });
        });
        mockServer = http.createServer(app);
        mockServer.listen(port, resolve);
    });
}

async function runE2E() {
    console.log('\n--- Running BullMQ End-to-End Test ---');
    process.env.EMAIL_SERVICE_URL = `http://localhost:${port}/api/downstream/email`;

    await startMockServer();
    const worker = startNotificationWorker();

    try {
        const testJobData = {
            registrationId: 8888,
            userId: 42,
            eventId: 101,
            userEmail: 'hackathon-winner@example.com',
            userName: 'Hackathon Champion',
            eventTitle: 'SurgeShield Hackathon Finale',
        };

        const enqueued = await enqueueRegistrationNotification(testJobData);
        if (!enqueued) throw new Error('Enqueue failed');
        console.log('Job enqueued successfully. Waiting for worker to process...');

        // Wait up to 10 seconds for worker to process job
        let completed = false;
        for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 500));
            const job = await notificationQueue.getJob(`email-reg-8888`);
            if (job) {
                const state = await job.getState();
                console.log(`Job state: ${state}`);
                if (state === 'completed') {
                    completed = true;
                    break;
                }
            }
        }

        if (!completed) {
            throw new Error('Worker did not complete job in time');
        }

        console.log('PASSED: BullMQ worker successfully processed registration email job!');
        process.exit(0);
    } finally {
        await stopNotificationWorker();
        await new Promise((r) => mockServer.close(r));
        await notificationQueue.close();
    }
}

runE2E().catch((err) => {
    console.error('E2E Test Failed:', err);
    process.exit(1);
});
