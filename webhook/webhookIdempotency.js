"use strict";

class WebhookIdempotencyStore {
  constructor({ ttlMs = 10 * 60 * 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.processed = new Map();
  }

  has(key) {
    this.gc();
    return this.processed.has(key);
  }

  mark(key) {
    this.processed.set(key, Date.now() + this.ttlMs);
  }

  gc() {
    const now = Date.now();
    for (const [key, expiry] of this.processed.entries()) {
      if (expiry <= now) {
        this.processed.delete(key);
      }
    }
  }
}

module.exports = {
  WebhookIdempotencyStore,
};
