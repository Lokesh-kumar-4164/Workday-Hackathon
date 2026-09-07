/**
 * emailService.js
 *
 * Client for downstream notification/email service with:
 * - Configurable timeout (AbortSignal)
 * - Explicit error classification: Transient vs Permanent
 * - Prometheus metrics recording
 * - Structured operational logging (no sensitive credentials logged)
 */

import {
    notificationAttemptsTotal,
    notificationSuccessTotal,
    notificationFailuresTotal,
    notificationTimeoutsTotal,
    downstreamEmailLatencySeconds,
} from '../middleware/requestMetrics.js';

export class TransientEmailError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'TransientEmailError';
        this.isTransient = true;
        this.cause = cause;
    }
}

export class PermanentEmailError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'PermanentEmailError';
        this.isPermanent = true;
        this.cause = cause;
    }
}

/**
 * Validate email payload before dispatching.
 */
function validateEmailPayload(payload) {
    if (!payload) throw new PermanentEmailError('Email payload is required.');
    if (!payload.to || typeof payload.to !== 'string' || !payload.to.includes('@')) {
        throw new PermanentEmailError(`Invalid email address: ${payload?.to}`);
    }
    if (!payload.subject || typeof payload.subject !== 'string') {
        throw new PermanentEmailError('Email subject is required.');
    }
}

/**
 * Send an email notification to the downstream email service.
 *
 * @param {Object} payload
 * @param {string} payload.to - Recipient email address
 * @param {string} payload.subject - Email subject
 * @param {string} payload.text - Email plain text content
 * @param {Object} [payload.meta] - Metadata (eventId, userId, registrationId)
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export async function sendEmailNotification(payload) {
    const timeoutMs = parseInt(process.env.EMAIL_SERVICE_TIMEOUT_MS, 10) || 5000;
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:4001/api/downstream/email';

    // 1. Validate payload upfront to avoid wasteful network requests
    validateEmailPayload(payload);

    console.log(`[Notification] Sending email to ${payload.to} (Timeout: ${timeoutMs}ms)`);
    notificationAttemptsTotal?.inc();

    const startTime = process.hrtime.bigint();

    try {
        const response = await fetch(emailServiceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SurgeShield-Worker/1.0',
            },
            body: JSON.stringify({
                to: payload.to,
                subject: payload.subject,
                text: payload.text,
                meta: payload.meta || {},
            }),
            signal: AbortSignal.timeout(timeoutMs),
        });

        const elapsedSec = Number(process.hrtime.bigint() - startTime) / 1e9;
        downstreamEmailLatencySeconds?.observe(elapsedSec);

        // Check response status
        if (response.ok) {
            const data = await response.json().catch(() => ({}));
            console.log(`[Notification] Email delivered successfully to ${payload.to} in ${(elapsedSec * 1000).toFixed(1)}ms`);
            notificationSuccessTotal?.inc();
            return { success: true, messageId: data.messageId || 'ok' };
        }

        const status = response.status;
        const errBody = await response.text().catch(() => '');

        // 2. Classify HTTP status codes
        if (status === 400 || status === 401 || status === 403 || status === 422) {
            console.error(`[Notification] Permanent error from email service: HTTP ${status} - ${errBody}`);
            notificationFailuresTotal?.inc({ reason: 'permanent' });
            throw new PermanentEmailError(`Downstream permanent failure: HTTP ${status} - ${errBody}`);
        }

        if (status === 500 || status === 502 || status === 503 || status === 504 || status === 429) {
            console.warn(`[Notification] Temporary error from email service: HTTP ${status} - ${errBody}`);
            notificationFailuresTotal?.inc({ reason: 'transient_http' });
            throw new TransientEmailError(`Downstream transient failure: HTTP ${status}`);
        }

        // Other unexpected HTTP codes treated as transient
        notificationFailuresTotal?.inc({ reason: 'unexpected_http' });
        throw new TransientEmailError(`Downstream unexpected HTTP status: ${status}`);
    } catch (error) {
        const elapsedSec = Number(process.hrtime.bigint() - startTime) / 1e9;
        downstreamEmailLatencySeconds?.observe(elapsedSec);

        if (error instanceof PermanentEmailError) {
            throw error;
        }

        if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
            console.error(`[Notification] Email service timeout after ${timeoutMs}ms for ${payload.to}`);
            notificationTimeoutsTotal?.inc();
            notificationFailuresTotal?.inc({ reason: 'timeout' });
            throw new TransientEmailError(`Downstream request timed out after ${timeoutMs}ms`, error);
        }

        if (error instanceof TransientEmailError) {
            throw error;
        }

        // Network / socket connection errors
        const isNetworkError =
            error.code === 'ECONNREFUSED' ||
            error.code === 'ECONNRESET' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('fetch failed');

        if (isNetworkError) {
            console.warn(`[Notification] Network/connection error: ${error.message}`);
            notificationFailuresTotal?.inc({ reason: 'network' });
            throw new TransientEmailError(`Downstream network error: ${error.message}`, error);
        }

        // Generic fallback error
        console.error(`[Notification] Unexpected error: ${error.message}`);
        notificationFailuresTotal?.inc({ reason: 'unknown' });
        throw new TransientEmailError(`Downstream error: ${error.message}`, error);
    }
}
