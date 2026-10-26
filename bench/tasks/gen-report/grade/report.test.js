import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatTable, summarize } from "../src/report.js";
import { countLines, readSales, renderSalesReport } from "../src/cli-report.js";
import {
  accumulate,
  byTotalThenName,
  createBucket,
  finalizeBuckets,
  monthOf,
  validateRecord,
} from "../src/summary.js";
import { clamp, formatNumber, groupBy, median, sortByStable } from "../src/utils.js";

const rows = [
  { date: "2024-02-02", product: "A", category: "文具", quantity: 3, unitPrice: 300 },
  { date: "2024-01-05", product: "B", category: "事務", quantity: 2, unitPrice: 100 },
  { date: "2024-02-10", product: "C", category: "文具", quantity: 2, unitPrice: 50 },
  { date: "2024-01-20", product: "A", category: "文具", quantity: 1, unitPrice: 300 },
];

const expectedMonths = [
  { month: "2024-01", total: 500, quantity: 3, count: 2 },
  { month: "2024-02", total: 1000, quantity: 5, count: 2 },
];

const expectedProducts = [
  { product: "A", total: 1200, quantity: 4, count: 2 },
  { product: "B", total: 200, quantity: 2, count: 1 },
  { product: "C", total: 100, quantity: 2, count: 1 },
];

const expectedCategories = [
  { category: "文具", total: 1300, quantity: 6, count: 3 },
  { category: "事務", total: 200, quantity: 2, count: 1 },
];

const expectedTable = [
  "月別",
  "2024-01 | 500 | 2",
  "2024-02 | 1,000 | 2",
  "商品別",
  "A | 1,200 | 2",
  "B | 200 | 1",
  "C | 100 | 1",
  "カテゴリ別",
  "文具 | 1,300 | 3",
  "事務 | 200 | 1",
  "上位3件",
  "1. A | 1,200",
  "2. B | 200",
  "3. C | 100",
  "合計 | 1,500",
  "平均 | 375",
  "件数 | 4",
].join("\n");

test("月ごとに集計して月の順に並べる", () => {
  assert.deepEqual(summarize(rows).byMonth, expectedMonths);
});

test("商品ごとに売上の順に並べる", () => {
  assert.deepEqual(summarize(rows).byProduct, expectedProducts);
});

test("カテゴリごとに売上の順に並べる", () => {
  assert.deepEqual(summarize(rows).byCategory, expectedCategories);
});

test("上位3件と合計と平均", () => {
  const summary = summarize(rows);
  assert.deepEqual(summary.topProducts, expectedProducts);
  assert.equal(summary.total, 1500);
  assert.equal(summary.quantity, 8);
  assert.equal(summary.count, 4);
  assert.equal(summary.average, 375);
});

test("表の形", () => {
  assert.equal(formatTable(summarize(rows)), expectedTable);
});

test("表に末尾の改行を付けない", () => {
  assert.equal(formatTable(summarize(rows)).endsWith("\n"), false);
});

test("空のデータ", () => {
  assert.deepEqual(summarize([]), {
    byMonth: [],
    byProduct: [],
    byCategory: [],
    topProducts: [],
    total: 0,
    quantity: 0,
    count: 0,
    average: 0,
  });
  assert.equal(formatTable(summarize([])), "データなし");
});

test("入力を変更しない", () => {
  const input = rows.map((row) => ({ ...row }));
  const before = JSON.stringify(input);
  summarize(input);
  assert.equal(JSON.stringify(input), before);
});

test("top を指定できる", () => {
  const summary = summarize(rows, { top: 2 });
  assert.deepEqual(
    summary.topProducts.map((item) => item.product),
    ["A", "B"],
  );
});

test("top が0なら上位は空", () => {
  assert.deepEqual(summarize(rows, { top: 0 }).topProducts, []);
});

test("top が一覧より大きくてもある分だけ", () => {
  const summary = summarize(rows, { top: 99 });
  assert.deepEqual(summary.topProducts, expectedProducts);
});

test("top の検証", () => {
  for (const top of [-1, 1.5, Number.NaN, "3"]) {
    assert.throws(() => summarize(rows, { top }), RangeError, String(top));
    assert.throws(() => summarize(rows, { top }), /top/, String(top));
  }
});

test("records が配列でない", () => {
  assert.throws(() => summarize(null), TypeError);
  assert.throws(() => summarize({}), /records/);
});

test("記録がオブジェクトでない", () => {
  assert.throws(() => summarize([null]), TypeError);
  assert.throws(() => summarize([null]), /record/);
});

