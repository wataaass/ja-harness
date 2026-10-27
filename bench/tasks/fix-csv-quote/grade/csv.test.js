import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseCsvRecords, stringifyCsv } from "../src/csv.js";
import { escapeField, needsQuotes, stringifyRecords } from "../src/writer.js";
import { formatNumber, parseNumber } from "../src/numbers.js";

test("引用符内の二重引用符を1つに戻す", () => {
  assert.deepEqual(parseCsv('a\n"say ""hello"""\n'), [["a"], ['say "hello"']]);
});

test("引用符とカンマが同時にある値", () => {
  assert.deepEqual(parseCsv('a,b\n"x,""y"",z",w\n'), [
    ["a", "b"],
    ['x,"y",z', "w"],
  ]);
});

test("引用符だけの値", () => {
  assert.deepEqual(parseCsv('a\n""""\n'), [["a"], ['"']]);
});

test("引用符付きの値を書き出して読み戻せる", () => {
  const rows = [
    ["id", "memo", "note"],
    ["1", 'a,"b"', 'say "hi"'],
    ["2", "line1\nline2", ""],
  ];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});

test("前後に空白がある値は引用符で囲む", () => {
  assert.equal(escapeField(" a"), '" a"');
  assert.equal(escapeField("a "), '"a "');
  assert.equal(escapeField(" a "), '" a "');
  assert.equal(needsQuotes("a "), true);
});

test("空白だけの値も引用符で囲む", () => {
  assert.equal(escapeField(" "), '" "');
  assert.equal(escapeField("  "), '"  "');
});

test("前後の空白がある値の往復", () => {
  const rows = [
    ["id", "note"],
    ["1", " leading"],
    ["2", "trailing "],
    ["3", " both "],
  ];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});

test("括弧の負数は負の数として読む", () => {
  assert.equal(parseNumber("(1,234)"), -1234);
  assert.equal(parseNumber("(0.5)"), -0.5);
  assert.equal(parseNumber("(1 234)"), -1234);
});

test("括弧の負数と桁区切りが組み合わさっても読む", () => {
  assert.equal(parseNumber("(1,234.50)"), -1234.5);
  assert.equal(parseNumber("((1,234))"), null);
});

test("括弧の負数の整形", () => {
  assert.equal(formatNumber(-1234, { parenthesesNegative: true }), "(1,234)");
  assert.equal(formatNumber(1234, { parenthesesNegative: true }), "1,234");
});

test("普通の負数は今までどおり", () => {
  assert.equal(parseNumber("-1,234.5"), -1234.5);
  assert.equal(parseNumber("-0.5"), -0.5);
  assert.equal(parseNumber("+12"), 12);
});

test("基本の読み書きは変わらない", () => {
  assert.deepEqual(parseCsv('a,b\n"x,y",z\n'), [["a", "b"], ["x,y", "z"]]);
  assert.deepEqual(parseCsvRecords('id,name\n1,"佐藤, 花子"\n'), [
    { id: "1", name: "佐藤, 花子" },
  ]);
  assert.equal(stringifyRecords([{ id: "1", name: "a,b" }]), 'id,name\n1,"a,b"\n');
});

test("空の値と末尾のカンマ", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,,3\n,,\n"), [
    ["a", "b", "c"],
    ["1", "", "3"],
    ["", "", ""],
  ]);
});
