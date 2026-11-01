/**
 * In-memory token buckets keyed by string. Single-process service, so memory is the
 * right store; entries idle for 10 minutes are swept.
 */
export class RateLimiter {
    /**
     * @param {number} capacity burst size
     * @param {number} refillPerSec tokens added per second
     */
    constructor (capacity, refillPerSec) {
        this.capacity = capacity;
        this.refillPerSec = refillPerSec;
        this.buckets = new Map();
    }

    /** @returns {{allowed: boolean, retryAfterSec: number}} */
    take (key, now = Date.now()) {
        let b = this.buckets.get(key);
        if (!b) {
            b = {tokens: this.capacity, at: now};
            this.buckets.set(key, b);
        }
        const elapsed = Math.max(0, now - b.at) / 1000;
        b.tokens = Math.min(this.capacity, b.tokens + (elapsed * this.refillPerSec));
        b.at = now;
        if (b.tokens >= 1) {
            b.tokens -= 1;
            return {allowed: true, retryAfterSec: 0};
        }
        const retryAfterSec = Math.ceil((1 - b.tokens) / this.refillPerSec);
        return {allowed: false, retryAfterSec};
    }

    sweep (now = Date.now()) {
        for (const [key, b] of this.buckets) {
            if (now - b.at > 10 * 60 * 1000) {
                this.buckets.delete(key);
            }
        }
    }
}
