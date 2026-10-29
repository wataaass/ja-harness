import test from "node:test";
import assert from "node:assert/strict";
import { dailySales, jstDateKey } from "../src/report.js";

test("JST の日付は UTC の 15 時に変わる", () => {
  assert.equal(jstDateKey("2024-01-01T14:59:59Z"), "2024-01-01");
  assert.equal(jstDateKey("2024-01-01T15:00:00Z"), "2024-01-02");
});

test("日別の売上は JST でまとめる", () => {
  const rows = dailySales([
    { placedAt: "2024-01-01T14:00:00Z", total: 1000, status: "paid" },
    { placedAt: "2024-01-01T15:30:00Z", total: 2000, status: "paid" },
  ]);
  assert.deepEqual(rows, [
    { date: "2024-01-01", orders: 1, revenue: 1000 },
    { date: "2024-01-02", orders: 1, revenue: 2000 },
  ]);
});

test("取り消した注文は数えない", () => {
  const rows = dailySales([
    { placedAt: "2024-01-02T01:00:00Z", total: 1000, status: "paid" },
    { placedAt: "2024-01-02T02:00:00Z", total: 500, status: "cancelled" },
  ]);
  assert.deepEqual(rows, [
    { date: "2024-01-02", orders: 1, revenue: 1000 },
  ]);
});

test("日付の古い順に並べる", () => {
  const rows = dailySales([
    { placedAt: "2024-01-03T01:00:00Z", total: 300, status: "paid" },
    { placedAt: "2024-01-01T01:00:00Z", total: 100, status: "paid" },
  ]);
  assert.deepEqual(
    rows.map((row) => row.date),
    ["2024-01-01", "2024-01-03"],
  );
});
