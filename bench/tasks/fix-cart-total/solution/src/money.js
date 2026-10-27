import {
  cashStep,
  formatCurrency,
  getCurrency,
  toMinorUnits,
} from "./currencies.js";

export const ROUNDING_MODES = [
  "half-up",
  "half-down",
  "half-even",
  "ceil",
  "floor",
  "trunc",
  "away-from-zero",
  "toward-zero",
];

function movePoint(value, decimals) {
  const factor = 10 ** decimals;
  return { factor, scaled: value * factor };
}

function roundHalfUp(value, decimals = 0) {
  const { factor, scaled } = movePoint(value, decimals);
  return (scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5)) / factor;
}

function roundHalfDown(value, decimals = 0) {
  const { factor, scaled } = movePoint(value, decimals);
  return (scaled >= 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5)) / factor;
}

function roundHalfEven(value, decimals = 0) {
  const { factor, scaled } = movePoint(value, decimals);
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  let result;
  if (fraction > 0.5) {
    result = lower + 1;
  } else if (fraction < 0.5) {
    result = lower;
  } else {
    result = lower % 2 === 0 ? lower : lower + 1;
  }
  return result / factor;
}

/**
 * 丸めの種類を指定して数値を丸める。
 * @param {number} value
 * @param {string} mode
 * @param {number} [decimals]
 * @returns {number}
 */
export function roundWithMode(value, mode, decimals = 0) {
  if (!ROUNDING_MODES.includes(mode)) {
    throw new RangeError(`unknown rounding mode: ${mode}`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new RangeError("value must be finite");
  }
  const { factor, scaled } = movePoint(number, decimals);
  switch (mode) {
    case "half-up":
      return roundHalfUp(number, decimals);
    case "half-down":
      return roundHalfDown(number, decimals);
    case "half-even":
      return roundHalfEven(number, decimals);
    case "ceil":
      return Math.ceil(scaled) / factor;
    case "floor":
      return Math.floor(scaled) / factor;
    case "trunc":
      return Math.trunc(scaled) / factor;
    case "away-from-zero":
      return (scaled >= 0 ? Math.ceil(scaled) : Math.floor(scaled)) / factor;
    case "toward-zero":
      return (scaled >= 0 ? Math.floor(scaled) : Math.ceil(scaled)) / factor;
    default:
      throw new RangeError(`unknown rounding mode: ${mode}`);
  }
}

/**
 * 小数の金額を最小単位の整数へ丸める。既定は四捨五入。
 * @param {number} amount
 * @param {string} [currency]
 * @param {string} [mode]
 * @returns {number}
 */
export function roundToMinor(amount, currency = "JPY", mode = "half-up") {
  const definition = getCurrency(currency);
  return roundWithMode(Number(amount) * 10 ** definition.minorUnit, mode, 0);
}

/**
 * 最小単位の整数を、その通貨の表示用の数値へ戻す。
 * @param {number} minor
 * @param {string} [currency]
 * @returns {number}
 */
export function minorToMajor(minor, currency = "JPY") {
  const definition = getCurrency(currency);
  return Number(minor) / 10 ** definition.minorUnit;
}

/**
 * 表示用の数値を最小単位の整数へ変換する。
 * @param {number} major
 * @param {string} [currency]
 * @param {string} [mode]
 * @returns {number}
 */
export function majorToMinor(major, currency = "JPY", mode = "half-up") {
  const definition = getCurrency(currency);
  return roundWithMode(Number(major), mode, definition.minorUnit) * 10 ** definition.minorUnit;
}

/**
 * 金額を割合で按分する。
 *
 * - 戻り値の合計は必ず amount と一致する。
 * - 各要素は整数で、負の重みは受け付けない。
 * - 端数は「切り捨てたときの小数部」が大きい順に 1 ずつ配る。
 * - 小数部が同じときは、前の要素を優先する。
 *
 * @param {number} amount
 * @param {number[]} weights
 * @returns {number[]}
 */
export function allocate(amount, weights) {
  const total = Math.trunc(Number(amount));
  if (!Number.isFinite(total)) {
    throw new RangeError("amount must be finite");
  }
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new RangeError("weights must be a non-empty array");
  }
  const values = weights.map((weight) => Number(weight));
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("weights must be non-negative numbers");
  }
  const weightTotal = values.reduce((sum, value) => sum + value, 0);
  if (weightTotal === 0) {
    const result = values.map(() => 0);
    result[0] = total;
    return result;
  }

  const exact = values.map((value) => (total * value) / weightTotal);
  const result = exact.map((value) => Math.floor(value));
  let remainder = total - result.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort(compareRemainders);
  for (const entry of order) {
    if (remainder <= 0) {
      break;
    }
    result[entry.index] += 1;
    remainder -= 1;
  }
  return result;
}

/**
 * 金額を等分する。割り切れない端数は先頭から 1 ずつ配る。
 * @param {number} amount
 * @param {number} count
 * @returns {number[]}
 */
export function splitEvenly(amount, count) {
  const total = Math.trunc(Number(amount));
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError("count must be a positive integer");
  }
  return allocate(total, new Array(count).fill(1));
}

/**
 * 金額の合計を返す。
 * @param {number[]} values
 * @returns {number}
 */
