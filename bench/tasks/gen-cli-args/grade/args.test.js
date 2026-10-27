import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs, listOptionNames, usageText } from "../src/args.js";
import { buildCliConfig, describeConfig, runCli } from "../src/app.js";
import { formatOptionHelp, normalizeSpec, splitLongOption } from "../src/spec.js";
import { parseNumberStrict } from "../src/util.js";

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
  assert.equal(parseArgs(["--name=Alice"], spec).options.name, "Alice");
  assert.equal(parseArgs(["--name=Alice=Bob"], spec).options.name, "Alice=Bob");
  assert.equal(parseArgs(["--name="], spec).options.name, "");
});

test("短いオプションの別名", () => {
  assert.equal(parseArgs(["-n", "Alice"], spec).options.name, "Alice");
  assert.equal(parseArgs(["-nAlice"], spec).options.name, "Alice");
});

test("真偽値のまとめ書き", () => {
  const flags = {
    a: { type: "boolean", alias: "a" },
    b: { type: "boolean", alias: "b" },
    c: { type: "boolean", alias: "c" },
  };
  assert.deepEqual(parseArgs(["-abc"], flags).options, { a: true, b: true, c: true });
  assert.deepEqual(parseArgs(["-cab"], flags).options, { a: true, b: true, c: true });
});

test("まとめの中の値を取るオプション", () => {
  assert.deepEqual(parseArgs(["-vnAlice"], spec).options, {
    name: "Alice",
    verbose: true,
  });
  assert.deepEqual(parseArgs(["-vn", "Alice"], spec).options, {
    name: "Alice",
    verbose: true,
  });
});

test("値を取るオプションがまとめの先頭なら残りが値", () => {
  const result = parseArgs(["-nv"], spec);
  assert.equal(result.options.name, "v");
  assert.equal(result.options.verbose, false);
});

test("真偽値の既定値と上書き", () => {
  assert.deepEqual(parseArgs([], spec).options, { name: "world", verbose: false });
  assert.equal(parseArgs(["-v"], spec).options.verbose, true);
  assert.equal(parseArgs(["--verbose=true"], spec).options.verbose, true);
  assert.equal(parseArgs(["--verbose=false"], spec).options.verbose, false);
});

test("真偽値の不正な値", () => {
  assert.throws(() => parseArgs(["--verbose=yes"], spec), /boolean/);
  assert.throws(() => parseArgs(["--verbose=yes"], spec), /verbose/);
  assert.throws(() => parseArgs(["--verbose="], spec), /boolean/);
});

test("数値に変換する", () => {
  assert.equal(parseArgs(["--count", "3"], spec).options.count, 3);
  assert.equal(parseArgs(["-c", "-3"], spec).options.count, -3);
  assert.equal(parseArgs(["--count=1.5"], spec).options.count, 1.5);
  assert.equal(parseArgs(["--count", "1e3"], spec).options.count, 1000);
});

test("数値でない値はエラー", () => {
  for (const value of ["abc", "", " ", "Infinity", "NaN", "1x", "1.2.3"]) {
    assert.throws(() => parseArgs(["--count", value], spec), /number/, value);
    assert.throws(() => parseArgs(["--count", value], spec), /count/, value);
  }
});

test("既定値がない項目は options に入れない", () => {
  const result = parseArgs([], spec);
  assert.equal("count" in result.options, false);
  assert.equal("output" in result.options, false);
});

test("ハイフンで始まる文字列も値として扱う", () => {
  assert.equal(parseArgs(["--name", "-x"], spec).options.name, "-x");
  assert.equal(parseArgs(["-o", "-"], spec).options.output, "-");
});

