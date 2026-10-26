import test from "node:test";
import assert from "node:assert/strict";
import {
  Counter,
  EventEmitter,
  LRUCache,
  Queue,
  Stack,
  clamp,
  deepClone,
  groupBy,
  median,
  range,
} from "../src/index.js";
import { Clock, LinkedMap } from "../src/structures.js";

function clock() {
  let now = 1000;
  return {
    now: () => now,
    set: (value) => {
      now = value;
    },
  };
}

test("値を入れて取り出す", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("missing"), undefined);
});

test("容量を超えたら最も使われていないものを消す", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.size, 2);
});

test("get したものは新しい扱いになる", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
});

test("peek は順番を変えない", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.peek("a"), 1);
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
});

test("has は順番を変えない", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.has("a"), true);
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
});

test("peek と has の missing", () => {
  const cache = new LRUCache(2);
  assert.equal(cache.peek("x"), undefined);
  assert.equal(cache.has("x"), false);
});

test("undefined も保存できる", () => {
  const cache = new LRUCache(2);
  cache.set("u", undefined);
  assert.equal(cache.size, 1);
  assert.equal(cache.has("u"), true);
  assert.equal(cache.peek("u"), undefined);
  assert.equal(cache.get("u"), undefined);
  assert.equal(cache.has("u"), true);
});

test("同じキーの更新は size を増やさない", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("a", 2);
  assert.equal(cache.size, 1);
  assert.equal(cache.get("a"), 2);
});

test("同じキーの更新は最近使った扱いになる", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("a", 3);
  cache.set("c", 4);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 3);
});

test("容量1でも動く", () => {
  const cache = new LRUCache(1);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.size, 1);
});

