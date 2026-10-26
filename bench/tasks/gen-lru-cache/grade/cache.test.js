import test from "node:test";
import assert from "node:assert/strict";
import * as toolkit from "../src/index.js";

const LRUCache = toolkit.LRUCache ?? class {
  constructor() {
    throw new Error("LRUCache が index.js から export されていません");
  }
};

test("値を入れて取り出す", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 0);
  cache.set("c", null);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("b"), 0);
  assert.equal(cache.get("c"), null);
  assert.equal(cache.get("missing"), undefined);
  assert.equal(cache.size, 3);
});

test("容量を超えたら最も古いものを消す", () => {
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
  assert.equal(cache.get("a"), 1);
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
});

test("同じキーの更新は size を増やさず、新しい扱いになる", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("a", 10);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("a"), 10);
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 10);
  assert.equal(cache.get("c"), 3);
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

test("容量1でも動く", () => {
  const cache = new LRUCache(1);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.size, 1);
});

test("ttlMs を過ぎると期限切れになる", () => {
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const cache = new LRUCache(2, { ttlMs: 100 });
    cache.set("a", 1);
    now = 1050;
    assert.equal(cache.get("a"), 1);
    now = 1101;
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.size, 0);
  } finally {
    Date.now = realNow;
  }
});

test("get では期限を延ばさない", () => {
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const cache = new LRUCache(2, { ttlMs: 100 });
    cache.set("a", 1);
    now = 1050;
    assert.equal(cache.get("a"), 1);
    now = 1101;
    assert.equal(cache.get("a"), undefined);
  } finally {
    Date.now = realNow;
  }
});

test("set し直すと期限が延びる", () => {
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const cache = new LRUCache(2, { ttlMs: 100 });
    cache.set("a", 1);
    now = 1050;
    cache.set("a", 2);
    now = 1120;
    assert.equal(cache.get("a"), 2);
    now = 1151;
    assert.equal(cache.get("a"), undefined);
  } finally {
    Date.now = realNow;
  }
});

test("size を見ると期限切れを取り除く", () => {
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const cache = new LRUCache(3, { ttlMs: 100 });
    cache.set("a", 1);
    cache.set("b", 2);
    now = 1101;
    assert.equal(cache.size, 0);
  } finally {
    Date.now = realNow;
  }
});

test("ttlMs が0なら期限切れにならない", () => {
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const cache = new LRUCache(2);
    cache.set("a", 1);
    now = 1000 + 1000 * 60 * 60 * 24 * 365;
    assert.equal(cache.get("a"), 1);
  } finally {
    Date.now = realNow;
  }
});

test("期限切れの項目は容量を占有しない", () => {
  const realNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const cache = new LRUCache(2, { ttlMs: 100 });
    cache.set("a", 1);
    cache.set("b", 2);
    now = 1101;
    cache.set("c", 3);
    cache.set("d", 4);
    assert.equal(cache.size, 2);
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.get("b"), undefined);
    assert.equal(cache.get("c"), 3);
    assert.equal(cache.get("d"), 4);
  } finally {
    Date.now = realNow;
  }
});

test("容量と ttlMs の検証", () => {
  assert.throws(() => new LRUCache(0), RangeError);
  assert.throws(() => new LRUCache(-1), RangeError);
  assert.throws(() => new LRUCache(1.5), RangeError);
  assert.throws(() => new LRUCache("2"), RangeError);
  assert.throws(() => new LRUCache(2, { ttlMs: -1 }), RangeError);
  assert.throws(() => new LRUCache(2, { ttlMs: Number.NaN }), RangeError);
});
