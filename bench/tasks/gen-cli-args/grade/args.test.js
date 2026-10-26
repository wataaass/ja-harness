import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/args.js";

const spec = {
  name: { type: "string", alias: "n", default: "world" },
  verbose: { type: "boolean", alias: "v", default: false },
  count: { type: "number", alias: "c" },
  output: { type: "string", alias: "o" },
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
  assert.deepEqual(parseArgs(["--name=Alice=Bob"], spec).options.name, "Alice=Bob");
  assert.deepEqual(parseArgs(["--name="], spec).options.name, "");
});

test("短いオプションの別名", () => {
  assert.deepEqual(parseArgs(["-n", "Alice"], spec).options, {
    name: "Alice",
    verbose: false,
  });
  assert.deepEqual(parseArgs(["-nAlice"], spec).options.name, "Alice");
});

test("短い真偽値のまとめ書き", () => {
  const flags = {
    a: { type: "boolean", alias: "a" },
    b: { type: "boolean", alias: "b" },
    c: { type: "boolean", alias: "c" },
  };
  assert.deepEqual(parseArgs(["-abc"], flags).options, { a: true, b: true, c: true });
  assert.deepEqual(parseArgs(["-cab"], flags).options, { a: true, b: true, c: true });
});

test("真偽値の既定値と上書き", () => {
  assert.deepEqual(parseArgs([], spec).options, { name: "world", verbose: false });
  assert.equal(parseArgs(["-v"], spec).options.verbose, true);
  assert.equal(parseArgs(["--verbose=false"], spec).options.verbose, false);
  assert.throws(() => parseArgs(["--verbose=yes"], spec), /boolean/);
});

test("既定値がなければ options に入れない", () => {
  const result = parseArgs([], spec);
  assert.equal("count" in result.options, false);
  assert.equal("output" in result.options, false);
});

test("数値に変換する", () => {
  assert.equal(parseArgs(["--count", "3"], spec).options.count, 3);
  assert.equal(parseArgs(["-c", "-3"], spec).options.count, -3);
  assert.equal(parseArgs(["--count=1.5"], spec).options.count, 1.5);
  assert.equal(parseArgs(["--count", "1e3"], spec).options.count, 1000);
});

test("数値でない値はエラー", () => {
  assert.throws(() => parseArgs(["--count", "abc"], spec), /number/);
  assert.throws(() => parseArgs(["--count="], spec), /number/);
  assert.throws(() => parseArgs(["--count", ""], spec), /number/);
});

test("ハイフンで始まる文字列も値として扱う", () => {
  assert.equal(parseArgs(["--name", "-x"], spec).options.name, "-x");
  assert.equal(parseArgs(["-o", "-"], spec).options.output, "-");
});

test("-- 以降は位置引数", () => {
  assert.deepEqual(parseArgs(["--name", "Alice", "--", "--name", "x", "-v"], spec), {
    options: { name: "Alice", verbose: false },
    positional: ["--name", "x", "-v"],
  });
  assert.deepEqual(parseArgs(["--", "--", "-"], spec).positional, ["--", "-"]);
});

test("位置引数とオプションが混ざる", () => {
  assert.deepEqual(parseArgs(["a", "-v", "b", "--count=2", "c"], spec), {
    options: { name: "world", verbose: true, count: 2 },
    positional: ["a", "b", "c"],
  });
});

test("ハイフン1つは位置引数", () => {
  assert.deepEqual(parseArgs(["-"], spec).positional, ["-"]);
});

test("知らない長いオプションはエラー", () => {
  assert.throws(() => parseArgs(["--unknown"], spec), /--unknown/);
  assert.throws(() => parseArgs(["--unknown=1"], spec), /--unknown/);
});

test("知らない短いオプションはエラー", () => {
  assert.throws(() => parseArgs(["-x"], spec), /-x/);
  assert.throws(() => parseArgs(["-vx"], spec), /-x/);
});

test("値がないときはエラー", () => {
  assert.throws(() => parseArgs(["--name"], spec), /missing/);
  assert.throws(() => parseArgs(["-o"], spec), /missing/);
});

test("同じオプションは後ろが勝つ", () => {
  assert.equal(parseArgs(["--name", "a", "--name", "b"], spec).options.name, "b");
  assert.equal(parseArgs(["-c", "1", "-c", "2"], spec).options.count, 2);
});

test("長い名前と別名は同じ項目になる", () => {
  assert.deepEqual(parseArgs(["--name", "a", "-n", "b"], spec).options, {
    name: "b",
    verbose: false,
  });
  assert.deepEqual(parseArgs(["-v", "--verbose=false"], spec).options.verbose, false);
});

test("空の引数", () => {
  assert.deepEqual(parseArgs([], spec), {
    options: { name: "world", verbose: false },
    positional: [],
  });
});

test("-- だけ", () => {
  assert.deepEqual(parseArgs(["--"], spec), {
    options: { name: "world", verbose: false },
    positional: [],
  });
});

test("オプションの後ろに位置引数が続く", () => {
  assert.deepEqual(parseArgs(["--name", "a", "file.txt"], spec), {
    options: { name: "a", verbose: false },
    positional: ["file.txt"],
  });
});
