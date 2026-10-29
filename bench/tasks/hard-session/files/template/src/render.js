/**
 * テンプレートの木を、実際の文字にする。
 *
 * 今は文字と変数だけを出す。条件、繰り返し、include、エスケープは
 * これから足す。
 */

import { evaluate } from "./conditions.js";
import { TemplateError } from "./errors.js";
import { tokenize } from "./lexer.js";
import { parseTemplate } from "./parser.js";
import { display } from "./values.js";

/**
 * 名前をたどるための、入れ子の範囲。
 */
export class Scope {
  /**
   * @param {Scope|null} parent
   * @param {Record<string, unknown>} [values]
   */
  constructor(parent, values = {}) {
    this.parent = parent;
    this.values = values;
  }

  /**
   * 名前の道をたどる。内側の範囲から順に見る。
   *
   * @param {string[]} path
   * @returns {unknown}
   */
  resolve(path) {
    const first = path[0];
    if (first === undefined) {
      return undefined;
    }
    let scope = this;
    while (scope !== null) {
      if (Object.hasOwn(scope.values, first)) {
        let current = scope.values[first];
        for (const key of path.slice(1)) {
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
      scope = scope.parent;
    }
    return undefined;
  }
}

/**
 * ノードを描く。
 *
 * @param {object[]} nodes
 * @param {Scope} scope
 * @returns {string}
 */
export function renderNodes(nodes, scope) {
  let output = "";
  for (const node of nodes) {
    if (node.type === "text") {
      output += node.value;
      continue;
    }
    if (node.type === "output") {
      output += display(evaluate(node.expression, scope, node.line));
      continue;
    }
    throw new TemplateError("知らないノードです", node.line);
  }
  return output;
}

/**
 * テンプレートを描く。
 *
 * @param {string} template
 * @param {Record<string, unknown>} [data]
 * @param {object} [options]
 * @returns {string}
 */
export function render(template, data = {}, options = {}) {
  if (typeof template !== "string") {
    throw new TypeError("テンプレートは文字列です");
  }
  const values =
    data !== null && typeof data === "object" ? data : { value: data };
  const scope = new Scope(null, values);
  const nodes = parseTemplate(tokenize(template));
  return renderNodes(nodes, scope, options);
}
