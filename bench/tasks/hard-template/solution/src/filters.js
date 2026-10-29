/**
 * フィルター。
 *
 * フィルターは値を1つ受け取り、値を返す。`|` でつなぐと左から順に
 * 適用される。`safe` だけは、エスケープしない印を付ける。
 */

import {
  escapeHtml,
  isSafeString,
  markSafe,
  plainText,
} from "./escape.js";
import { TemplateError } from "./errors.js";

/**
 * 大文字にする。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function upper(value) {
  return plainText(value).toUpperCase();
}

/**
 * 小文字にする。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function lower(value) {
  return plainText(value).toLowerCase();
}

/**
 * 空のときに代わりの値を返す。
 *
 * undefined、null、空文字のときだけ代わりを使う。0 と false は
 * そのまま残す。
 *
 * @param {unknown} value
 * @param {unknown} fallback
 * @returns {unknown}
 */
export function defaultFilter(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
}

/**
 * 配列を文字列につなぐ。
 *
 * @param {unknown} value
 * @param {string} [separator]
 * @returns {string}
 */
export function join(value, separator = ", ") {
  if (!Array.isArray(value)) {
    throw new TemplateError("join は配列にだけ使えます");
  }
  return value.map((item) => plainText(item)).join(separator);
}

/**
 * 長い文字列を切り詰める。切ったときは末尾に「…」を付ける。
 *
 * @param {unknown} value
 * @param {number} length
 * @returns {string}
 */
export function truncate(value, length) {
  if (!Number.isInteger(length) || length < 0) {
    throw new TemplateError("truncate の長さは0以上の整数です");
  }
  const text = plainText(value);
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length)}…`;
}

/**
 * エスケープしない印を付ける。
 *
 * @param {unknown} value
 * @returns {ReturnType<typeof markSafe>}
 */
export function safe(value) {
  if (isSafeString(value)) {
    return value;
  }
  return markSafe(plainText(value));
}

/**
 * 明示的に HTML エスケープする。
 *
 * @param {unknown} value
 * @returns {ReturnType<typeof markSafe>}
 */
export function escapeFilter(value) {
  return markSafe(escapeHtml(plainText(value)));
}

/**
 * 長さを返す。文字列、配列、オブジェクトに対応する。
 *
 * @param {unknown} value
 * @returns {number}
 */
export function length(value) {
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length;
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value).length;
  }
  return 0;
}

/**
 * 前後の空白を落とす。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function trim(value) {
  return plainText(value).trim();
}

/**
 * 文字列を置き換える。
 *
 * @param {unknown} value
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export function replace(value, from, to = "") {
  return plainText(value).split(String(from)).join(String(to));
}

/**
 * 先頭を大文字、残りを小文字にする。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function capitalize(value) {
  const text = plainText(value);
  if (text === "") {
    return "";
  }
  return text.slice(0, 1).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * 名前からフィルターを引く。
 *
 * @param {string} name
 * @returns {(value: unknown, ...args: unknown[]) => unknown}
 */
export function filterByName(name) {
  switch (name) {
    case "upper":
      return upper;
    case "lower":
      return lower;
    case "default":
      return defaultFilter;
    case "join":
      return join;
    case "truncate":
      return truncate;
    case "safe":
      return safe;
    case "escape":
      return escapeFilter;
    case "length":
      return length;
    case "trim":
      return trim;
    case "replace":
      return replace;
    case "capitalize":
      return capitalize;
    default:
      throw new TemplateError(`知らないフィルターです: ${name}`);
  }
}

/**
 * フィルターを適用する。誤りには行番号を付ける。
 *
 * @param {string} name
 * @param {unknown} value
 * @param {unknown[]} args
 * @param {number} [line]
 * @returns {unknown}
 */
export function applyFilter(name, value, args = [], line) {
  try {
    const filter = filterByName(name);
    return filter(value, ...args);
  } catch (error) {
    if (error instanceof TemplateError) {
      throw new TemplateError(error.message, line);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new TemplateError(message, line);
  }
}

/**
 * フィルターの一覧。仕様の確認と画面の補助に使う。
 *
 * @returns {string[]}
 */
export function filterNames() {
  return [
    "upper",
    "lower",
    "default",
    "join",
    "truncate",
    "safe",
    "escape",
    "length",
    "trim",
    "replace",
    "capitalize",
  ];
}
