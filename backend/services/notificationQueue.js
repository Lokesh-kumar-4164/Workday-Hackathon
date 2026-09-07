/**
 * notificationQueue.js
 *
 * BullMQ queue configuration for downstream notifications with:
 * - Redis connection resolution (Upstash TLS / local Redis / custom REDIS_URL)
 * - Safe fail-open enqueueing (queue unavailability never fails HTTP registration)
 * - Idempotent job IDs preventing duplicate notification enqueueing
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let redisConnection = null;

export function getRedisConnection() {
    if (redisConnection) return redisConnection;

    if (process.env.REDIS_URL) {
        redisConnection = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
        return redisConnection;
    }

    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (restUrl && token) {
        try {
            const host = new URL(restUrl).hostname;
            redisConnection = new IORedis(`rediss://default:${token}@${host}:6379`, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            });
            return redisConnection;
        } catch (err) {
            console.warn('[Queue] Failed to parse Upstash Redis URL, falling back to local:', err.message);
        }
    }

    redisConnection = new IORedis('redis://127.0.0.1:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
    return redisConnection;
}

export const NOTIFICATION_QUEUE_NAME = 'notification-queue';

let notificationQueue = null;

try {
    const connection = getRedisConnection();
    notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
            removeOnComplete: { age: 3600, count: 500 },
            removeOnFail: { age: 86400, count: 1000 },
        },
    });

    notificationQueue.on('error', (err) => {
        console.warn('[NotificationQueue] Redis connection issue:', err.message);
    });
} catch (err) {
    console.error('[NotificationQueue] Failed to initialize BullMQ queue:', err.message);
}

/**
 * Enqueue an event registration notification job.
 *
 * CRITICAL: This is fire-and-forget and safe. Even if Redis or BullMQ fails,
 * this function logs the error and resolves WITHOUT throwing, guaranteeing
 * that event registration remains 100% successful for the user.
 *
 * @param {Object} jobData
 * @param {number} jobData.registrationId
 * @param {number} jobData.userId
 * @param {number} jobData.eventId
 * @param {string} jobData.userEmail
 * @param {string} [jobData.userName]
 * @param {string} [jobData.eventTitle]
 * @returns {Promise<boolean>} True if enqueued, false if queued failed
 */
export async function enqueueRegistrationNotification(jobData) {
    const maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES, 10) || 3;
    const baseDelayMs = parseInt(process.env.EMAIL_RETRY_BASE_DELAY_MS, 10) || 1000;

    // Deterministic job ID ensures idempotency — retries or rapid duplicate calls
    // cannot enqueue duplicate jobs for the same registration ID
    const jobId = `email-reg-${jobData.registrationId || `${jobData.userId}-${jobData.eventId}`}`;

    try {
        if (!notificationQueue) {
            console.warn(`[NotificationQueue] Queue not available, skipped enqueue for job ${jobId}`);
            return false;
        }

        await notificationQueue.add(
            'sendRegistrationEmail',
            {
                ...jobData,
                enqueuedAt: Date.now(),
            },
            {
                jobId,
                attempts: maxRetries + 1, // initial attempt + retries
                backoff: {
                    type: 'customExponentialWithJitter',
                    delay: baseDelayMs,
                },
            }
        );

        console.log(`[NotificationQueue] Enqueued email job ${jobId} for ${jobData.userEmail}`);
        return true;
    } catch (err) {
        // Safe fail-open: Never throw error to caller (registration must not fail)
        console.error(`[NotificationQueue] Failed to enqueue notification for registration ${jobData.registrationId}:`, err.message);
        return false;
    }
}

export { notificationQueue };