test("-- も値として扱う", () => {
  assert.equal(parseArgs(["--name", "--"], spec).options.name, "--");
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
  assert.throws(() => parseArgs(["--name"], spec), /name/);
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

test("stopAtPositional で最初の位置引数から止まる", () => {
  assert.deepEqual(parseArgs(["-v", "a", "-v", "--", "b"], spec, { stopAtPositional: true }), {
    options: { name: "world", verbose: true },
    positional: ["a", "-v", "--", "b"],
  });
});

test("stopAtPositional でも -- より前はオプション", () => {
  assert.deepEqual(parseArgs(["--count", "2", "--", "-v"], spec, { stopAtPositional: true }), {
    options: { name: "world", verbose: false, count: 2 },
    positional: ["-v"],
  });
});

test("argv が配列でない", () => {
  assert.throws(() => parseArgs("--name a", spec), TypeError);
  assert.throws(() => parseArgs("--name a", spec), /argv/);
});

test("spec がオブジェクトでない", () => {
  assert.throws(() => parseArgs([], null), TypeError);
  assert.throws(() => parseArgs([], []), /spec/);
});

test("知らない type はエラー", () => {
  assert.throws(() => parseArgs([], { x: { type: "date" } }), TypeError);
  assert.throws(() => parseArgs([], { x: { type: "date" } }), /type/);
});

test("alias は1文字", () => {
  assert.throws(() => parseArgs([], { x: { alias: "ab" } }), TypeError);
  assert.throws(() => parseArgs([], { x: { alias: "ab" } }), /alias/);
});

test("alias の重複はエラー", () => {
  assert.throws(
    () => parseArgs([], { x: { alias: "a" }, y: { alias: "a" } }),
    /alias/,
  );
});

test("default の型が違えばエラー", () => {
  assert.throws(() => parseArgs([], { x: { type: "number", default: "1" } }), /default/);
  assert.throws(() => parseArgs([], { x: { type: "boolean", default: 0 } }), /default/);
  assert.throws(() => parseArgs([], { x: { type: "string", default: 1 } }), /default/);
});

test("既定値のオブジェクトは共有しない", () => {
  const first = parseArgs([], spec).options;
  first.name = "changed";
  assert.equal(parseArgs([], spec).options.name, "world");
});

test("既存の listOptionNames は並べ替えて返す", () => {
  assert.deepEqual(listOptionNames(spec), ["count", "name", "output", "verbose"]);
});

test("既存の usageText は使い方と各オプションを出す", () => {
  const text = usageText(spec, "tool");
  assert.match(text, /使い方: tool/);
  assert.match(text, /--name, -n <string> \(default: world\)/);
  assert.match(text, /--verbose, -v/);
});

test("既存の formatOptionHelp", () => {
  assert.equal(
    formatOptionHelp("count", { type: "number", alias: "c" }),
    "--count, -c <number>",
  );
  assert.equal(
    formatOptionHelp("flag", { type: "boolean" }),
    "--flag",
  );
});

test("既存の splitLongOption", () => {
  assert.deepEqual(splitLongOption("--name=Alice"), {
    name: "name",
    hasValue: true,
    value: "Alice",
  });
  assert.deepEqual(splitLongOption("--flag"), {
    name: "flag",
    hasValue: false,
    value: undefined,
  });
});

test("既存の parseNumberStrict", () => {
  assert.equal(parseNumberStrict("1e3"), 1000);
  assert.equal(parseNumberStrict("-2.5"), -2.5);
  assert.equal(parseNumberStrict("Infinity"), undefined);
  assert.equal(parseNumberStrict(""), undefined);
});

test("既存の normalizeSpec は既定値をまとめる", () => {
  const normalized = normalizeSpec(spec);
  assert.deepEqual(normalized.defaults, { name: "world", verbose: false });
  assert.equal(normalized.aliases.get("c"), "count");
});

test("buildCliConfig から使える", () => {
  const config = buildCliConfig(["-n", "Alice", "a.txt", "b.txt"], spec);
  assert.deepEqual(config, {
    options: { name: "Alice", verbose: false },
    files: ["a.txt", "b.txt"],
    optionCount: 4,
  });
});

test("buildCliConfig でも stopAtPositional が効く", () => {
  const config = buildCliConfig(["-v", "x", "--count=2"], spec, { stopAtPositional: true });
  assert.deepEqual(config.options, { name: "world", verbose: true });
  assert.deepEqual(config.files, ["x", "--count=2"]);
});

test("runCli は結果を文字列にする", () => {
  assert.equal(runCli(["-n", "Alice", "a.txt"], spec), '{"name":"Alice","verbose":false} a.txt');
});

test("runCli は --help で使い方を返す", () => {
  assert.match(runCli(["--help"], spec), /使い方: app/);
});

test("describeConfig はキーを並べる", () => {
  assert.equal(
    describeConfig({ options: { verbose: true, name: "a" } }),
    "name=a,verbose=true",
  );
});
