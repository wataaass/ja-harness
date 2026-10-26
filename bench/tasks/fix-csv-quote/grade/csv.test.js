import test from "node:test";
import assert from "node:assert/strict";
import {
  detectDelimiter,
  escapeField,
  formatDate,
  formatNumber,
  parseCsv,
  parseCsvRecords,
  parseDateValue,
  parseNumber,
  stringifyCsv,
  stringifyRecords,
} from "../src/csv.js";

test("引用符内のカンマを1つの値として読む", () => {
  assert.deepEqual(parseCsv('a,b\n"x,y",z\n'), [
    ["a", "b"],
    ["x,y", "z"],
  ]);
});

test("引用符内の二重引用符を1つに戻す", () => {
  assert.deepEqual(parseCsv('a\n"say ""hello"""\n'), [["a"], ['say "hello"']]);
});

test("引用符内のカンマと二重引用符が同時にあっても壊れない", () => {
  assert.deepEqual(parseCsv('a,b\n"x,""y"",z",w\n'), [
    ["a", "b"],
    ['x,"y",z', "w"],
  ]);
  assert.deepEqual(parseCsv('col\n"""quoted,"" yes"""\n'), [
    ["col"],
    ['"quoted," yes"'],
  ]);
});

test("引用符内の改行とカンマを保つ", () => {
  const text = 'a,b\n"one,\ntwo",x\n';
  assert.deepEqual(parseCsv(text), [
    ["a", "b"],
    ["one,\ntwo", "x"],
  ]);
});

test("空の値と末尾のカンマ", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,,3\n,,\n"), [
    ["a", "b", "c"],
    ["1", "", "3"],
    ["", "", ""],
  ]);
});

test("区切り文字と引用符を指定できる", () => {
  assert.deepEqual(parseCsv("a;b\n'x;y';z\n", { delimiter: ";", quote: "'" }), [
    ["a", "b"],
    ["x;y", "z"],
  ]);
});

test("BOM と CRLF を落とす", () => {
  assert.deepEqual(parseCsv("\uFEFFa,b\r\n1,2\r\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("空行を飛ばす", () => {
  assert.deepEqual(parseCsv("a\n\n1\n\n", { skipEmptyLines: true }), [["a"], ["1"]]);
});

test("前後の空白を落とす", () => {
  assert.deepEqual(parseCsv(" a , b \n", { trim: true }), [["a", "b"]]);
});

test("区切りの自動判定", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3\n"), ";");
  assert.equal(detectDelimiter("a|b|c\n1|2|3\n"), "|");
  assert.equal(detectDelimiter("a,b,c\n1,2,3\n"), ",");
});

test("引用が必要な値だけを囲む", () => {
  assert.equal(escapeField("abc"), "abc");
  assert.equal(escapeField("a,b"), '"a,b"');
  assert.equal(escapeField('a"b'), '"a""b"');
  assert.equal(escapeField("a\nb"), '"a\nb"');
  assert.equal(escapeField(" a"), '" a"');
  assert.equal(escapeField(""), "");
});

test("文字列化と読み込みを往復できる", () => {
  const rows = [
    ["id", "memo", "note"],
    ["1", 'a,b', 'say "hi"'],
    ["2", "line1\nline2", ""],
    ["3", " leading", "trailing "],
  ];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});

test("ヘッダー付きレコードの読み書き", () => {
  const text = 'id,name,note\n1,"佐藤, 花子","say ""hi"""\n';
  assert.deepEqual(parseCsvRecords(text), [{ id: "1", name: "佐藤, 花子", note: 'say "hi"' }]);
  const records = [{ id: "1", name: "佐藤, 花子", note: 'say "hi"' }];
  assert.equal(stringifyRecords(records), text);
});

test("数値の変換を厳密に行う", () => {
  assert.equal(parseNumber("1,234.50"), 1234.5);
  assert.equal(parseNumber("(1,234)"), -1234);
  assert.equal(parseNumber("-0.5"), -0.5);
  assert.equal(parseNumber(".5"), 0.5);
  assert.equal(parseNumber("1.234,5", { thousands: ".", decimal: "," }), 1234.5);
  assert.equal(parseNumber("1 234"), 1234);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("1,2,3"), 123);
  assert.equal(parseNumber(Infinity), null);
});

test("数値の整形", () => {
  assert.equal(formatNumber(1234.5), "1,235");
  assert.equal(formatNumber(1234.5, { decimals: 1 }), "1,234.5");
  assert.equal(formatNumber(-1234567, { decimals: 0 }), "-1,234,567");
  assert.equal(formatNumber("12,345.678", { decimals: 2 }), "12,345.68");
});

test("日付の変換の端", () => {
  assert.equal(formatDate(parseDateValue("2024-02-29"), "YYYY-MM-DD"), "2024-02-29");
  assert.equal(formatDate(parseDateValue("2024/02/29"), "YYYY-MM-DD"), "2024-02-29");
  assert.equal(formatDate(parseDateValue("02/29/2024"), "YYYY-MM-DD"), "2024-02-29");
  assert.equal(formatDate(parseDateValue("2024.02.29"), "YYYY-MM-DD"), "2024-02-29");
  assert.equal(parseDateValue("2023-02-29"), null);
  assert.equal(parseDateValue("2024-13-01"), null);
  assert.equal(parseDateValue("2024-04-31"), null);
  assert.equal(parseDateValue(""), null);
  assert.equal(formatDate("2024-12-31T23:59:58", "YYYY/MM/DD HH:mm:ss"), "2024/12/31 23:59:58");
});

test("余分な引用符を含む往復", () => {
  const rows = [["a", "b"], ['x,"y"', 'z""w']];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});
