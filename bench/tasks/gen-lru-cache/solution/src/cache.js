export class LRUCache {
  #capacity;
  #ttlMs;
  #entries = new Map();

  constructor(capacity, options = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive integer");
    }
    const ttlMs = options.ttlMs ?? 0;
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new RangeError("ttlMs must be a non-negative number");
    }
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
  }

  #expired(entry) {
    return entry.expiresAt !== null && Date.now() >= entry.expiresAt;
  }

  #prune() {
    for (const [key, entry] of this.#entries) {
      if (this.#expired(entry)) this.#entries.delete(key);
    }
  }

  get(key) {
    this.#prune();
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.#prune();
    this.#entries.delete(key);
    const expiresAt = this.#ttlMs > 0 ? Date.now() + this.#ttlMs : null;
    this.#entries.set(key, { value, expiresAt });
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value;
      this.#entries.delete(oldest);
    }
    return this;
  }

  delete(key) {
    this.#prune();
    return this.#entries.delete(key);
  }

  has(key) {
    this.#prune();
    return this.#entries.has(key);
  }

  get size() {
    this.#prune();
    return this.#entries.size;
  }

  clear() {
    this.#entries.clear();
  }

  keys() {
    this.#prune();
    return [...this.#entries.keys()];
  }
}
