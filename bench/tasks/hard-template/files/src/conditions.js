/**
 * 式を評価する。
 *
 * 値の読み方だけを行い、画面のための文字列化は render に任せる。
 */

import { TemplateError } from "./errors.js";
import { applyFilter } from "./filters.js";
import { compareValues, equals, isTruthy } from "./values.js";

/**
 * 式を評価する。
 *
 * @param {object} node
 * @param {{resolve: (path: string[]) => unknown}} scope
 * @param {number} [line]
 * @returns {unknown}
 */
export function evaluate(node, scope, line) {
  switch (node.type) {
    case "literal":
      return node.value;
    case "identifier":
      return scope.resolve(node.path);
    case "unary": {
      const value = evaluate(node.operand, scope, line);
      if (node.operator === "not") {
        return !isTruthy(value);
      }
      throw new TemplateError(
        `知らない単項の演算子です: ${node.operator}`,
        line,
      );
    }
    case "binary":
      return evaluateBinary(node, scope, line);
    case "filter": {
      const input = evaluate(node.input, scope, line);
      return applyFilter(
        node.name,
        input,
        node.args,
        line ?? node.line,
      );
    }
    default:
      throw new TemplateError("知らない式です", line);
  }
}

/**
 * 2項の式を評価する。and / or は短く切る。
 *
 * @param {{operator: string, left: object, right: object}} node
 * @param {{resolve: (path: string[]) => unknown}} scope
 * @param {number} [line]
 * @returns {unknown}
 */
function evaluateBinary(node, scope, line) {
  if (node.operator === "and") {
    const left = evaluate(node.left, scope, line);
    return isTruthy(left) ? isTruthy(evaluate(node.right, scope, line)) : false;
  }
  if (node.operator === "or") {
    const left = evaluate(node.left, scope, line);
    return isTruthy(left) ? true : isTruthy(evaluate(node.right, scope, line));
  }

  const left = evaluate(node.left, scope, line);
  const right = evaluate(node.right, scope, line);
  switch (node.operator) {
    case "==":
      return equals(left, right);
    case "!=":
      return !equals(left, right);
    case "<":
      return compareValues(left, right) < 0;
    case ">":
      return compareValues(left, right) > 0;
    case "<=":
      return compareValues(left, right) <= 0;
    case ">=":
      return compareValues(left, right) >= 0;
    default:
      throw new TemplateError(
        `知らない2項の演算子です: ${node.operator}`,
        line,
      );
  }
}

/**
 * 条件として評価する。
 *
 * @param {object} node
 * @param {{resolve: (path: string[]) => unknown}} scope
 * @param {number} [line]
 * @returns {boolean}
 */
export function holds(node, scope, line) {
  return isTruthy(evaluate(node, scope, line));
}
