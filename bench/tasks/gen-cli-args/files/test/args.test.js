import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/args.js";

const spec = {
  name: { type: "string", alias: "n", default: "world" },
  verbose: { type: "boolean", alias: "v", default: false },
  count: { type: "number", alias: "c" },
};

test("長いオプションに値を渡す", () => {
  assert.deepEqual(parseArgs(["--name", "Alice"], spec), {
    options: { name: "Alice", verbose: false },
    positional: [],
  });
});

test("イコールでつなぐ", () => {
  assert.deepEqual(parseArgs(["--name=Alice"], spec), {
    options: { name: "Alice", verbose: false },
    positional: [],
  });
});

test("短いオプション", () => {
  assert.deepEqual(parseArgs(["-n", "Alice", "-v"], spec), {
    options: { name: "Alice", verbose: true },
    positional: [],
  });
});

test("短い真偽値のまとめ書き", () => {
  const flags = {
    a: { type: "boolean", alias: "a" },
    b: { type: "boolean", alias: "b" },
    c: { type: "boolean", alias: "c" },
  };
  assert.deepEqual(parseArgs(["-abc"], flags).options, { a: true, b: true, c: true });
});

test("既定値", () => {
  assert.deepEqual(parseArgs([], spec).options, { name: "world", verbose: false });
});

test("数値に変換する", () => {
  assert.deepEqual(parseArgs(["--count", "3"], spec).options, {
    name: "world",
    verbose: false,
    count: 3,
  });
});

test("-- 以降は位置引数", () => {
  assert.deepEqual(parseArgs(["--", "--name", "x", "-v"], spec), {
    options: { name: "world", verbose: false },
    positional: ["--name", "x", "-v"],
  });
});

test("知らないオプションはエラー", () => {
  assert.throws(() => parseArgs(["--unknown"], spec), /unknown/);
});

test("値がないときはエラー", () => {
  assert.throws(() => parseArgs(["--name"], spec), /missing/);
});
