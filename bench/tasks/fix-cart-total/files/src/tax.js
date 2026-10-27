/**
 * 消費税の計算。
 *
 * 金額はすべて円の整数で扱う。税率は 0〜1 の小数で受け取る。
 * 税額は 1 円未満を切り捨てる（端数切り捨て）。これは会計の
 * 表示と、レシートの税額欄を一致させるための仕様。
 */

export const DEFAULT_TAX_RATE = 0.1;
export const REDUCED_TAX_RATE = 0.08;

/**
 * 税率として使える値かを確かめる。
 * @param {number} rate
 * @returns {number}
 */
export function validateRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("tax rate must be between 0 and 1");
  }
  return value;
}

/**
 * 税抜金額から税額を求める。1 円未満は切り捨てる。
 * @param {number} amount
 * @param {number} [rate]
 * @returns {number}
 */
export function calculateTax(amount, rate = DEFAULT_TAX_RATE) {
  const value = Number(amount);
  const validated = validateRate(rate);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("amount must be a non-negative number");
  }
  return Math.floor(value * validated);
}

/**
 * 税抜金額から税込金額を求める。
 * @param {number} amount
 * @param {number} [rate]
 * @returns {number}
 */
export function totalWithTax(amount, rate = DEFAULT_TAX_RATE) {
  return Number(amount) + calculateTax(amount, rate);
}

/**
 * 税込金額から税抜金額を求める。端数は切り捨てる。
 * @param {number} amount
 * @param {number} [rate]
 * @returns {number}
 */
export function amountWithoutTax(amount, rate = DEFAULT_TAX_RATE) {
  const validated = validateRate(rate);
  return Math.floor(Number(amount) / (1 + validated));
}

/**
 * 税込金額から税額だけを求める。
 * @param {number} amount
 * @param {number} [rate]
 * @returns {number}
 */
export function taxIncluded(amount, rate = DEFAULT_TAX_RATE) {
  return Number(amount) - amountWithoutTax(amount, rate);
}

/**
 * 標準税率と軽減税率が混ざった明細の税額を求める。
 * 各行は { amount, reduced } の形で、amount は税抜金額。
 * @param {{amount: number, reduced?: boolean}[]} lines
 * @param {number} [standardRate]
 * @param {number} [reducedRate]
 * @returns {{standard: number, reduced: number, total: number}}
 */
export function calculateMixedTax(
  lines,
  standardRate = DEFAULT_TAX_RATE,
  reducedRate = REDUCED_TAX_RATE,
) {
  const standard = lines
    .filter((line) => !line.reduced)
    .reduce((sum, line) => sum + Number(line.amount), 0);
  const reduced = lines
    .filter((line) => line.reduced)
    .reduce((sum, line) => sum + Number(line.amount), 0);
  const standardTax = calculateTax(standard, standardRate);
  const reducedTax = calculateTax(reduced, reducedRate);
  return { standard: standardTax, reduced: reducedTax, total: standardTax + reducedTax };
}

/**
 * 税率ごとの内訳を返す。
 * @param {number} amount
 * @param {number} [rate]
 * @returns {{rate: number, taxable: number, tax: number, total: number}}
 */
export function taxBreakdown(amount, rate = DEFAULT_TAX_RATE) {
  const taxable = Number(amount);
  const tax = calculateTax(taxable, rate);
  return { rate, taxable, tax, total: taxable + tax };
}

/**
 * 税額を税率ごとにまとめる。
 * @param {{rate: number, taxable: number}[]} groups
 * @returns {{rate: number, taxable: number, tax: number, total: number}[]}
 */
export function summarizeTax(groups) {
  const merged = new Map();
  for (const group of groups) {
    const rate = validateRate(group.rate);
    const current = merged.get(rate) ?? { rate, taxable: 0, tax: 0, total: 0 };
    current.taxable += Number(group.taxable);
    current.tax = calculateTax(current.taxable, rate);
    current.total = current.taxable + current.tax;
    merged.set(rate, current);
  }
  return [...merged.values()].sort((left, right) => left.rate - right.rate);
}

/**
 * 税率を表示用の文字列にする。
 * @param {number} rate
 * @returns {string}
 */
export function formatTaxRate(rate) {
  return `${Number(rate) * 100}%`;
}

/**
 * 軽減税率の対象になりうる区分かを返す。
 * @param {string} category
 * @returns {boolean}
 */
export function isReducedCategory(category) {
  return category === "food" || category === "newspaper";
}

/**
 * 区分から税率を選ぶ。
 * @param {string} category
 * @param {number} [standardRate]
 * @param {number} [reducedRate]
 * @returns {number}
 */
export function rateForCategory(
  category,
  standardRate = DEFAULT_TAX_RATE,
  reducedRate = REDUCED_TAX_RATE,
) {
  return isReducedCategory(category) ? reducedRate : standardRate;
}
