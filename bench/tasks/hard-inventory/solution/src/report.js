/**
 * 売上の集計。
 *
 * 日付の区切りは日本時間（JST、UTC+9）。UTC のまま切ると、
 * 日本では 0 時から 9 時までの注文が前の日に数えられてしまう。
 */

import { requireDate } from "./models.js";

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 日時を JST の YYYY-MM-DD にする。
 *
 * @param {Date|string|number} value
 * @returns {string}
 */
export function jstDateKey(value) {
  const date = requireDate(value, "日時");
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 日時を UTC の YYYY-MM-DD にする。比較用。
 *
 * @param {Date|string|number} value
 * @returns {string}
 */
export function utcDateKey(value) {
  return requireDate(value, "日時").toISOString().slice(0, 10);
}

/**
 * 日時を JST の YYYY-MM にする。
 *
 * @param {Date|string|number} value
 * @returns {string}
 */
export function jstMonthKey(value) {
  return jstDateKey(value).slice(0, 7);
}

/**
 * 日別の売上を返す。取り消した注文は数えない。
 *
 * @param {Array<{placedAt: Date|string|number, total?: number, grandTotal?: number, status?: string}>} orders
 * @param {{includeCancelled?: boolean}} [options]
 * @returns {Array<{date: string, orders: number, revenue: number}>}
 */
export function dailySales(orders, options = {}) {
  const includeCancelled = options.includeCancelled ?? false;
  const days = new Map();
  for (const order of orders) {
    if (!includeCancelled && order.status === "cancelled") {
      continue;
    }
    const date = jstDateKey(order.placedAt);
    const current = days.get(date) ?? { date, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += order.total ?? order.grandTotal ?? 0;
    days.set(date, current);
  }
  return [...days.values()].sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * 月別の売上を返す。
 *
 * @param {Array<{placedAt: Date|string|number, total?: number, grandTotal?: number, status?: string}>} orders
 * @returns {Array<{month: string, orders: number, revenue: number}>}
 */
export function monthlySales(orders) {
  const months = new Map();
  for (const order of orders) {
    if (order.status === "cancelled") {
      continue;
    }
    const month = jstMonthKey(order.placedAt);
    const current = months.get(month) ?? { month, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += order.total ?? order.grandTotal ?? 0;
    months.set(month, current);
  }
  return [...months.values()].sort((left, right) => left.month.localeCompare(right.month));
}

/**
 * 商品 id ごとの数量と売上を返す。
 *
 * @param {Array<{lines?: Array<{productId: string, quantity: number, unitPrice: number}>}>} orders
 * @returns {Array<{productId: string, quantity: number, revenue: number}>}
 */
export function salesByProduct(orders) {
  const products = new Map();
  for (const order of orders) {
    for (const line of order.lines ?? []) {
      const current = products.get(line.productId) ?? {
        productId: line.productId,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += line.quantity;
      current.revenue += line.unitPrice * line.quantity;
      products.set(line.productId, current);
    }
  }
  return [...products.values()].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  );
}

/**
 * 日別の売上を表の文字列にする。
 *
 * @param {Array<{date: string, orders: number, revenue: number}>} rows
 * @returns {string}
 */
export function formatDailySales(rows) {
  const lines = ["日付\t注文\t売上"];
  for (const row of rows) {
    lines.push(`${row.date}\t${row.orders}\t${row.revenue}`);
  }
  return lines.join("\n");
}

/**
 * 期間の合計を返す。
 *
 * @param {Array<{orders: number, revenue: number}>} rows
 * @returns {{orders: number, revenue: number, days: number}}
 */
export function sumRows(rows) {
  let orders = 0;
  let revenue = 0;
  for (const row of rows) {
    orders += row.orders;
    revenue += row.revenue;
  }
  return { orders, revenue, days: rows.length };
}
