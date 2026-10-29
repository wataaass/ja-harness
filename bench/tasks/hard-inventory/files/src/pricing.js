/**
 * 注文金額の計算。
 *
 * 仕様の順番は、小計 → 割引 → 税 → 合計。割引は税抜きの小計に掛け、
 * 税は割引後の金額に掛ける。各段階で円未満を四捨五入する。
 */

import { lineSubtotal } from "./models.js";
import { roundYen, taxOf, taxRateFor } from "./tax.js";

/**
 * 明細1行の金額を計算する。
 *
 * @param {{
 *   unitPrice: number,
 *   quantity: number,
 *   taxCategory?: string,
 *   taxRate?: number,
 * }} line
 * @param {number} discountRate
 * @returns {{
 *   subtotal: number,
 *   discount: number,
 *   taxable: number,
 *   tax: number,
 *   total: number,
 *   taxCategory: string,
 *   taxRate: number,
 * }}
 */
export function priceLine(line, discountRate = 0) {
  if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 1) {
    throw new RangeError("割引率は0から1の数です");
  }
  const taxCategory = line.taxCategory ?? "standard";
  const taxRate = line.taxRate ?? taxRateFor(taxCategory);
  const subtotal = lineSubtotal(line);
  const tax = taxOf(subtotal, taxRate);
  const gross = subtotal + tax;
  const discount = roundYen(gross * discountRate);
  const taxable = subtotal;
  return {
    subtotal,
    discount,
    taxable,
    tax,
    total: gross - discount,
    taxCategory,
    taxRate,
  };
}

/**
 * 明細全体の合計を計算する。
 *
 * @param {Array<{
 *   unitPrice: number,
 *   quantity: number,
 *   taxCategory?: string,
 *   taxRate?: number,
 * }>} lines
 * @param {{discountRate?: number}} [options]
 * @returns {{
 *   subtotal: number,
 *   discount: number,
 *   taxable: number,
 *   tax: number,
 *   total: number,
 *   quantity: number,
 *   lines: Array<ReturnType<typeof priceLine>>,
 * }}
 */
export function calculateTotals(lines, options = {}) {
  const discountRate = options.discountRate ?? 0;
  const priced = lines.map((line) => priceLine(line, discountRate));
  let subtotal = 0;
  let discount = 0;
  let taxable = 0;
  let tax = 0;
  let total = 0;
  let quantity = 0;
  for (const [index, line] of priced.entries()) {
    subtotal += line.subtotal;
    discount += line.discount;
    taxable += line.taxable;
    tax += line.tax;
    total += line.total;
    quantity += lines[index]?.quantity ?? 0;
  }
  return { subtotal, discount, taxable, tax, total, quantity, lines: priced };
}

/**
 * 税の区分ごとの金額をまとめる。
 *
 * @param {Array<ReturnType<typeof priceLine>>} lines
 * @returns {Record<string, {subtotal: number, discount: number, tax: number, total: number}>}
 */
export function totalsByTaxCategory(lines) {
  const result = {};
  for (const line of lines) {
    const current = result[line.taxCategory] ?? {
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
    };
    current.subtotal += line.subtotal;
    current.discount += line.discount;
    current.tax += line.tax;
    current.total += line.total;
    result[line.taxCategory] = current;
  }
  return result;
}

/**
 * 合計を短い文にする。
 *
 * @param {{subtotal: number, discount: number, tax: number, total: number}} totals
 * @returns {string}
 */
export function describeTotals(totals) {
  return `小計 ${totals.subtotal} 円、割引 ${totals.discount} 円、税 ${totals.tax} 円、合計 ${totals.total} 円`;
}

/**
 * 2 つの合計の差を返す。確認用。
 *
 * @param {{total: number}} left
 * @param {{total: number}} right
 * @returns {number}
 */
export function totalDifference(left, right) {
  return left.total - right.total;
}
