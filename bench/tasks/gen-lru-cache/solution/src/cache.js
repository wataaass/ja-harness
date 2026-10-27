import { Clock, LinkedMap, isFiniteNumber, isFunction } from "./structures.js";

export class LRUCache {
  #capacity;
  #ttlMs;
  #onEvict;
  #clock;
  #map = new LinkedMap();
  #deadlines = new Map();

  constructor(capacity, options = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive integer");
    }
    const ttlMs = options?.ttlMs ?? 0;
    if (!isFiniteNumber(ttlMs) || ttlMs < 0) {
      throw new RangeError("ttlMs must be a non-negative finite number");
    }
    const onEvict = options?.onEvict;
    if (onEvict !== undefined && !isFunction(onEvict)) {
      throw new TypeError("onEvict must be a function");
    }
    const now = options?.now;
    if (now !== undefined && !isFunction(now)) {
      throw new TypeError("now must be a function");
    }
    this.#capacity = capacity;
    this.#ttlMs = ttlMs;
    this.#onEvict = onEvict;
    this.#clock = new Clock(now ?? (() => Date.now()));
  }

  #deadline() {
    return this.#clock.deadline(this.#ttlMs);
  }

  #remove(key, reason) {
    const value = this.#map.get(key);
    this.#map.delete(key);
    this.#deadlines.delete(key);
    if (this.#onEvict !== undefined) this.#onEvict(key, value, reason);
    return value;
  }

  #prune() {
    const at = this.#clock.read();
    for (const key of this.#map.keys()) {
      const deadline = this.#deadlines.get(key);
      if (deadline !== null && deadline !== undefined && at >= deadline) {
        this.#remove(key, "expired");
      }
    }
  }

  get(key) {
    this.#prune();
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key);
    this.#map.moveToEnd(key);
    return value;
  }

  peek(key) {
    this.#prune();
    return this.#map.get(key);
  }

  has(key) {
    this.#prune();
    return this.#map.has(key);
  }

  set(key, value) {
    this.#prune();
    if (this.#map.has(key)) {
      this.#map.set(key, value);
      this.#map.moveToEnd(key);
    } else {
      this.#map.set(key, value);
    }
    this.#deadlines.set(key, this.#deadline());
    while (this.#map.size > this.#capacity) {
      this.#remove(this.#map.firstKey(), "capacity");
    }
    return this;
  }

  delete(key) {
    this.#prune();
    if (!this.#map.has(key)) return false;
    this.#remove(key, "delete");
    return true;
  }

  clear() {
    this.#prune();
    for (const key of this.#map.keys()) this.#remove(key, "clear");
    return this;
  }

  resize(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive integer");
    }
    this.#capacity = capacity;
    this.#prune();
    while (this.#map.size > this.#capacity) {
      this.#remove(this.#map.firstKey(), "capacity");
    }
    return this;
  }

  get size() {
    this.#prune();
    return this.#map.size;
  }

  get capacity() {
    return this.#capacity;
  }

  get ttlMs() {
    return this.#ttlMs;
  }

  keys() {
    this.#prune();
    return this.#map.keys();
  }

  values() {
    this.#prune();
    return this.#map.values();
  }

  entries() {
    this.#prune();
    return this.#map.entries();
  }
}
