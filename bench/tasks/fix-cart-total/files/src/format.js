import { formatCurrency } from "./currencies.js";

/**
 * 円の金額を表示用に整形する。端数は四捨五入する。
 * @param {number} amount
 * @returns {string}
 */
export function formatYen(amount) {
  return formatCurrency(Math.round(Number(amount)), "JPY");
}

/**
 * 数値を 3 桁区切りにする。
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return Number(value).toLocaleString("ja-JP");
}

/**
 * 割引の行を整形する。
 * @param {{label: string, amount: number}} applied
 * @returns {string}
 */
export function formatDiscountLine(applied) {
  return `${applied.label}: -${formatYen(applied.amount)}`;
}

/**
 * カートのまとめを短い文字列にする。
 * @param {{subtotal: number, discountTotal: number, tax: number, total: number}} summary
 * @returns {string}
 */
export function formatCartSummary(summary) {
  const lines = [`小計 ${formatYen(summary.subtotal)}`];
  if (summary.discountTotal > 0) {
    lines.push(`割引 -${formatYen(summary.discountTotal)}`);
  }
  lines.push(`税 ${formatYen(summary.tax)}`);
  if (summary.shipping > 0) {
    lines.push(`送料 ${formatYen(summary.shipping)}`);
  }
  lines.push(`合計 ${formatYen(summary.total)}`);
  return lines.join("\n");
}

/**
 * レシートを整形する。
 * @param {{items: object[], applied: object[], subtotal: number, discountTotal: number, tax: number, shipping: number, total: number}} summary
 * @param {{title?: string, showShipping?: boolean}} [options]
 * @returns {string}
 */
export function formatReceipt(summary, options = {}) {
  const lines = [];
  if (options.title) {
    lines.push(options.title);
  }
  for (const item of summary.items) {
    lines.push(`${item.name ?? item.sku} x${item.quantity} ${formatYen(item.unitPrice * item.quantity)}`);
  }
  lines.push("---");
  lines.push(`小計 ${formatYen(summary.subtotal)}`);
  for (const applied of summary.applied) {
    lines.push(formatDiscountLine(applied));
  }
  lines.push(`税 ${formatYen(summary.tax)}`);
  if (options.showShipping !== false && summary.shipping > 0) {
    lines.push(`送料 ${formatYen(summary.shipping)}`);
  }
  lines.push(`合計 ${formatYen(summary.total)}`);
  return lines.join("\n");
}

/**
 * 明細の 1 行を整形する。
 * @param {{name?: string, sku: string, quantity: number, unitPrice: number}} item
 * @returns {string}
 */
export function formatLine(item) {
  return `${item.name ?? item.sku}\t${item.quantity}\t${formatYen(item.unitPrice)}\t${formatYen(item.unitPrice * item.quantity)}`;
}

/**
 * カートの明細を表形式にする。
 * @param {object[]} items
 * @returns {string}
 */
export function formatItemsTable(items) {
  const header = ["商品", "数量", "単価", "金額"].join("\t");
  return [header, ...items.map((item) => formatLine(item))].join("\n");
}

/**
 * 割引の説明をまとめる。
 * @param {object[]} applied
 * @returns {string}
 */
export function formatAppliedDiscounts(applied) {
  if (applied.length === 0) {
    return "割引なし";
  }
  return applied.map((entry) => formatDiscountLine(entry)).join("\n");
}

/**
 * まとめの数値を、画面用の短いオブジェクトにする。
 * @param {object} summary
 * @returns {{subtotal: string, discount: string, tax: string, shipping: string, total: string}}
 */
export function formatSummaryFields(summary) {
  return {
    subtotal: formatYen(summary.subtotal),
    discount: formatYen(summary.discountTotal),
    tax: formatYen(summary.tax),
    shipping: formatYen(summary.shipping),
    total: formatYen(summary.total),
  };
}

/**
 * 金額を「約」つきで整形する。
 * @param {number} amount
 * @returns {string}
 */
export function formatApprox(amount) {
  return `約${formatYen(amount)}`;
}

/**
 * 割合を表示用にする。
 * @param {number} rate
 * @returns {string}
 */
export function formatPercent(rate) {
  return `${Number(rate) * 100}%`;
}

/**
 * 数量を「点」つきで整形する。
 * @param {number} count
 * @returns {string}
 */
export function formatCount(count) {
  return `${Number(count)}点`;
}
