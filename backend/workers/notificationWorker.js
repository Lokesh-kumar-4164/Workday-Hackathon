/**
 * notificationWorker.js
 *
 * BullMQ Worker that processes notification jobs with:
 * - Circuit breaker protection (fail fast when downstream is degraded)
 * - Error classification (transient retry vs permanent unrecoverable failure)
 * - Exponential backoff with random jitter
 * - Idempotency and failure isolation (never crashes the process or affects DB)
 */

import { Worker, UnrecoverableError } from 'bullmq';
import { NOTIFICATION_QUEUE_NAME, getRedisConnection } from '../services/notificationQueue.js';
import { emailCircuitBreaker, CircuitBreakerOpenError } from '../services/circuitBreaker.js';
import { sendEmailNotification, PermanentEmailError, TransientEmailError } from '../services/emailService.js';
import { notificationRetriesTotal } from '../middleware/requestMetrics.js';

let workerInstance = null;

export function startNotificationWorker() {
    if (workerInstance) return workerInstance;

    const baseDelayMs = parseInt(process.env.EMAIL_RETRY_BASE_DELAY_MS, 10) || 1000;
    const maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES, 10) || 3;

    try {
        const connection = getRedisConnection();

        workerInstance = new Worker(
            NOTIFICATION_QUEUE_NAME,
            async (job) => {
                const { userEmail, userName, eventTitle, registrationId, eventId, userId } = job.data;

                console.log(`[NotificationWorker] Processing job ${job.id} (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) for ${userEmail}`);

                const payload = {
                    to: userEmail,
                    subject: `Registration Confirmed: ${eventTitle || 'Your Event'}`,
                    text: `Hello ${userName || 'Attendee'},\n\nYour registration (ID: ${registrationId}) for "${eventTitle || 'Event'}" has been successfully confirmed!\n\nThank you,\nSurgeShield Team`,
                    meta: { registrationId, eventId, userId },
                };

                try {
                    // Wrap downstream call with circuit breaker
                    const result = await emailCircuitBreaker.execute(async () => {
                        return await sendEmailNotification(payload);
                    });

                    console.log(`[NotificationWorker] Notification sent successfully for job ${job.id}`);
                    return result;
                } catch (err) {
                    // 1. Permanent error handling: Abort retries immediately
                    if (err instanceof PermanentEmailError || err.isPermanent) {
                        console.error(`[NotificationWorker] Permanent error encountered for job ${job.id}: ${err.message}. Aborting further retries.`);
                        // BullMQ UnrecoverableError moves job straight to 'failed' without retrying
                        throw new UnrecoverableError(err.message);
                    }

                    // 2. Circuit breaker open error
                    if (err instanceof CircuitBreakerOpenError || err.isCircuitOpen) {
                        console.warn(`[NotificationWorker] Circuit open for job ${job.id}: fast-failing attempt.`);
                    }

                    // 3. Transient error handling: Log and increment retry metric
                    if (job.attemptsMade < job.opts.attempts - 1) {
                        notificationRetriesTotal?.inc();
                    }

                    console.warn(`[NotificationWorker] Temporary failure for job ${job.id} (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}): ${err.message}`);

                    // Re-throw transient error to trigger BullMQ retry backoff
                    throw err;
                }
            },
            {
                connection,
                concurrency: 5,
                settings: {
                    backoffStrategies: {
                        customExponentialWithJitter(attemptsMade, type, err, job) {
                            // Exponential backoff: base * 2^(attemptsMade - 1)
                            const expDelay = Math.pow(2, attemptsMade - 1) * baseDelayMs;
                            // Random jitter: 0 to 500ms
                            const jitter = Math.floor(Math.random() * 500);
                            const totalDelay = expDelay + jitter;

                            console.log(`[Notification] Retry ${attemptsMade}/${maxRetries} scheduled in ${totalDelay}ms (Exponential: ${expDelay}ms + Jitter: ${jitter}ms)`);
                            return totalDelay;
                        },
                    },
                },
            }
        );

        workerInstance.on('completed', (job) => {
            console.log(`[NotificationWorker] Job ${job.id} completed.`);
        });

        workerInstance.on('failed', (job, err) => {
            if (job && job.attemptsMade >= job.opts.attempts) {
                console.error(`[NotificationWorker] Final notification failure for job ${job.id} after ${job.attemptsMade} attempts: ${err.message}`);
            } else if (job && err?.name === 'UnrecoverableError') {
                console.error(`[NotificationWorker] Job ${job.id} marked permanently failed (Unrecoverable): ${err.message}`);
            }
        });

        workerInstance.on('error', (err) => {
            console.warn('[NotificationWorker] Worker error:', err.message);
        });

        console.log('[NotificationWorker] Worker started listening for notification jobs.');
        return workerInstance;
    } catch (err) {
        console.error('[NotificationWorker] Failed to initialize worker:', err.message);
        return null;
    }
}

export async function stopNotificationWorker() {
    if (workerInstance) {
        await workerInstance.close();
        workerInstance = null;
        console.log('[NotificationWorker] Worker stopped gracefully.');
    }
}

// Allow standalone execution: node workers/notificationWorker.js
if (process.argv[1] && (process.argv[1].endsWith('notificationWorker.js') || process.argv[1].includes('notificationWorker'))) {
    console.log('[NotificationWorker] Starting as standalone process...');
    startNotificationWorker();
}

