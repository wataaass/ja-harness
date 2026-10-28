/**
 * 値の読み方と、表示のしかた。
 *
 * テンプレートの値は、JavaScript の値をそのまま使う。ここでは
 * 「無い値」「真偽」「文字にする」の決まりだけをそろえる。
 */

import { isSafeString } from "./escape.js";

/**
 * `a.b.c` のような道をたどって値を返す。途中で無ければ undefined。
 *
 * @param {unknown} data
 * @param {string[]} path
 * @returns {unknown}
 */
export function getPath(data, path) {
  let current = data;
  for (const key of path) {
    if (current === undefined || current === null) {
      return undefined;
    }
    if (typeof current !== "object" && typeof current !== "string") {
      return undefined;
    }
    if (!Object.hasOwn(Object(current), key)) {
      return undefined;
    }
    current = Object(current)[key];
  }
  return current;
}

/**
 * 条件での真偽。0、空文字、空配列、null、undefined、false は偽。
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isTruthy(value) {
  if (value === undefined || value === null || value === false) {
    return false;
  }
  if (typeof value === "number") {
    return value !== 0 && !Number.isNaN(value);
  }
  if (typeof value === "string") {
    return value !== "";
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

/**
 * 画面に出す文字にする。null と undefined は空文字。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function display(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (isSafeString(value)) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => display(item)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * 2 つの値が等しいか。
 *
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function equals(left, right) {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  if (
    left !== null &&
    right !== null &&
    typeof left === "object" &&
    typeof right === "object"
  ) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

/**
 * 大小を比べる。両方が数のときは数の順、それ以外は文字の順。
 *
 * @param {unknown} left
 * @param {unknown} right
 * @returns {number}
 */
export function compareValues(left, right) {
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  const a = display(left);
  const b = display(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 値を短い説明にする。誤りの文で使う。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function typeOf(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}
