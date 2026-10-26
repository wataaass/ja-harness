const DEFAULT_GROUP_SEPARATORS = [",", " ", "'", "\u00a0", "\u202f"];

/**
 * 数値の文字列を読み取る。
 *
 * - `1,234.5` のような桁区切りを受け付ける。
 * - 先頭の `-` は負の数。
 * - 全体を括弧で囲んだ `(1,234)` も負の数として扱う（会計の表記）。
 * - 読めない値は null を返す。空文字も null。
 *
 * @param {unknown} value
 * @param {{thousands?: string, decimal?: string}} [options]
 * @returns {number|null}
 */
export function parseNumber(value, options = {}) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value === null || value === undefined) {
    return null;
  }
  let text = String(value).trim();
  if (text === "") {
    return null;
  }

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  if (text === "") {
    return null;
  }

  const decimal = options.decimal ?? ".";
  const separators = options.thousands
    ? [options.thousands]
    : DEFAULT_GROUP_SEPARATORS.filter((separator) => separator !== decimal);

  for (const separator of separators) {
    text = text.split(separator).join("");
  }
  if (decimal !== ".") {
    text = text.split(decimal).join(".");
  }
  if (!/^\d*\.?\d*$/.test(text) || text === "" || text === ".") {
    return null;
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return negative ? -parsed : parsed;
}

/**
 * 整数として読み取る。小数を含む値と読めない値は null。
 * @param {unknown} value
 * @param {{thousands?: string}} [options]
 * @returns {number|null}
 */
export function parseInteger(value, options = {}) {
  const parsed = parseNumber(value, options);
  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

/**
 * 真偽値として読み取る。受け付ける表記は true/false、yes/no、1/0。
 * @param {unknown} value
 * @returns {boolean|null}
 */
export function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(text)) {
    return true;
  }
  if (["false", "no", "0"].includes(text)) {
    return false;
  }
  return null;
}

/**
 * 百分率の文字列を割合に直す。`12.5%` は 0.125。
 * @param {unknown} value
 * @returns {number|null}
 */
export function parsePercent(value) {
  const text = String(value ?? "").trim();
  if (!text.endsWith("%")) {
    return null;
  }
  const parsed = parseNumber(text.slice(0, -1));
  return parsed === null ? null : parsed / 100;
}

/**
 * 数値を桁区切りで整形する。
 * @param {unknown} value
 * @param {{decimals?: number, decimal?: string, group?: string, parenthesesNegative?: boolean}} [options]
 * @returns {string}
 */
export function formatNumber(value, options = {}) {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return "";
  }
  const decimals = Number.isInteger(options.decimals) ? options.decimals : 0;
  const decimal = options.decimal ?? ".";
  const group = options.group ?? ",";
  const negative = parsed < 0;
  const absolute = Math.abs(parsed);
  const fixed = absolute.toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const body = fraction === undefined ? grouped : `${grouped}${decimal}${fraction}`;
  if (!negative) {
    return body;
  }
  if (options.parenthesesNegative) {
    return `(${body})`;
  }
  return `-${body}`;
}

/**
 * 小数を指定した桁で四捨五入する。
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
export function roundTo(value, decimals = 0) {
  const factor = 10 ** decimals;
  const scaled = Number(value) * factor;
  return (scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5)) / factor;
}

/**
 * 指定した範囲に収める。
 * @param {number} value
 * @param {number} lower
 * @param {number} upper
 * @returns {number}
 */
export function clampNumber(value, lower, upper) {
  return Math.min(Math.max(Number(value), Number(lower)), Number(upper));
}

/**
 * 数値の合計を返す。読めない値は 0 として扱う。
 * @param {unknown[]} values
 * @returns {number}
 */
export function sumNumbers(values) {
  return values.reduce((total, value) => {
    const parsed = parseNumber(value);
    return total + (parsed ?? 0);
  }, 0);
}

/**
 * 数値の平均を返す。読める値がなければ null。
 * @param {unknown[]} values
 * @returns {number|null}
 */
export function averageNumbers(values) {
  const parsed = values.map((value) => parseNumber(value)).filter((value) => value !== null);
  if (parsed.length === 0) {
    return null;
  }
  return parsed.reduce((total, value) => total + value, 0) / parsed.length;
}

/**
 * 数値の配列の最小値と最大値を返す。
 * @param {unknown[]} values
 * @returns {{min: number, max: number}|null}
 */
export function numberRange(values) {
  const parsed = values.map((value) => parseNumber(value)).filter((value) => value !== null);
  if (parsed.length === 0) {
    return null;
  }
  return { min: Math.min(...parsed), max: Math.max(...parsed) };
}

/**
 * 数値を符号つきで整形する。
 * @param {unknown} value
 * @param {{decimals?: number, plus?: boolean}} [options]
 * @returns {string}
 */
export function formatSigned(value, options = {}) {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return "";
  }
  const text = formatNumber(parsed, { decimals: options.decimals ?? 0 });
  if (options.plus && parsed > 0) {
    return `+${text}`;
  }
  return text;
}

/**
 * ゼロを除いた数値の個数を返す。
 * @param {unknown[]} values
 * @returns {number}
 */
export function nonZeroCount(values) {
  return values.filter((value) => {
    const parsed = parseNumber(value);
    return parsed !== null && parsed !== 0;
  }).length;
}

/**
 * 数値を 0〜100 の範囲の百分率に丸める。
 * @param {number} value
 * @returns {number}
 */
export function normalizePercent(value) {
  return clampNumber(roundTo(value, 2), 0, 100);
}
