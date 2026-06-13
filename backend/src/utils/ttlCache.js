/**
 * Minimal in-memory TTL cache. Single-process by design — if the app ever
 * runs multiple instances, replace with Redis.
 */
export class TTLCache {
  constructor(ttlMs = 30000) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(String(key));
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(String(key));
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    this.store.set(String(key), { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key) {
    this.store.delete(String(key));
  }
}

// Dashboard payloads, keyed by projectId. Invalidated on every
// knowledge-graph mutation and on ProjectState recompute.
export const dashboardCache = new TTLCache(30000);
