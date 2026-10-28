/**
 * フィルター。
 *
 * 今は upper と lower だけが動く。仕様にある default、join、
 * truncate、safe などはこれから足す。
 */

import { plainText } from "./escape.js";
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
 * 空のときに代わりの値を返す。まだ実装していない。
 *
 * @param {unknown} value
 * @param {unknown} fallback
 * @returns {unknown}
 */
export function defaultFilter(value, fallback) {
  throw new TemplateError("default はまだ使えません");
}

/**
 * 配列を文字列につなぐ。まだ実装していない。
 *
 * @param {unknown} value
 * @param {string} [separator]
 * @returns {string}
 */
export function join(value, separator = ", ") {
  throw new TemplateError("join はまだ使えません");
}

/**
 * 長い文字列を切り詰める。まだ実装していない。
 *
 * @param {unknown} value
 * @param {number} length
 * @returns {string}
 */
export function truncate(value, length) {
  throw new TemplateError("truncate はまだ使えません");
}

/**
 * エスケープしない印を付ける。まだ実装していない。
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function safe(value) {
  throw new TemplateError("safe はまだ使えません");
}

/**
 * 明示的に HTML エスケープする。まだ実装していない。
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function escapeFilter(value) {
  throw new TemplateError("escape はまだ使えません");
}

/**
 * 長さを返す。まだ実装していない。
 *
 * @param {unknown} value
 * @returns {number}
 */
export function length(value) {
  throw new TemplateError("length はまだ使えません");
}

/**
 * 前後の空白を落とす。まだ実装していない。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function trim(value) {
  throw new TemplateError("trim はまだ使えません");
}

/**
 * 文字列を置き換える。まだ実装していない。
 *
 * @param {unknown} value
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export function replace(value, from, to = "") {
  throw new TemplateError("replace はまだ使えません");
}

/**
 * 先頭を大文字にする。まだ実装していない。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function capitalize(value) {
  throw new TemplateError("capitalize はまだ使えません");
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
 * 使えるフィルターの一覧。
 *
 * @returns {string[]}
 */
export function filterNames() {
  return ["upper", "lower"];
}
