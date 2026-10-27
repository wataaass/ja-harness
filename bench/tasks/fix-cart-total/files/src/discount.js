import { allocate } from "./money.js";

const COUPONS = {
  SAVE10: { kind: "percentage", value: 0.1 },
  SAVE20: { kind: "percentage", value: 0.2 },
  MINUS500: { kind: "fixed", value: 500 },
  SHIP500: { kind: "fixed", value: 500 },
};

/**
 * 割引の適用結果。
 * @typedef {{applied: {label: string, amount: number}[], discountTotal: number, discountedSubtotal: number}} DiscountResult
 */

/**
 * 百分率の割引を作る。
 * @param {number} rate 0〜1
 * @returns {{type: "percentage", value: number}}
 */
export function percentage(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("percentage must be between 0 and 1");
  }
  return { type: "percentage", value };
}

/**
 * 固定額の割引を作る。
 * @param {number} amount
 * @returns {{type: "fixed", value: number}}
 */
export function fixed(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("fixed amount must be non-negative");
  }
  return { type: "fixed", value };
}

/**
 * しきい値つきの固定額割引を作る。小計がしきい値「以上」で適用する。
 * @param {number} thresholdAmount
 * @param {number} amount
 * @returns {{type: "threshold", threshold: number, value: number}}
 */
export function threshold(thresholdAmount, amount) {
  const limit = Number(thresholdAmount);
  const value = Number(amount);
  if (!Number.isFinite(limit) || limit < 0) {
    throw new RangeError("threshold must be non-negative");
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("amount must be non-negative");
  }
  return { type: "threshold", threshold: limit, value };
}

/**
 * クーポンコードから割引を作る。
 * @param {string} code
 * @returns {{type: "percentage"|"fixed", value: number, code: string}}
 */
export function coupon(code) {
  const key = String(code).toUpperCase();
  const definition = COUPONS[key];
  if (!definition) {
    throw new RangeError(`unknown coupon: ${code}`);
  }
  return { type: definition.kind, value: definition.value, code: key };
}

/**
 * 割引額を求める。割引額の端数は四捨五入する。
 * @param {number} subtotal
 * @param {{type: string, value?: number, threshold?: number}} discount
 * @returns {number}
 */
export function discountAmount(subtotal, discount) {
  const base = Number(subtotal);
  if (!Number.isFinite(base) || base < 0) {
    throw new RangeError("subtotal must be a non-negative number");
  }
  if (!discount || typeof discount !== "object") {
    throw new TypeError("discount must be an object");
  }
  if (discount.type === "percentage") {
    return Math.round(base * Number(discount.value));
  }
  if (discount.type === "fixed") {
    return Math.min(base, Math.round(Number(discount.value)));
  }
  if (discount.type === "threshold") {
    return base >= Number(discount.threshold)
      ? Math.min(base, Math.round(Number(discount.value)))
      : 0;
  }
  throw new RangeError(`unknown discount type: ${discount.type}`);
}

/**
 * 割引を順番に適用する。それぞれの割引は、その時点の残額に対して計算する。
 * 割引の合計は小計を超えない。
 * @param {number} subtotal
 * @param {object[]} [discounts]
 * @returns {DiscountResult}
 */
export function applyDiscounts(subtotal, discounts = []) {
  const original = Number(subtotal);
  if (!Number.isFinite(original) || original < 0) {
    throw new RangeError("subtotal must be a non-negative number");
  }
  let remaining = original;
  let discountTotal = 0;
  const applied = [];
  for (const discount of discounts) {
    const amount = Math.min(remaining, discountAmount(remaining, discount));
    if (amount <= 0) {
      continue;
    }
    remaining -= amount;
    discountTotal += amount;
    applied.push({ label: describeDiscount(discount), amount });
  }
  return {
    applied,
    discountTotal,
    discountedSubtotal: original - discountTotal,
  };
}

/**
 * 割引の説明文を作る。
 * @param {{type: string, value?: number, threshold?: number, code?: string}} discount
 * @returns {string}
 */
export function describeDiscount(discount) {
  if (discount.type === "percentage") {
    return `${Number(discount.value) * 100}%オフ`;
  }
  if (discount.type === "fixed") {
    return `${Number(discount.value)}円引き`;
  }
  if (discount.type === "threshold") {
    return `${Number(discount.threshold)}円以上で${Number(discount.value)}円引き`;
  }
  if (discount.type === "coupon") {
    return COUPONS[discount.code] ? describeDiscount(coupon(discount.code)) : "クーポン";
  }
  return "割引";
}

/**
 * 割引額を明細の金額比で配分する。
 * 合計は必ず discountTotal と一致し、端数は money.allocate の規則で配る。
 * @param {number} discountTotal
 * @param {number[]} lineTotals
 * @returns {number[]}
 */
export function allocateDiscount(discountTotal, lineTotals) {
  return allocate(discountTotal, lineTotals);
}

/**
 * 割引の一覧から、適用可能なものだけを返す。
 * @param {number} subtotal
 * @param {object[]} discounts
 * @returns {object[]}
 */
export function eligibleDiscounts(subtotal, discounts) {
  return discounts.filter((discount) => discountAmount(Number(subtotal), discount) > 0);
}

/**
 * 割引の合計額を返す。
 * @param {number} subtotal
 * @param {object[]} discounts
 * @returns {number}
 */
export function totalDiscount(subtotal, discounts = []) {
  return applyDiscounts(subtotal, discounts).discountTotal;
}

/**
 * 割引後の金額を返す。
 * @param {number} subtotal
 * @param {object[]} discounts
 * @returns {number}
 */
export function discountedSubtotal(subtotal, discounts = []) {
  return applyDiscounts(subtotal, discounts).discountedSubtotal;
}

/**
 * 定義済みのクーポンコードを返す。
 * @returns {string[]}
 */
export function couponCodes() {
  return Object.keys(COUPONS).sort();
}
