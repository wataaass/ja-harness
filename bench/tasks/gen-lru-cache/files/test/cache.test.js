import test from "node:test";
import assert from "node:assert/strict";
import * as toolkit from "../src/index.js";

const LRUCache = toolkit.LRUCache;

test("値を入れて取り出す", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("missing"), undefined);
});

test("容量を超えたら古いものを消す", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
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

test("size と delete", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.size, 2);
  assert.equal(cache.delete("a"), true);
  assert.equal(cache.delete("a"), false);
  assert.equal(cache.size, 1);
});

test("同じキーの更新", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("a", 2);
  assert.equal(cache.size, 1);
  assert.equal(cache.get("a"), 2);
});

test("ttlMs で期限切れになる", async () => {
  const cache = new LRUCache(2, { ttlMs: 20 });
  cache.set("a", 1);
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(cache.get("a"), undefined);
});
