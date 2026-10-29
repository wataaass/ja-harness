/**
 * for のための小さな道具。
 */

import { TemplateError } from "./errors.js";
import { typeOf } from "./values.js";

/**
 * for で回せる値にする。配列以外は誤り。無い値は空として扱う。
 *
 * @param {unknown} value
 * @param {number} [line]
 * @returns {unknown[]}
 */
export function toIterable(value, line) {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  throw new TemplateError(
    `for には配列を渡します（${typeOf(value)} が来ました）`,
    line,
  );
}

/**
 * 回の中の `loop` を作る。index は 1 から。
 *
 * @param {number} index0
 * @param {number} length
 * @returns {{
 *   index: number,
 *   index0: number,
 *   first: boolean,
 *   last: boolean,
 *   length: number,
 * }}
 */
export function loopContext(index0, length) {
  return {
    index: index0 + 1,
    index0,
    first: index0 === 0,
    last: index0 === length - 1,
    length,
  };
}

/**
 * 回の名前を短くする。確認用。
 *
 * @param {{index: number, length: number}} loop
 * @returns {string}
 */
export function describeLoop(loop) {
  return `${loop.index}/${loop.length}`;
}
