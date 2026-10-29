/**
 * 税率と、円の丸め。
 *
 * 税率は注文の明細ごとの区分で決まる。区分を足すときは
 * TAX_RATES と spec の表を両方直す。
 */

export const TAX_RATES = Object.freeze({
  standard: 0.1,
  reduced: 0.08,
  exempt: 0,
});

/**
 * 税の区分から税率を返す。
 *
 * @param {string} category
 * @returns {number}
 */
export function taxRateFor(category) {
  if (!Object.hasOwn(TAX_RATES, category)) {
    throw new RangeError(`知らない税の区分です: ${category}`);
  }
  return TAX_RATES[category];
}

/**
 * 円未満を四捨五入する。負の値も同じ規則で丸める。
 *
 * @param {number} value
 * @returns {number}
 */
export function roundYen(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError("金額は有限の数です");
  }
  return Math.round(value);
}

/**
 * 金額に税率を掛けた税額を返す。円未満は四捨五入する。
 *
 * @param {number} amount
 * @param {number} rate
 * @returns {number}
 */
export function taxOf(amount, rate) {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new RangeError("税率は0以上の数です");
  }
  return roundYen(amount * rate);
}

/**
 * 税込の金額を返す。
 *
 * @param {number} amount
 * @param {number} rate
 * @returns {number}
 */
export function withTax(amount, rate) {
  return roundYen(amount) + taxOf(amount, rate);
}

/**
 * 区分ごとの内訳を作る。
 *
 * @param {Array<{amount: number, taxCategory: string}>} rows
 * @returns {Record<string, {amount: number, tax: number, rate: number}>}
 */
export function taxBreakdown(rows) {
  const result = {};
  for (const row of rows) {
    const rate = taxRateFor(row.taxCategory);
    const current = result[row.taxCategory] ?? { amount: 0, tax: 0, rate };
    current.amount += roundYen(row.amount);
    current.tax += taxOf(row.amount, rate);
    result[row.taxCategory] = current;
  }
  return result;
}

/**
 * 税率の一覧を、表示用の配列にする。
 *
 * @returns {Array<{category: string, rate: number, percent: string}>}
 */
export function taxRateTable() {
  return Object.entries(TAX_RATES).map(([category, rate]) => ({
    category,
    rate,
    percent: `${Math.round(rate * 1000) / 10}%`,
  }));
}
