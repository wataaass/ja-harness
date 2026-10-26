import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatTable, summarize } from "../src/report.js";

const rows = [
  { date: "2024-02-02", product: "A", quantity: 3, unitPrice: 300 },
  { date: "2024-01-05", product: "B", quantity: 2, unitPrice: 100 },
  { date: "2024-02-10", product: "C", quantity: 2, unitPrice: 50 },
  { date: "2024-01-20", product: "A", quantity: 1, unitPrice: 300 },
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

test("月ごとに集計して月の順に並べる", () => {
  assert.deepEqual(summarize(rows).byMonth, expectedMonths);
});

test("商品ごとに売上の順に並べる", () => {
  assert.deepEqual(summarize(rows).byProduct, expectedProducts);
});

test("上位3件と合計", () => {
  const summary = summarize(rows);
  assert.deepEqual(summary.topProducts, expectedProducts);
  assert.equal(summary.total, 1500);
});

test("小さいデータの表", () => {
  assert.equal(
    formatTable(summarize(rows)),
    [
      "月別",
      "2024-01 | 500 | 2",
      "2024-02 | 1,000 | 2",
      "商品別",
      "A | 1,200 | 2",
      "B | 200 | 1",
      "C | 100 | 1",
      "上位3件",
      "1. A | 1,200",
      "2. B | 200",
      "3. C | 100",
      "合計 | 1,500",
    ].join("\n"),
  );
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

test("同じ商品をまとめる", () => {
  const summary = summarize([
    { date: "2024-04-01", product: "X", quantity: 2, unitPrice: 50 },
    { date: "2024-04-02", product: "X", quantity: 3, unitPrice: 50 },
  ]);
  assert.deepEqual(summary.byProduct, [
    { product: "X", total: 250, quantity: 5, count: 2 },
  ]);
  assert.deepEqual(summary.byMonth, [
    { month: "2024-04", total: 250, quantity: 5, count: 2 },
  ]);
});

test("空のデータ", () => {
  assert.deepEqual(summarize([]), {
    byMonth: [],
    byProduct: [],
    topProducts: [],
    total: 0,
  });
  assert.equal(formatTable(summarize([])), "データなし");
});

test("入力を変更しない", () => {
  const input = rows.map((row) => ({ ...row }));
  const before = JSON.stringify(input);
  summarize(input);
  assert.equal(JSON.stringify(input), before);
});

test("上位3件より多くても3件まで", () => {
  const input = ["A", "B", "C", "D", "E"].map((product, index) => ({
    date: "2024-05-01",
    product,
    quantity: 1,
    unitPrice: (index + 1) * 100,
  }));
  const summary = summarize(input);
  assert.equal(summary.byProduct.length, 5);
  assert.equal(summary.topProducts.length, 3);
  assert.deepEqual(
    summary.topProducts.map((item) => item.product),
    ["E", "D", "C"],
  );
});

const records = JSON.parse(readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"));

test("売上ファイルの全体", () => {
  const summary = summarize(records);
  assert.equal(records.length, 2000);
  assert.equal(summary.total, 2388690);
  assert.equal(summary.byMonth.length, 12);
  assert.equal(summary.byProduct.length, 8);
});

test("売上ファイルの月別", () => {
  const summary = summarize(records);
  assert.deepEqual(summary.byMonth, [
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
  const summary = summarize(records);
  assert.deepEqual(summary.byProduct, [
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

test("売上ファイルの上位3件", () => {
  const summary = summarize(records);
  assert.deepEqual(
    summary.topProducts.map((item) => item.product),
    ["はさみ", "ファイル", "定規"],
  );
});

test("売上ファイルの表", () => {
  const text = formatTable(summarize(records));
  const lines = text.split("\n");
  assert.equal(lines.length, 27);
  assert.equal(lines[0], "月別");
  assert.equal(lines[1], "2024-01 | 215,050 | 184");
  assert.equal(lines[13], "商品別");
  assert.equal(lines[14], "はさみ | 882,000 | 234");
  assert.equal(lines[22], "上位3件");
  assert.equal(lines[23], "1. はさみ | 882,000");
  assert.equal(lines[26], "合計 | 2,388,690");
  assert.equal(text.endsWith("\n"), false);
});
