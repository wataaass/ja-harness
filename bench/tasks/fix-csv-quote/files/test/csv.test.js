import test from "node:test";
import assert from "node:assert/strict";
import {
  chunk,
  columnValues,
  convertRecords,
  detectDelimiter,
  escapeField,
  formatDate,
  formatNumber,
  inferSchema,
  mergeRecords,
  parseBool,
  parseCsv,
  parseCsvRecords,
  parseDateValue,
  parseNumber,
  selectColumns,
  sortRecords,
  stringifyCsv,
  stringifyRecords,
  summarizeColumns,
  transpose,
  unique,
} from "../src/csv.js";

test("カンマ区切りの基本", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2,3\n"), [
    ["a", "b", "c"],
    ["1", "2", "3"],
  ]);
});

test("区切りを自動で見つける", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3\n"), ";");
  assert.equal(detectDelimiter("a\tb\tc\n1\t2\t3\n"), "\t");
});

test("引用符の中のカンマは区切らない", () => {
  assert.deepEqual(parseCsv('name,note\n"佐藤, 花子",ok\n'), [
    ["name", "note"],
    ["佐藤, 花子", "ok"],
  ]);
});

test("引用符の中の改行を保つ", () => {
  assert.deepEqual(parseCsv('a,b\n"line1\nline2",x\n'), [
    ["a", "b"],
    ["line1\nline2", "x"],
  ]);
});

test("引用符の二重化を戻す", () => {
  assert.deepEqual(parseCsv('a,b\n"he said ""hi""",x\n'), [
    ["a", "b"],
    ['he said "hi"', "x"],
  ]);
});

test("CRLF をそろえる", () => {
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("空の行を飛ばせる", () => {
  assert.deepEqual(parseCsv("a,b\n\n1,2\n", { skipEmptyLines: true }), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("前後の空白を落とせる", () => {
  assert.deepEqual(parseCsv(" a , b \n", { trim: true }), [["a", "b"]]);
});

test("文字列化で必要な項目だけ引用する", () => {
  assert.equal(stringifyCsv([["a,b", 'c"d', "e"]]), '"a,b","c""d",e\n');
});

test("読み書きを往復できる", () => {
  const rows = [
    ["id", "memo"],
    ["1", 'a,b'],
    ["2", "say yes"],
  ];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});

test("ヘッダーからオブジェクトを作る", () => {
  assert.deepEqual(parseCsvRecords("id,name\n1,佐藤\n2,鈴木\n"), [
    { id: "1", name: "佐藤" },
    { id: "2", name: "鈴木" },
  ]);
});

test("オブジェクトを文字列に戻す", () => {
  const records = [{ id: "1", name: "佐藤" }];
  assert.equal(stringifyRecords(records), "id,name\n1,佐藤\n");
});

test("escapeField は空値を空文字にする", () => {
  assert.equal(escapeField(null), "");
  assert.equal(escapeField("abc"), "abc");
  assert.equal(escapeField("a b"), "a b");
  assert.equal(escapeField(" a"), '" a"');
});

test("数値の変換", () => {
  assert.equal(parseNumber("1,234.5"), 1234.5);
  assert.equal(parseNumber("(1,234)"), -1234);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseNumber(""), null);
  assert.equal(formatNumber(1234567.891, { decimals: 2 }), "1,234,567.89");
});

test("真偽値の変換", () => {
  assert.equal(parseBool("YES"), true);
  assert.equal(parseBool("off"), false);
  assert.equal(parseBool("maybe"), null);
});

test("日付の変換と整形", () => {
  const date = parseDateValue("2024/02/29");
  assert.ok(date);
  assert.equal(formatDate(date, "YYYY-MM-DD"), "2024-02-29");
  assert.equal(parseDateValue("2023-02-29"), null);
  assert.equal(formatDate("2024-01-05", "YYYY/MM/DD"), "2024/01/05");
});

test("列の選択と並べ替え", () => {
  const records = [
    { id: 2, name: "b" },
    { id: 1, name: "a" },
  ];
  assert.deepEqual(selectColumns(records, ["name"]), [{ name: "b" }, { name: "a" }]);
  assert.deepEqual(sortRecords(records, "id"), [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
  ]);
  assert.deepEqual(columnValues(records, "id"), [2, 1]);
});

test("分割と重複の除去", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(unique([1, 1, 2, 3, 3]), [1, 2, 3]);
});

test("型の推測と変換", () => {
  const records = [{ n: "12", b: "true", d: "2024-01-02", s: "abc" }];
  const schema = inferSchema(records);
  assert.equal(schema.n, "number");
  assert.equal(schema.b, "boolean");
  assert.equal(schema.d, "date");
  assert.equal(schema.s, "string");
  const converted = convertRecords(records, schema);
  assert.equal(converted[0].n, 12);
  assert.equal(converted[0].b, true);
});

test("レコードの結合", () => {
  const merged = mergeRecords(
    [
      { id: 1, a: "x" },
      { id: 2, a: "y" },
    ],
    [{ id: 2, b: "z" }],
    "id",
  );
  assert.deepEqual(merged, [
    { id: 1, a: "x" },
    { id: 2, a: "y", b: "z" },
  ]);
});

test("転置", () => {
  assert.deepEqual(transpose([["a", "b"], ["c", "d"]]), [
    ["a", "c"],
    ["b", "d"],
  ]);
});

test("列の集計", () => {
  const summary = summarizeColumns([{ n: "1" }, { n: "3" }, { n: "" }]);
  assert.equal(summary.n.count, 2);
  assert.equal(summary.n.min, 1);
  assert.equal(summary.n.max, 3);
  assert.equal(summary.n.sum, 4);
});
