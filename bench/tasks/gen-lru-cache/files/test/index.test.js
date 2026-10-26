import test from "node:test";
import assert from "node:assert/strict";
import {
  Counter,
  Deque,
  EventEmitter,
  Queue,
  Stack,
  chunk,
  clamp,
  deepClone,
  getPath,
  groupBy,
  median,
  merge,
  omit,
  once,
  partition,
  pick,
  range,
  setPath,
  sortBy,
  sum,
  unique,
  zip,
} from "../src/index.js";

test("数値の補助", () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.deepEqual(range(0, 5, 2), [0, 2, 4]);
  assert.equal(sum([1, 2, 3]), 6);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("配列の補助", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(unique([1, 1, 2]), [1, 2]);
  assert.deepEqual(zip([1, 2], ["a", "b"]), [[1, "a"], [2, "b"]]);
  assert.deepEqual(partition([1, 2, 3], (n) => n % 2 === 1), [[1, 3], [2]]);
});

test("並べ替えとまとめ", () => {
  assert.deepEqual(sortBy([{ n: 2 }, { n: 1 }], "n"), [{ n: 1 }, { n: 2 }]);
  assert.deepEqual([...groupBy([1, 2, 3, 4], (n) => n % 2).keys()], [1, 0]);
});

test("オブジェクトの補助", () => {
  assert.deepEqual(pick({ a: 1, b: 2 }, ["a"]), { a: 1 });
  assert.deepEqual(omit({ a: 1, b: 2 }, ["b"]), { a: 1 });
  assert.deepEqual(merge({ a: { b: 1 } }, { a: { c: 2 } }), { a: { b: 1, c: 2 } });
  const cloned = deepClone({ a: [1, 2] });
  assert.deepEqual(cloned, { a: [1, 2] });
});

test("パスの読み書き", () => {
  assert.equal(getPath({ a: { b: 2 } }, "a.b"), 2);
  assert.equal(getPath({}, "a.b", 9), 9);
  const target = {};
  setPath(target, "a.b", 1);
  assert.deepEqual(target, { a: { b: 1 } });
});

test("once", () => {
  let count = 0;
  const fn = once(() => ++count);
  assert.equal(fn(), 1);
  assert.equal(fn(), 1);
});

test("イベント", () => {
  const emitter = new EventEmitter();
  let received = null;
  emitter.on("x", (value) => {
    received = value;
  });
  assert.equal(emitter.emit("x", 3), 1);
  assert.equal(received, 3);
});

test("スタックとキュー", () => {
  const stack = new Stack([1]);
  stack.push(2);
  assert.equal(stack.pop(), 2);
  const queue = new Queue([1, 2]);
  assert.equal(queue.dequeue(), 1);
  assert.equal(queue.size, 1);
});

test("両端キューとカウンタ", () => {
  const deque = new Deque([2]);
  deque.pushFront(1).pushBack(3);
  assert.deepEqual(deque.toArray(), [1, 2, 3]);
  const counter = new Counter();
  counter.add("a").add("a").add("b");
  assert.equal(counter.get("a"), 2);
});
