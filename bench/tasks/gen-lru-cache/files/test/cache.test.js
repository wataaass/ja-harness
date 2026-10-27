import test from "node:test";
import assert from "node:assert/strict";
import { LRUCache } from "../src/index.js";

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
  cache.get("a");
  cache.set("c", 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
});

test("peek は順番を変えない", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.peek("a");
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
});

test("ttlMs を過ぎると期限切れになる", () => {
  let now = 1000;
  const cache = new LRUCache(2, { ttlMs: 100, now: () => now });
  cache.set("a", 1);
  now = 1099;
  assert.equal(cache.get("a"), 1);
  now = 1101;
  assert.equal(cache.get("a"), undefined);
});

test("keys は古い順", () => {
  const cache = new LRUCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  assert.deepEqual(cache.keys(), ["b", "a"]);
});
