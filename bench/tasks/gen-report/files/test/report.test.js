import test from "node:test";
import assert from "node:assert/strict";
import { formatTable, summarize } from "../src/report.js";

const rows = [
  { date: "2024-02-02", product: "A", category: "文具", quantity: 3, unitPrice: 300 },
  { date: "2024-01-05", product: "B", category: "事務", quantity: 2, unitPrice: 100 },
  { date: "2024-02-10", product: "C", category: "文具", quantity: 2, unitPrice: 50 },
  { date: "2024-01-20", product: "A", category: "文具", quantity: 1, unitPrice: 300 },
];

test("月と商品とカテゴリを集計する", () => {
  const summary = summarize(rows);
  assert.deepEqual(summary.byMonth, [
    { month: "2024-01", total: 500, quantity: 3, count: 2 },
    { month: "2024-02", total: 1000, quantity: 5, count: 2 },
  ]);
  assert.deepEqual(summary.byProduct[0], {
    product: "A",
    total: 1200,
    quantity: 4,
    count: 2,
  });
  assert.deepEqual(summary.byCategory, [
    { category: "文具", total: 1300, quantity: 6, count: 3 },
    { category: "事務", total: 200, quantity: 2, count: 1 },
  ]);
});

test("合計と平均と件数", () => {
  const summary = summarize(rows);
  assert.equal(summary.total, 1500);
  assert.equal(summary.quantity, 8);
  assert.equal(summary.count, 4);
  assert.equal(summary.average, 375);
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
    ].join("\n"),
  );
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
