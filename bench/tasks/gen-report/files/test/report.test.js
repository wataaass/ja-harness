import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatTable, summarize } from "../src/report.js";

const rows = [
  { date: "2024-01-05", product: "B", quantity: 2, unitPrice: 100 },
  { date: "2024-01-20", product: "A", quantity: 1, unitPrice: 300 },
  { date: "2024-02-02", product: "A", quantity: 3, unitPrice: 300 },
  { date: "2024-02-10", product: "C", quantity: 2, unitPrice: 50 },
];

test("月ごとに集計する", () => {
  assert.deepEqual(summarize(rows).byMonth, [
    { month: "2024-01", total: 500, quantity: 3, count: 2 },
    { month: "2024-02", total: 1000, quantity: 5, count: 2 },
  ]);
});

test("商品ごとに集計して売上の順に並べる", () => {
  assert.deepEqual(summarize(rows).byProduct, [
    { product: "A", total: 1200, quantity: 4, count: 2 },
    { product: "B", total: 200, quantity: 2, count: 1 },
    { product: "C", total: 100, quantity: 2, count: 1 },
  ]);
});

test("上位3件と合計", () => {
  const summary = summarize(rows);
  assert.equal(summary.topProducts.length, 3);
  assert.equal(summary.topProducts[0].product, "A");
  assert.equal(summary.total, 1500);
});

test("表の形", () => {
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

test("空のデータ", () => {
  assert.deepEqual(summarize([]), {
    byMonth: [],
    byProduct: [],
    topProducts: [],
    total: 0,
  });
  assert.equal(formatTable(summarize([])), "データなし");
});

test("売上ファイルを集計する", () => {
  const records = JSON.parse(
    readFileSync(new URL("../data/sales.json", import.meta.url), "utf8"),
  );
  const summary = summarize(records);
  assert.equal(records.length, 2000);
  assert.equal(summary.byMonth.length, 12);
  assert.equal(summary.byProduct.length, 8);
  assert.equal(summary.topProducts[0].product, "はさみ");
  assert.equal(summary.total, 2388690);
});
