/**
 * circuitBreaker.js
 *
 * Distributed circuit breaker with local in-memory fallback.
 *
 * States:
 *  - CLOSED: Normal operation.
 *  - OPEN: Downstream is unhealthy. Fast-fails calls without network overhead.
 *  - HALF-OPEN: Cooldown passed. Allows a test request to evaluate recovery.
 */

import redis from '../config/redis.js';
import { circuitBreakerStateGauge } from '../middleware/requestMetrics.js';

export const CircuitState = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF-OPEN',
};

const STATE_NUMERIC = {
    [CircuitState.CLOSED]: 0,
    [CircuitState.HALF_OPEN]: 1,
    [CircuitState.OPEN]: 2,
};

export class CircuitBreakerOpenError extends Error {
    constructor(message = 'Circuit breaker is OPEN - downstream service temporarily unavailable') {
        super(message);
        this.name = 'CircuitBreakerOpenError';
        this.isCircuitOpen = true;
        this.isTransient = true; // Still transient because service will recover after cooldown
    }
}

export class CircuitBreaker {
    constructor(options = {}) {
        this.serviceName = options.serviceName || 'email';
        this.failureThreshold = options.failureThreshold ?? (parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD, 10) || 5);
        this.resetTimeoutMs = options.resetTimeoutMs ?? (parseInt(process.env.CIRCUIT_RESET_TIMEOUT_MS, 10) || 30000);

        // In-memory fallback state
        this.localState = CircuitState.CLOSED;
        this.localFailures = 0;
        this.localOpenedAt = 0;
        this.halfOpenProbeInProgress = false;

        // Redis keys
        this.keyState = `cb:${this.serviceName}:state`;
        this.keyFailures = `cb:${this.serviceName}:failures`;
        this.keyOpenedAt = `cb:${this.serviceName}:opened_at`;

