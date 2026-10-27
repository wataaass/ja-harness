import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/args.js";

const spec = {
  name: { type: "string", alias: "n", default: "world" },
  verbose: { type: "boolean", alias: "v", default: false },
  count: { type: "number", alias: "c" },
};

test("例のとおりに読む", () => {
  assert.deepEqual(
    parseArgs(["--name", "Alice", "-v", "--count=3", "--", "--literal"], spec),
    {
      options: { name: "Alice", verbose: true, count: 3 },
      positional: ["--literal"],
    },
  );
});

test("短い名前とまとめ書き", () => {
  const flags = {
    a: { type: "boolean", alias: "a" },
    b: { type: "boolean", alias: "b" },
    c: { type: "boolean", alias: "c" },
  };
  assert.deepEqual(parseArgs(["-abc"], flags).options, { a: true, b: true, c: true });
});

test("真偽値と数値", () => {
  assert.equal(parseArgs(["--verbose=false"], spec).options.verbose, false);
  assert.equal(parseArgs(["-c", "-3"], spec).options.count, -3);
});

test("既定値", () => {
  assert.deepEqual(parseArgs([], spec).options, { name: "world", verbose: false });
});
