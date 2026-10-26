import assert from "node:assert";
import test from "node:test";
import { add } from "../math.js";

test("add(2, 3) は 5", () => {
  assert.strictEqual(add(2, 3), 5);
});

test("add(-1, 4) は 3", () => {
  assert.strictEqual(add(-1, 4), 3);
});