test("quantity の検証", () => {
  for (const quantity of ["1", Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
    assert.throws(
      () => summarize([{ ...rows[0], quantity }]),
      /quantity/,
      String(quantity),
    );
  }
});

test("unitPrice の検証", () => {
  for (const unitPrice of ["100", Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
    assert.throws(
      () => summarize([{ ...rows[0], unitPrice }]),
      /unitPrice/,
      String(unitPrice),
    );
  }
});

test("date の検証", () => {
  assert.throws(() => summarize([{ ...rows[0], date: 20240101 }]), /date/);
  assert.throws(() => summarize([{ ...rows[0], date: "2024-1" }]), /date/);
  assert.throws(() => summarize([{ ...rows[0], date: undefined }]), /date/);
});

test("product の検証", () => {
  assert.throws(() => summarize([{ ...rows[0], product: "" }]), /product/);
  assert.throws(() => summarize([{ ...rows[0], product: 5 }]), /product/);
});

test("category の検証", () => {
  assert.throws(() => summarize([{ ...rows[0], category: 5 }]), /category/);
});

test("category がないときは未分類", () => {
  const summary = summarize([
    { date: "2024-01-01", product: "A", quantity: 1, unitPrice: 100 },
    { date: "2024-01-02", product: "B", category: null, quantity: 1, unitPrice: 200 },
    { date: "2024-01-03", product: "C", category: "", quantity: 1, unitPrice: 300 },
  ]);
  assert.deepEqual(summary.byCategory, [
    { category: "未分類", total: 600, quantity: 3, count: 3 },
  ]);
});

test("同じ売上のときは商品名の順", () => {
  const summary = summarize([
    { date: "2024-03-01", product: "Beta", quantity: 1, unitPrice: 100 },
    { date: "2024-03-02", product: "Alpha", quantity: 1, unitPrice: 100 },
  ]);
  assert.deepEqual(
    summary.byProduct.map((item) => item.product),
    ["Alpha", "Beta"],
  );
});

test("同じ売上のときはカテゴリ名の順", () => {
  const summary = summarize([
    { date: "2024-03-01", product: "A", category: "い", quantity: 1, unitPrice: 100 },
    { date: "2024-03-01", product: "B", category: "あ", quantity: 1, unitPrice: 100 },
  ]);
  assert.deepEqual(
    summary.byCategory.map((item) => item.category),
    ["あ", "い"],
  );
});

test("日時が付いていても先頭7文字を使う", () => {
  const summary = summarize([
    { date: "2024-05-10T12:34:56", product: "A", quantity: 1, unitPrice: 100 },
  ]);
  assert.equal(summary.byMonth[0].month, "2024-05");
});

test("年をまたぐ月も昇順", () => {
  const summary = summarize([
    { date: "2025-01-01", product: "A", quantity: 1, unitPrice: 100 },
    { date: "2024-12-01", product: "A", quantity: 1, unitPrice: 100 },
    { date: "2024-02-01", product: "A", quantity: 1, unitPrice: 100 },
  ]);
  assert.deepEqual(
    summary.byMonth.map((item) => item.month),
    ["2024-02", "2024-12", "2025-01"],
  );
});

test("average は丸めない", () => {
  const summary = summarize([
    { date: "2024-01-01", product: "A", quantity: 1, unitPrice: 1 },
    { date: "2024-01-02", product: "B", quantity: 2, unitPrice: 1 },
  ]);
  assert.equal(summary.average, 1.5);
});

test("表の平均は四捨五入する", () => {
  const text = formatTable(
    summarize([
      { date: "2024-01-01", product: "A", quantity: 1, unitPrice: 300 },
      { date: "2024-01-02", product: "B", quantity: 1, unitPrice: 300 },
      { date: "2024-01-03", product: "C", quantity: 1, unitPrice: 400 },
    ]),
  );
  assert.match(text, /平均 \| 333$/m);
});

test("金額に3桁のカンマを入れる", () => {
  const text = formatTable(
    summarize([
      { date: "2024-01-01", product: "A", quantity: 1, unitPrice: 1500000 },
    ]),
  );
  assert.match(text, /合計 \| 1,500,000/);
});

test("月別・商品別・カテゴリ別は件数を出す", () => {
  const text = formatTable(summarize(rows));
  assert.match(text, /^2024-01 \| 500 \| 2$/m);
  assert.match(text, /^A \| 1,200 \| 2$/m);
  assert.match(text, /^文具 \| 1,300 \| 3$/m);
});

test("売上ファイルの全体", () => {
  const records = JSON.parse(
    readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"),
  );
  const summary = summarize(records);
  assert.equal(records.length, 2000);
  assert.equal(summary.total, 2388690);
  assert.equal(summary.quantity, 10842);
  assert.equal(summary.count, 2000);
  assert.equal(summary.average, 1194.345);
  assert.equal(summary.byMonth.length, 12);
  assert.equal(summary.byProduct.length, 8);
  assert.equal(summary.byCategory.length, 2);
  assert.equal(summary.topProducts.length, 3);
});

test("売上ファイルの月別", () => {
  const records = JSON.parse(
    readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(summarize(records).byMonth, [
    { month: "2024-01", total: 215050, quantity: 966, count: 184 },
    { month: "2024-02", total: 226820, quantity: 940, count: 176 },
    { month: "2024-03", total: 184730, quantity: 813, count: 155 },
    { month: "2024-04", total: 208350, quantity: 936, count: 172 },
    { month: "2024-05", total: 199250, quantity: 945, count: 170 },
    { month: "2024-06", total: 172590, quantity: 889, count: 161 },
    { month: "2024-07", total: 199300, quantity: 951, count: 175 },
    { month: "2024-08", total: 181660, quantity: 905, count: 159 },
    { month: "2024-09", total: 176420, quantity: 804, count: 151 },
    { month: "2024-10", total: 189240, quantity: 883, count: 170 },
    { month: "2024-11", total: 205350, quantity: 911, count: 166 },
    { month: "2024-12", total: 229930, quantity: 899, count: 161 },
  ]);
});

test("売上ファイルの商品別", () => {
  const records = JSON.parse(
    readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(summarize(records).byProduct, [
    { product: "はさみ", total: 882000, quantity: 1260, count: 234 },
    { product: "ファイル", total: 381300, quantity: 1271, count: 227 },
    { product: "定規", total: 324500, quantity: 1298, count: 234 },
    { product: "テープ", total: 258480, quantity: 1436, count: 254 },
    { product: "付箋", total: 180750, quantity: 1205, count: 228 },
    { product: "ノート", total: 171600, quantity: 1430, count: 277 },
    { product: "ペン", total: 114560, quantity: 1432, count: 274 },
    { product: "消しゴム", total: 75500, quantity: 1510, count: 272 },
  ]);
});

test("売上ファイルのカテゴリ別", () => {
  const records = JSON.parse(
    readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(summarize(records).byCategory, [
    { category: "事務", total: 1521780, quantity: 3967, count: 715 },
    { category: "文具", total: 866910, quantity: 6875, count: 1285 },
  ]);
});

test("売上ファイルの上位3件", () => {
  const records = JSON.parse(
    readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    summarize(records).topProducts.map((item) => item.product),
    ["はさみ", "ファイル", "定規"],
  );
});

test("売上ファイルの表", () => {
  const records = JSON.parse(
    readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"),
  );
  const text = formatTable(summarize(records));
  const lines = text.split("\n");
  assert.equal(lines.length, 32);
  assert.equal(lines[0], "月別");
  assert.equal(lines[1], "2024-01 | 215,050 | 184");
  assert.equal(lines[13], "商品別");
  assert.equal(lines[14], "はさみ | 882,000 | 234");
  assert.equal(lines[22], "カテゴリ別");
  assert.equal(lines[23], "事務 | 1,521,780 | 715");
  assert.equal(lines[25], "上位3件");
  assert.equal(lines[26], "1. はさみ | 882,000");
  assert.equal(lines[29], "合計 | 2,388,690");
  assert.equal(lines[30], "平均 | 1,194");
  assert.equal(lines[31], "件数 | 2,000");
  assert.equal(text.endsWith("\n"), false);
});

test("既存の formatNumber", () => {
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatNumber(999), "999");
  assert.equal(formatNumber(12.6), "13");
});

test("既存の数値と配列の関数", () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(groupBy([1, 2, 3], (n) => n % 2).get(1).length, 2);
  assert.deepEqual(sortByStable([3, 1, 2], (a, b) => a - b), [1, 2, 3]);
});

test("既存の monthOf", () => {
  assert.equal(monthOf("2024-07-15"), "2024-07");
  assert.equal(monthOf("2024-07-15T00:00:00"), "2024-07");
  assert.throws(() => monthOf("2024-7"), TypeError);
});

test("既存の validateRecord", () => {
  assert.equal(validateRecord(rows[0], 0), "文具");
  assert.equal(
    validateRecord({ date: "2024-01-01", product: "A", quantity: 1, unitPrice: 1 }, 0),
    "未分類",
  );
  assert.throws(() => validateRecord({}, 3), /quantity/);
});

test("既存の集計の部品", () => {
  const bucket = createBucket("2024-01", "month");
  accumulate(bucket, 100, 2);
  accumulate(bucket, 50, 1);
  assert.deepEqual(bucket, { month: "2024-01", total: 150, quantity: 3, count: 2 });
  const buckets = new Map([
    ["a", createBucket("a", "name")],
    ["b", createBucket("b", "name")],
  ]);
  buckets.get("a").total = 10;
  buckets.get("b").total = 20;
  assert.deepEqual(
    finalizeBuckets(buckets, byTotalThenName("name")).map((entry) => entry.name),
    ["b", "a"],
  );
});

test("既存の readSales", () => {
  const records = readSales(new URL("../data/sales.json", import.meta.url));
  assert.equal(records.length, 2000);
  assert.equal(records[0].id, 1);
});

test("既存の renderSalesReport", () => {
  assert.equal(renderSalesReport(rows), expectedTable);
});

test("既存の countLines", () => {
  assert.equal(countLines("a\nb\nc"), 3);
});

test("数量0や単価0も集計できる", () => {
  const summary = summarize([
    { date: "2024-01-01", product: "A", quantity: 0, unitPrice: 100 },
    { date: "2024-01-02", product: "B", quantity: 2, unitPrice: 0 },
  ]);
  assert.equal(summary.total, 0);
  assert.equal(summary.quantity, 2);
  assert.equal(summary.count, 2);
  assert.equal(summary.byProduct.length, 2);
});
