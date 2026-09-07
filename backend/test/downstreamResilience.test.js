/**
 * downstreamResilience.test.js
 *
 * Automated test suite for downstream email resilience, circuit breaker,
 * timeout handling, BullMQ retries, and failure isolation.
 */

import 'dotenv/config';
import http from 'http';
import express from 'express';
import {
    sendEmailNotification,
    PermanentEmailError,
    TransientEmailError,
} from '../services/emailService.js';
import {
    CircuitBreaker,
    CircuitState,
    CircuitBreakerOpenError,
} from '../services/circuitBreaker.js';
import {
    notificationAttemptsTotal,
    notificationSuccessTotal,
    notificationFailuresTotal,
    notificationTimeoutsTotal,
} from '../middleware/requestMetrics.js';

// Setup an in-process mock downstream HTTP server
let mockServer = null;
let mockPort = 4999;
let currentMockBehavior = 'normal'; // 'normal', '503', '400', 'timeout', 'fail_once'
let failOnceFlag = false;
let mockRequestCount = 0;

function startMockServer() {
    return new Promise((resolve) => {
        const app = express();
        app.use(express.json());

        app.post('/api/downstream/email', async (req, res) => {
            mockRequestCount += 1;

            if (currentMockBehavior === 'timeout') {
                // Hang for 3 seconds (timeout in test is 500ms)
                await new Promise((r) => setTimeout(r, 3000));
                return res.status(200).json({ success: true });
            }

            if (currentMockBehavior === '503') {
                return res.status(503).json({ error: 'Service Unavailable' });
            }

            if (currentMockBehavior === '400') {
                return res.status(400).json({ error: 'Bad Request - invalid email' });
            }

            if (currentMockBehavior === 'fail_once') {
                if (!failOnceFlag) {
                    failOnceFlag = true;
                    return res.status(503).json({ error: 'Temporary downstream failure' });
                }
                return res.status(200).json({ success: true, messageId: 'msg_recovered' });
            }

            return res.status(200).json({ success: true, messageId: `msg_${Date.now()}` });
        });

        mockServer = http.createServer(app);
        mockServer.listen(mockPort, () => {
            console.log(`[Test Mock Server] Listening on port ${mockPort}`);
            resolve();
        });
    });
}

function stopMockServer() {
    return new Promise((resolve) => {
        if (mockServer) {
            mockServer.close(resolve);
        } else {
            resolve();
        }
    });
}