export function sum(values) {
  return values.reduce((total, value) => total + Number(value), 0);
}

/**
 * 金額の平均を返す。端数は四捨五入する。
 * @param {number[]} values
 * @returns {number}
 */
export function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(sum(values) / values.length);
}

/**
 * 割合をかけた金額を返す。端数は既定で四捨五入。
 * @param {number} amount
 * @param {number} rate
 * @param {string} [mode]
 * @returns {number}
 */
export function applyRate(amount, rate, mode = "half-up") {
  return roundWithMode(Number(amount) * Number(rate), mode, 0);
}

/**
 * 割合（0〜1）を百分率の文字列にする。
 * @param {number} rate
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatRate(rate, decimals = 0) {
  return `${(Number(rate) * 100).toFixed(decimals)}%`;
}

/**
 * 金額が 0 以上かを返す。
 * @param {number} value
 * @returns {boolean}
 */
export function isNonNegative(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

/**
 * 金額を現金単位に丸める。現金単位は通貨定義から取る。
 * @param {number} minor
 * @param {string} [currency]
 * @returns {number}
 */
export function roundForCash(minor, currency = "JPY") {
  const step = cashStep(currency);
  return Math.round(Number(minor) / step) * step;
}

/**
 * 最小単位の金額を通貨記号つきで整形する。
 * @param {number} minor
 * @param {string} [currency]
 * @param {{withCode?: boolean, signDisplay?: "auto"|"always"|"never"}} [options]
 * @returns {string}
 */
export function displayMinor(minor, currency = "JPY", options = {}) {
  return formatCurrency(Number(minor), currency, options);
}

/**
 * 小数の金額を通貨記号つきで整形する。
 * @param {number} amount
 * @param {string} [currency]
 * @param {{withCode?: boolean, signDisplay?: "auto"|"always"|"never"}} [options]
 * @returns {string}
 */
export function displayAmount(amount, currency = "JPY", options = {}) {
  return formatCurrency(toMinorUnits(amount, currency), currency, options);
}

/**
 * 2 つの金額の差を返す。負になる場合もある。
 * @param {number} left
 * @param {number} right
 * @returns {number}
 */
export function difference(left, right) {
  return Number(left) - Number(right);
}

/**
 * 金額を上限と下限の間に収める。
 * @param {number} value
 * @param {number} lower
 * @param {number} upper
 * @returns {number}
 */
export function clamp(value, lower, upper) {
  return Math.min(Math.max(Number(value), Number(lower)), Number(upper));
}

/**
 * 金額の配列から、指定した条件に合うものだけを合計する。
 * @param {number[]} values
 * @param {(value: number, index: number) => boolean} predicate
 * @returns {number}
 */
export function sumWhere(values, predicate) {
  return values.reduce(
    (total, value, index) => (predicate(value, index) ? total + Number(value) : total),
    0,
  );
}

/**
 * 金額を割合で分けたときの、最後の 1 円の寄せ先を決めるための比較関数。
 * 大きい小数部が前に来る。
 * @param {{index: number, fraction: number}} left
 * @param {{index: number, fraction: number}} right
 * @returns {number}
 */
export function compareRemainders(left, right) {
  if (left.fraction !== right.fraction) {
    return right.fraction - left.fraction;
  }
  return left.index - right.index;
}

/**
 * 税抜金額から税込金額を出す。税率は 0〜1。
 * @param {number} amount
 * @param {number} rate
 * @param {string} [mode]
 * @returns {number}
 */
export function addRate(amount, rate, mode = "half-up") {
  return Number(amount) + applyRate(amount, rate, mode);
}

/**
 * 税込金額から税抜金額を出す。
 * @param {number} amount
 * @param {number} rate
 * @param {string} [mode]
 * @returns {number}
 */
export function removeRate(amount, rate, mode = "half-up") {
  return roundWithMode(Number(amount) / (1 + Number(rate)), mode, 0);
}

/**
 * 2 つの金額を安全に足す。NaN は 0 として扱う。
 * @param {number} left
 * @param {number} right
 * @returns {number}
 */
export function safeAdd(left, right) {
  const a = Number.isFinite(Number(left)) ? Number(left) : 0;
  const b = Number.isFinite(Number(right)) ? Number(right) : 0;
  return a + b;
}

/**
 * 金額の配列を、指定した単位で切り上げる。
 * @param {number} value
 * @param {number} unit
 * @returns {number}
 */
export function ceilToUnit(value, unit) {
  const size = Math.max(1, Math.trunc(Number(unit)));
  return Math.ceil(Number(value) / size) * size;
}

/**
 * 金額の配列を、指定した単位で切り捨てる。
 * @param {number} value
 * @param {number} unit
 * @returns {number}
 */
export function floorToUnit(value, unit) {
  const size = Math.max(1, Math.trunc(Number(unit)));
  return Math.floor(Number(value) / size) * size;
}

/**
 * 金額の配列を、指定した単位で四捨五入する。
 * @param {number} value
 * @param {number} unit
 * @returns {number}
 */
export function roundToUnit(value, unit) {
  const size = Math.max(1, Math.trunc(Number(unit)));
  return Math.round(Number(value) / size) * size;
}
