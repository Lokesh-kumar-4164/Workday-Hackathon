/**
 * downstreamMockRoutes.js
 *
 * Mock downstream email service simulator for testing:
 *  - Normal 200 OK delivery
 *  - Temporary failures (HTTP 500, 502, 503, 504)
 *  - Permanent failures (HTTP 400, 401, 403)
 *  - Timeouts / hanging responses
 *  - Transient "fail once then recover" simulation
 *  - Recovery simulation
 */

import express from 'express';

const router = express.Router();

let currentMode = 'normal'; // 'normal', '503', '500', '400', 'timeout', 'fail_once'
let callCount = 0;
let failOnceCounter = 0;

export function setMockMode(mode) {
    currentMode = mode;
    failOnceCounter = 0;
}

export function getMockStatus() {
    return { currentMode, callCount, failOnceCounter };
}

// Config endpoint to switch simulation mode on the fly
router.post('/simulate', (req, res) => {
    const { mode } = req.body;
    currentMode = mode || 'normal';
    failOnceCounter = 0;
    console.log(`[DownstreamSimulator] Mode switched to: ${currentMode}`);
    res.json({ success: true, mode: currentMode });
});

router.get('/status', (_req, res) => {
    res.json(getMockStatus());
});

// Downstream email endpoint
router.post('/email', async (req, res) => {
    callCount += 1;
    const effectiveMode = req.headers['x-mock-mode'] || req.body?.meta?.mockMode || currentMode;

    console.log(`[DownstreamSimulator] Received email request #${callCount} (Mode: ${effectiveMode}) for ${req.body?.to}`);

    if (effectiveMode === 'timeout') {
        // Hang longer than timeout (e.g. 10s) to trigger client AbortSignal
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return res.status(200).json({ success: true, messageId: `msg_${Date.now()}` });
    }

    if (effectiveMode === '503') {
        return res.status(503).json({ error: 'Downstream Email Service Temporarily Unavailable' });
    }

    if (effectiveMode === '500') {
        return res.status(500).json({ error: 'Internal Mailer Error' });
    }

    if (effectiveMode === '400') {
        return res.status(400).json({ error: 'Bad Request - Malformed recipient address or unverified domain' });
    }

    if (effectiveMode === 'fail_once') {
        failOnceCounter += 1;
        if (failOnceCounter === 1) {
            console.log('[DownstreamSimulator] fail_once: Intentionally failing first attempt with HTTP 503');
            return res.status(503).json({ error: 'Simulated temporary failure on attempt 1' });
        }
        console.log('[DownstreamSimulator] fail_once: Succeeding on retry attempt!');
        return res.status(200).json({ success: true, messageId: `msg_recovered_${Date.now()}` });
    }

    // Default 'normal' mode: 200 OK
    return res.status(200).json({
        success: true,
        messageId: `msg_${Date.now()}`,
        deliveredAt: new Date().toISOString(),
    });
});

export default router;