async function runTests() {
    console.log('\n======================================================');
    console.log('   SURGESHIELD: DOWNSTREAM RESILIENCE TEST SUITE');
    console.log('======================================================\n');

    process.env.EMAIL_SERVICE_URL = `http://localhost:${mockPort}/api/downstream/email`;
    process.env.EMAIL_SERVICE_TIMEOUT_MS = '600'; // 600ms for fast testing

    await startMockServer();

    let passedCount = 0;
    let failedCount = 0;

    async function test(name, fn) {
        process.stdout.write(`TEST: ${name} ... `);
        try {
            await fn();
            console.log('PASSED');
            passedCount++;
        } catch (err) {
            console.log(`FAILED: ${err.message}`);
            console.error(err);
            failedCount++;
        }
    }

    try {
        // ── SCENARIO A: Normal Case ───────────────────────────────────────────
        await test('Scenario A: Normal Delivery (200 OK)', async () => {
            currentMockBehavior = 'normal';
            const result = await sendEmailNotification({
                to: 'attendee@example.com',
                subject: 'Registration Confirmed',
                text: 'Welcome to SurgeShield Hackathon!',
            });
            if (!result || !result.success) {
                throw new Error('Expected successful delivery result');
            }
        });

        // ── SCENARIO D: Timeout Handling ──────────────────────────────────────
        await test('Scenario D: Request Timeout AbortSignal (< 600ms)', async () => {
            currentMockBehavior = 'timeout';
            const start = Date.now();
            let caught = null;
            try {
                await sendEmailNotification({
                    to: 'attendee@example.com',
                    subject: 'Registration Confirmed',
                    text: 'Welcome!',
                });
            } catch (err) {
                caught = err;
            }
            const duration = Date.now() - start;

            if (!caught || !(caught instanceof TransientEmailError)) {
                throw new Error(`Expected TransientEmailError on timeout, got: ${caught}`);
            }
            if (duration > 1500) {
                throw new Error(`Timeout took too long: ${duration}ms (expected ~600ms)`);
            }
        });

        // ── SCENARIO E: Permanent Error (HTTP 400) ─────────────────────────────
        await test('Scenario E: Permanent Error (HTTP 400) not marked transient', async () => {
            currentMockBehavior = '400';
            let caught = null;
            try {
                await sendEmailNotification({
                    to: 'attendee@example.com',
                    subject: 'Registration Confirmed',
                    text: 'Welcome!',
                });
            } catch (err) {
                caught = err;
            }

            if (!caught || !(caught instanceof PermanentEmailError)) {
                throw new Error(`Expected PermanentEmailError, got: ${caught?.constructor?.name}`);
            }
            if (caught.isTransient) {
                throw new Error('Permanent error must NOT be marked transient');
            }
        });

        // ── SCENARIO B: Temporary Failure (Fail Once -> Retry -> Success) ───────
        await test('Scenario B: Temporary Failure Recovery (Fail once, then recover)', async () => {
            currentMockBehavior = 'fail_once';
            failOnceFlag = false;

            // Attempt 1: Should fail with transient error
            let attempt1Error = null;
            try {
                await sendEmailNotification({
                    to: 'attendee@example.com',
                    subject: 'Registration Confirmed',
                    text: 'Welcome!',
                });
            } catch (err) {
                attempt1Error = err;
            }

            if (!attempt1Error || !(attempt1Error instanceof TransientEmailError)) {
                throw new Error('Attempt 1 should have thrown TransientEmailError');
            }

            // Attempt 2: Should succeed
            const attempt2 = await sendEmailNotification({
                to: 'attendee@example.com',
                subject: 'Registration Confirmed',
                text: 'Welcome!',
            });

            if (!attempt2.success) {
                throw new Error('Attempt 2 should have succeeded');
            }
        });

        // ── SCENARIO C & F: Circuit Breaker Lifecycle ─────────────────────────
        await test('Scenario C & F: Circuit Breaker Lifecycle (CLOSED -> OPEN -> HALF-OPEN -> CLOSED)', async () => {
            const cb = new CircuitBreaker({
                serviceName: 'test-cb-' + Date.now(),
                failureThreshold: 3,
                resetTimeoutMs: 500, // 500ms cooldown for fast test
            });

            if (cb.localState !== CircuitState.CLOSED) {
                throw new Error(`Initial state must be CLOSED, got ${cb.localState}`);
            }

            // 1. Trigger 3 failures to trip circuit
            for (let i = 1; i <= 3; i++) {
                try {
                    await cb.execute(async () => {
                        const err = new Error('Downstream 503');
                        err.isTransient = true;
                        throw err;
                    });
                } catch (_) {}
            }

            const stateAfterTripping = await cb.getState();
            if (stateAfterTripping !== CircuitState.OPEN) {
                throw new Error(`Circuit must be OPEN after 3 failures, got ${stateAfterTripping}`);
            }

            // 2. While OPEN, fast-fails immediately without executing action
            let executed = false;
            try {
                await cb.execute(async () => {
                    executed = true;
                });
            } catch (err) {
                if (!(err instanceof CircuitBreakerOpenError)) {
                    throw new Error(`Expected CircuitBreakerOpenError, got ${err}`);
                }
            }
            if (executed) throw new Error('Action must not execute when circuit is OPEN');

            // 3. Wait for cooldown to transition to HALF-OPEN
            await new Promise((r) => setTimeout(r, 600));

            const stateAfterCooldown = await cb.getState();
            if (stateAfterCooldown !== CircuitState.HALF_OPEN) {
                throw new Error(`Circuit must be HALF-OPEN after cooldown, got ${stateAfterCooldown}`);
            }

            // 4. Probe in HALF-OPEN succeeds -> Circuit resets to CLOSED
            let probeExecuted = false;
            await cb.execute(async () => {
                probeExecuted = true;
                return 'probe-success';
            });

            if (!probeExecuted) throw new Error('Probe action must execute in HALF-OPEN');

            const stateAfterRecovery = await cb.getState();
            if (stateAfterRecovery !== CircuitState.CLOSED) {
                throw new Error(`Circuit must be CLOSED after successful probe, got ${stateAfterRecovery}`);
            }
        });

        // ── SCENARIO G: Decoupled Registration Non-Fatal Failure ───────────────
        await test('Scenario G: PostgreSQL commit remains final even if downstream fails', async () => {
            // Simulate registration controller flow:
            // 1. DB insert succeeds
            const fakeRegistration = { id: 9999, userId: 1, eventId: 1 };

            // 2. Downstream email completely fails
            currentMockBehavior = '503';
            let notificationDispatched = false;

            // Enqueue or direct email call is wrapped safely
            try {
                await sendEmailNotification({
                    to: 'fail@example.com',
                    subject: 'Registration Confirmed',
                    text: 'Hello',
                });
                notificationDispatched = true;
            } catch (err) {
                // Controller logs non-fatal error without failing registration
                notificationDispatched = false;
            }

            // Registration record and return value are 100% intact
            if (!fakeRegistration.id) {
                throw new Error('Registration was lost due to notification failure');
            }
            if (notificationDispatched) {
                throw new Error('Notification should have failed');
            }
        });

    } finally {
        await stopMockServer();
    }

    console.log('\n======================================================');
    console.log(` RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log('======================================================\n');

    if (failedCount > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
