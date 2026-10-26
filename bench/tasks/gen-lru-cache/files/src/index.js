export function identity(value) {
  return value;
}

export function noop() {}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function range(start, end, step = 1) {
  if (step === 0) throw new RangeError("step must not be zero");
  const result = [];
  if (step > 0) {
    for (let value = start; value < end; value += step) result.push(value);
  } else {
    for (let value = start; value > end; value += step) result.push(value);
  }
  return result;
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function chunk(values, size) {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError("size must be positive");
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

export function flatten(values, depth = 1) {
  return depth <= 0 ? [...values] : values.flatMap((value) => (Array.isArray(value) ? flatten(value, depth - 1) : [value]));
}

export function unique(values) {
  return [...new Set(values)];
}

export function groupBy(values, keyFn) {
  const groups = new Map();
  for (const value of values) {
    const key = typeof keyFn === "function" ? keyFn(value) : value[keyFn];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return groups;
}

export function partition(values, predicate) {
  const pass = [];
  const fail = [];
  for (const value of values) (predicate(value) ? pass : fail).push(value);
  return [pass, fail];
}

export function zip(...lists) {
  const length = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length }, (_, index) => lists.map((list) => list[index]));
}

export function compact(values) {
  return values.filter((value) => value !== null && value !== undefined && value !== "");
}

export function sortBy(values, keyFn, direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...values].sort((a, b) => {
    const left = typeof keyFn === "function" ? keyFn(a) : a[keyFn];
    const right = typeof keyFn === "function" ? keyFn(b) : b[keyFn];
    if (left === right) return 0;
    return left < right ? -1 * factor : 1 * factor;
  });
}

export function pluck(values, key) {
  return values.map((value) => value[key]);
}

export function pick(object, keys) {
  const result = {};
  for (const key of keys) {
    if (key in object) result[key] = object[key];
  }
  return result;
}

export function omit(object, keys) {
  const blocked = new Set(keys);
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (!blocked.has(key)) result[key] = value;
  }
  return result;
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(deepClone);
  const result = {};
  for (const [key, entry] of Object.entries(value)) result[key] = deepClone(entry);
  return result;
}

export function merge(target, ...sources) {
  const result = { ...target };
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = merge(result[key], value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export function getPath(object, path, fallback) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let current = object;
  for (const part of parts) {
    if (current === null || current === undefined) return fallback;
    current = current[part];
  }
  return current === undefined ? fallback : current;
}

export function setPath(object, path, value) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let current = object;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!isPlainObject(current[part]) && !Array.isArray(current[part])) current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
  return object;
}

export function defaultTo(value, fallback) {
  return value === null || value === undefined || Number.isNaN(value) ? fallback : value;
}

export function once(fn) {
  let called = false;
  let result;
  return (...args) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
}

export function debounce(fn, wait = 0) {
  let timer = null;
  return (...args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

export function throttle(fn, wait = 0) {
  let last = 0;
  let timer = null;
  let pending = null;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    pending = args;
    if (remaining <= 0) {
      last = now;
      fn(...pending);
      pending = null;
      return;
    }
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...pending);
        pending = null;
      }, remaining);
    }
  };
}

export function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return (...args) => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };
}

export class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  once(event, listener) {
    const wrapped = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  off(event, listener) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit(event, ...args) {
    const set = this.listeners.get(event);
    if (!set) return 0;
    for (const listener of [...set]) listener(...args);
    return set.size;
  }

  listenerCount(event) {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAll(event) {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
  }
}

export class Stack {
  constructor(values = []) {
    this.items = [...values];
  }

  push(value) {
    this.items.push(value);
    return this;
  }

  pop() {
    return this.items.pop();
  }

  peek() {
    return this.items[this.items.length - 1];
  }

  get size() {
    return this.items.length;
  }

  get empty() {
    return this.items.length === 0;
  }

  clear() {
    this.items = [];
  }
}

export class Queue {
  constructor(values = []) {
    this.items = [...values];
    this.head = 0;
  }

  enqueue(value) {
    this.items.push(value);
    return this;
  }

  dequeue() {
    if (this.head >= this.items.length) return undefined;
    const value = this.items[this.head];
    this.head += 1;
    if (this.head > 32 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return value;
  }

  peek() {
    return this.items[this.head];
  }

  get size() {
    return this.items.length - this.head;
  }

  get empty() {
    return this.size === 0;
  }
}

export class Deque {
  constructor(values = []) {
    this.items = [...values];
  }

  pushFront(value) {
    this.items.unshift(value);
    return this;
  }

  pushBack(value) {
    this.items.push(value);
    return this;
  }

  popFront() {
    return this.items.shift();
  }

  popBack() {
    return this.items.pop();
  }

  get size() {
    return this.items.length;
  }

  toArray() {
    return [...this.items];
  }
}

export class Counter {
  constructor() {
    this.counts = new Map();
  }

  add(key, amount = 1) {
    this.counts.set(key, (this.counts.get(key) ?? 0) + amount);
    return this;
  }

  get(key) {
    return this.counts.get(key) ?? 0;
  }

  entries() {
    return [...this.counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  get size() {
    return this.counts.size;
  }
}

export function createIdGenerator(prefix = "id") {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retry(fn, options = {}) {
  const attempts = options.attempts ?? 3;
  const delay = options.delay ?? 0;
  let count = 0;
  return new Promise((resolve, reject) => {
    const run = () => {
      count += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve)
        .catch((error) => {
          if (count >= attempts) reject(error);
          else setTimeout(run, delay);
        });
    };
    run();
  });
}