        this.updateGauge(CircuitState.CLOSED);
    }

    updateGauge(state) {
        if (circuitBreakerStateGauge?.set) {
            circuitBreakerStateGauge.set({ service: this.serviceName }, STATE_NUMERIC[state] ?? 0);
        }
    }

    /**
     * Inspect current state (checks Redis first, falls back to memory).
     */
    async getState() {
        try {
            const [redisState, openedAtStr] = await Promise.all([
                redis.get(this.keyState),
                redis.get(this.keyOpenedAt),
            ]);

            const state = redisState || this.localState;
            const openedAt = openedAtStr ? parseInt(openedAtStr, 10) : this.localOpenedAt;

            if (state === CircuitState.OPEN) {
                const now = Date.now();
                if (now - openedAt >= this.resetTimeoutMs) {
                    await this.transitionTo(CircuitState.HALF_OPEN);
                    return CircuitState.HALF_OPEN;
                }
            }

            return state;
        } catch (_) {
            // Redis error -> fallback to local in-memory state
            if (this.localState === CircuitState.OPEN) {
                const now = Date.now();
                if (now - this.localOpenedAt >= this.resetTimeoutMs) {
                    this.localState = CircuitState.HALF_OPEN;
                    console.log(`[CircuitBreaker] HALF-OPEN - testing ${this.serviceName} service (in-memory)`);
                    this.updateGauge(CircuitState.HALF_OPEN);
                    return CircuitState.HALF_OPEN;
                }
            }
            return this.localState;
        }
    }

    /**
     * Transition circuit breaker state.
     */
    async transitionTo(newState) {
        const prevState = this.localState;
        this.localState = newState;
        this.updateGauge(newState);

        const now = Date.now();
        if (newState === CircuitState.OPEN) {
            this.localOpenedAt = now;
            console.warn(`[CircuitBreaker] OPEN - ${this.serviceName} service temporarily unavailable (failures >= ${this.failureThreshold})`);
        } else if (newState === CircuitState.HALF_OPEN) {
            this.halfOpenProbeInProgress = false;
            console.log(`[CircuitBreaker] HALF-OPEN - testing ${this.serviceName} service`);
        } else if (newState === CircuitState.CLOSED) {
            this.localFailures = 0;
            this.halfOpenProbeInProgress = false;
            if (prevState !== CircuitState.CLOSED) {
                console.log(`[CircuitBreaker] CLOSED - ${this.serviceName} service recovered`);
            }
        }

        try {
            const pipeline = [];
            pipeline.push(redis.set(this.keyState, newState));
            if (newState === CircuitState.OPEN) {
                pipeline.push(redis.set(this.keyOpenedAt, String(now)));
                pipeline.push(redis.set(this.keyFailures, String(this.failureThreshold)));
            } else if (newState === CircuitState.CLOSED) {
                pipeline.push(redis.set(this.keyFailures, '0'));
                pipeline.push(redis.del(this.keyOpenedAt));
            }
            await Promise.all(pipeline);
        } catch (_) {
            // Redis unreachable, local state already updated
        }
    }

    /**
     * Record a success. Resets failures and closes circuit if half-open.
     */
    async recordSuccess() {
        const state = await this.getState();
        if (state === CircuitState.HALF_OPEN || state === CircuitState.OPEN) {
            await this.transitionTo(CircuitState.CLOSED);
        } else {
            this.localFailures = 0;
            try {
                await redis.set(this.keyFailures, '0');
            } catch (_) {}
        }
    }

    /**
     * Record a failure.
     */
    async recordFailure(error) {
        const state = await this.getState();

        if (state === CircuitState.HALF_OPEN) {
            // Probe failed, trip back to OPEN immediately
            console.warn(`[CircuitBreaker] HALF-OPEN probe failed (${error?.message}). Returning to OPEN`);
            await this.transitionTo(CircuitState.OPEN);
            return;
        }

        if (state === CircuitState.CLOSED) {
            this.localFailures += 1;
            let currentFailures = this.localFailures;

            try {
                const redisCount = await redis.incr(this.keyFailures);
                // Set TTL of 60 seconds on failure count so stale failures expire
                await redis.expire(this.keyFailures, 60);
                currentFailures = Number(redisCount);
            } catch (_) {}

            console.log(`[CircuitBreaker] Consecutive failures: ${currentFailures}/${this.failureThreshold}`);

            if (currentFailures >= this.failureThreshold) {
                await this.transitionTo(CircuitState.OPEN);
            }
        }
    }

    /**
     * Execute an asynchronous action protected by the circuit breaker.
     *
     * @template T
     * @param {() => Promise<T>} action
     * @returns {Promise<T>}
     */
    async execute(action) {
        const state = await this.getState();

        if (state === CircuitState.OPEN) {
            console.warn(`[CircuitBreaker] OPEN - Fast-failing request to avoid hammering downstream service`);
            throw new CircuitBreakerOpenError();
        }

        if (state === CircuitState.HALF_OPEN) {
            if (this.halfOpenProbeInProgress) {
                // Another probe is already testing the service, fast-fail concurrent attempts
                console.warn(`[CircuitBreaker] HALF-OPEN - Probe already in flight, fast-failing concurrent request`);
                throw new CircuitBreakerOpenError('Circuit breaker is testing downstream recovery (HALF-OPEN probe in progress)');
            }
            this.halfOpenProbeInProgress = true;
        }

        try {
            const result = await action();
            await this.recordSuccess();
            return result;
        } catch (error) {
            // Only transient / downstream errors trip the circuit breaker.
            // Permanent client errors (e.g. invalid email 400) do NOT trip the circuit.
            if (!error.isPermanent) {
                await this.recordFailure(error);
            }
            throw error;
        } finally {
            if (state === CircuitState.HALF_OPEN) {
                this.halfOpenProbeInProgress = false;
            }
        }
    }

    /**
     * Reset breaker to closed state (useful in testing or manual admin intervention).
     */
    async reset() {
        await this.transitionTo(CircuitState.CLOSED);
    }
}

// Export singleton instance for email service
export const emailCircuitBreaker = new CircuitBreaker({ serviceName: 'email' });