test("ttlMs を過ぎると期限切れになる", () => {
  const time = clock();
  const cache = new LRUCache(2, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  time.set(1099);
  assert.equal(cache.get("a"), 1);
  time.set(1100);
  assert.equal(cache.get("a"), undefined);
});

test("get では期限を延ばさない", () => {
  const time = clock();
  const cache = new LRUCache(2, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  time.set(1050);
  assert.equal(cache.get("a"), 1);
  time.set(1100);
  assert.equal(cache.get("a"), undefined);
});

test("peek では期限を延ばさない", () => {
  const time = clock();
  const cache = new LRUCache(2, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  time.set(1050);
  assert.equal(cache.peek("a"), 1);
  time.set(1100);
  assert.equal(cache.peek("a"), undefined);
});

test("has では期限を延ばさない", () => {
  const time = clock();
  const cache = new LRUCache(2, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  time.set(1050);
  assert.equal(cache.has("a"), true);
  time.set(1100);
  assert.equal(cache.has("a"), false);
});

test("set し直すと期限が延びる", () => {
  const time = clock();
  const cache = new LRUCache(2, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  time.set(1050);
  cache.set("a", 2);
  time.set(1149);
  assert.equal(cache.get("a"), 2);
  time.set(1150);
  assert.equal(cache.get("a"), undefined);
});

test("ttlMs が0なら期限切れにならない", () => {
  const time = clock();
  const cache = new LRUCache(2, { now: time.now });
  cache.set("a", 1);
  time.set(1000 + 1000 * 60 * 60 * 24 * 365);
  assert.equal(cache.get("a"), 1);
});

test("size を見ると期限切れを取り除く", () => {
  const time = clock();
  const cache = new LRUCache(3, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  cache.set("b", 2);
  time.set(1100);
  assert.equal(cache.size, 0);
});

test("keys を見ると期限切れを取り除く", () => {
  const time = clock();
  const seen = [];
  const cache = new LRUCache(3, {
    ttlMs: 100,
    now: time.now,
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  cache.set("b", 2);
  time.set(1100);
  assert.deepEqual(cache.keys(), []);
  assert.deepEqual(seen, [
    ["a", 1, "expired"],
    ["b", 2, "expired"],
  ]);
});

test("期限切れの項目は容量を占有しない", () => {
  const time = clock();
  const cache = new LRUCache(2, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  cache.set("b", 2);
  time.set(1100);
  cache.set("c", 3);
  cache.set("d", 4);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.get("d"), 4);
});

test("delete と size", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.delete("a"), true);
  assert.equal(cache.delete("a"), false);
  assert.equal(cache.size, 1);
  assert.equal(cache.get("b"), 2);
});

test("期限切れの delete は false", () => {
  const time = clock();
  const seen = [];
  const cache = new LRUCache(2, {
    ttlMs: 100,
    now: time.now,
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  time.set(1100);
  assert.equal(cache.delete("a"), false);
  assert.deepEqual(seen, [["a", 1, "expired"]]);
});

test("clear はすべて消して自身を返す", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.clear(), cache);
  assert.equal(cache.size, 0);
  assert.deepEqual(cache.keys(), []);
});

test("clear は clear の理由で onEvict を呼ぶ", () => {
  const seen = [];
  const cache = new LRUCache(3, {
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.clear();
  assert.deepEqual(seen, [
    ["a", 1, "clear"],
    ["b", 2, "clear"],
  ]);
});

test("空の clear は onEvict を呼ばない", () => {
  let count = 0;
  const cache = new LRUCache(3, { onEvict: () => (count += 1) });
  cache.clear();
  assert.equal(count, 0);
});

test("容量超過の onEvict", () => {
  const seen = [];
  const cache = new LRUCache(2, {
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.deepEqual(seen, [["a", 1, "capacity"]]);
});

test("delete の onEvict", () => {
  const seen = [];
  const cache = new LRUCache(2, {
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  cache.delete("a");
  assert.deepEqual(seen, [["a", 1, "delete"]]);
});

test("期限切れの onEvict", () => {
  const time = clock();
  const seen = [];
  const cache = new LRUCache(2, {
    ttlMs: 100,
    now: time.now,
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  time.set(1100);
  assert.equal(cache.get("a"), undefined);
  assert.deepEqual(seen, [["a", 1, "expired"]]);
});

test("値を置き換えるときは onEvict を呼ばない", () => {
  const seen = [];
  const cache = new LRUCache(2, {
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  cache.set("a", 2);
  assert.deepEqual(seen, []);
});

test("ないキーの delete は onEvict を呼ばない", () => {
  const seen = [];
  const cache = new LRUCache(2, {
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  assert.equal(cache.delete("x"), false);
  assert.deepEqual(seen, []);
});

test("容量内の set は onEvict を呼ばない", () => {
  const seen = [];
  const cache = new LRUCache(3, {
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  cache.set("b", 2);
  assert.deepEqual(seen, []);
});

test("resize で縮小すると古いものから消す", () => {
  const seen = [];
  const cache = new LRUCache(3, {
    onEvict: (key, value, reason) => seen.push([key, value, reason]),
  });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.resize(2), cache);
  assert.equal(cache.capacity, 2);
  assert.deepEqual(cache.keys(), ["b", "c"]);
  assert.deepEqual(seen, [["a", 1, "capacity"]]);
});

test("resize で拡大できる", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.resize(4);
  assert.equal(cache.capacity, 4);
  cache.set("c", 3);
  assert.equal(cache.size, 3);
});

test("resize の不正な容量", () => {
  const cache = new LRUCache(2);
  assert.throws(() => cache.resize(0), RangeError);
  assert.throws(() => cache.resize(-1), RangeError);
  assert.throws(() => cache.resize(1.5), RangeError);
  assert.throws(() => cache.resize("3"), RangeError);
});

test("capacity と ttlMs を読める", () => {
  const cache = new LRUCache(4, { ttlMs: 250 });
  assert.equal(cache.capacity, 4);
  assert.equal(cache.ttlMs, 250);
});

test("keys は古い順", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  cache.get("a");
  assert.deepEqual(cache.keys(), ["b", "c", "a"]);
});

test("values は古い順", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  cache.get("a");
  assert.deepEqual(cache.values(), [2, 3, 1]);
});

test("entries は古い順", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  assert.deepEqual(cache.entries(), [
    ["b", 2],
    ["a", 1],
  ]);
});

test("keys を見ても順番は変わらない", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.keys();
  cache.values();
  cache.entries();
  cache.set("c", 3);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("b"), 2);
});

test("values と entries も期限切れを取り除く", () => {
  const time = clock();
  const cache = new LRUCache(2, { ttlMs: 100, now: time.now });
  cache.set("a", 1);
  cache.set("b", 2);
  time.set(1100);
  assert.deepEqual(cache.values(), []);
  assert.deepEqual(cache.entries(), []);
  assert.equal(cache.size, 0);
});

test("set は自身を返す", () => {
  const cache = new LRUCache(2);
  assert.equal(cache.set("a", 1), cache);
});

test("capacity の検証", () => {
  assert.throws(() => new LRUCache(0), RangeError);
  assert.throws(() => new LRUCache(-1), RangeError);
  assert.throws(() => new LRUCache(1.5), RangeError);
  assert.throws(() => new LRUCache("2"), RangeError);
});

test("ttlMs の検証", () => {
  assert.throws(() => new LRUCache(2, { ttlMs: -1 }), RangeError);
  assert.throws(() => new LRUCache(2, { ttlMs: Number.NaN }), RangeError);
  assert.throws(() => new LRUCache(2, { ttlMs: Number.POSITIVE_INFINITY }), RangeError);
  assert.throws(() => new LRUCache(2, { ttlMs: "10" }), RangeError);
});

test("now と onEvict の型の検証", () => {
  assert.throws(() => new LRUCache(2, { now: 5 }), TypeError);
  assert.throws(() => new LRUCache(2, { now: 5 }), /now/);
  assert.throws(() => new LRUCache(2, { onEvict: 5 }), TypeError);
  assert.throws(() => new LRUCache(2, { onEvict: 5 }), /onEvict/);
});

test("now を省略しても Date.now で動く", () => {
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const cache = new LRUCache(2, { ttlMs: 100 });
    cache.set("a", 1);
    now = 1050;
    assert.equal(cache.get("a"), 1);
    now = 1100;
    assert.equal(cache.get("a"), undefined);
  } finally {
    Date.now = realNow;
  }
});

test("既存の数値と配列の関数", () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.deepEqual(range(0, 6, 2), [0, 2, 4]);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.deepEqual(deepClone({ a: [1, 2] }), { a: [1, 2] });
});

test("既存の groupBy", () => {
  assert.deepEqual([...groupBy([1, 2, 3, 4], (n) => n % 2).keys()], [1, 0]);
});

test("既存の EventEmitter", () => {
  const emitter = new EventEmitter();
  let received = null;
  emitter.on("x", (value) => {
    received = value;
  });
  assert.equal(emitter.emit("x", 3), 1);
  assert.equal(received, 3);
});

test("既存の Stack と Queue と Counter", () => {
  const stack = new Stack([1]);
  stack.push(2);
  assert.equal(stack.pop(), 2);
  const queue = new Queue([1, 2]);
  assert.equal(queue.dequeue(), 1);
  assert.equal(queue.size, 1);
  const counter = new Counter();
  counter.add("a").add("a").add("b");
  assert.equal(counter.get("a"), 2);
});

test("既存の LinkedMap", () => {
  const map = new LinkedMap([
    ["a", 1],
    ["b", 2],
  ]);
  map.moveToEnd("a");
  assert.deepEqual(map.keys(), ["b", "a"]);
  assert.equal(map.firstKey(), "b");
  assert.equal(map.lastKey(), "a");
  assert.deepEqual(map.entries(), [
    ["b", 2],
    ["a", 1],
  ]);
});

test("既存の Clock", () => {
  const clockValue = clock();
  const value = new Clock(clockValue.now);
  assert.equal(value.read(), 1000);
  assert.equal(value.deadline(0), null);
  assert.equal(value.deadline(50), 1050);
  assert.equal(value.expired(1050, 1050), true);
  assert.equal(value.expired(1050, 1049), false);
});
