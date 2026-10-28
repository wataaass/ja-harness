/**
 * HTML のエスケープ。
 *
 * 変数の出力は、既定で HTML を無害化する。`safe` フィルターを
 * 通した値だけは、そのまま出す。
 */

/**
 * エスケープ済みの値を表す。二重にエスケープしないために使う。
 */
export class SafeString {
  /**
   * @param {unknown} value
   */
  constructor(value) {
    this.value = value === undefined || value === null ? "" : String(value);
  }

  /**
   * @returns {string}
   */
  toString() {
    return this.value;
  }
}

/**
 * エスケープ済みかどうか。
 *
 * @param {unknown} value
 * @returns {value is SafeString}
 */
export function isSafeString(value) {
  return value instanceof SafeString;
}

/**
 * エスケープ済みの値を作る。
 *
 * @param {unknown} value
 * @returns {SafeString}
 */
export function markSafe(value) {
  return new SafeString(value);
}

const HTML_ESCAPES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/**
 * HTML の記号を実体参照にする。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * 出力用の文字列にする。エスケープするかは options.escape で決める。
 *
 * @param {unknown} value
 * @param {{escape?: boolean}} [options]
 * @returns {string}
 */
export function toHtml(value, options = {}) {
  if (isSafeString(value)) {
    return value.value;
  }
  const text = value === undefined || value === null ? "" : String(value);
  return options.escape === false ? text : escapeHtml(text);
}

/**
 * 文字列を比較しやすい形にする。エスケープ済みは中身を使う。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function plainText(value) {
  if (isSafeString(value)) {
    return value.value;
  }
  return value === undefined || value === null ? "" : String(value);
}
