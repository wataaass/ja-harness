/**
 * テンプレートの木を、実際の文字にする。
 *
 * 変数の出力は既定で HTML をエスケープする。`safe` フィルターを
 * 通した値だけは、そのまま出す。
 */

import { evaluate, holds } from "./conditions.js";
import { escapeHtml, isSafeString } from "./escape.js";
import { TemplateError } from "./errors.js";
import { createStore } from "./loader.js";
import { tokenize } from "./lexer.js";
import { loopContext, toIterable } from "./loops.js";
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
 * 出力用の文字にする。
 *
 * @param {unknown} value
 * @param {boolean} escape
 * @returns {string}
 */
function outputText(value, escape) {
  if (isSafeString(value)) {
    return value.value;
  }
  const text = display(value);
  return escape ? escapeHtml(text) : text;
}

/**
 * ノードを描く。
 *
 * @param {object[]} nodes
 * @param {Scope} scope
 * @param {{templates: ReturnType<typeof createStore>, escape: boolean, maxIncludeDepth: number}} options
 * @param {number} depth
 * @returns {string}
 */
export function renderNodes(nodes, scope, options, depth = 0) {
  let output = "";
  for (const node of nodes) {
    if (node.type === "text") {
      output += node.value;
      continue;
    }
    if (node.type === "output") {
      const value = evaluate(node.expression, scope, node.line);
      output += outputText(value, options.escape);
      continue;
    }
    if (node.type === "if") {
      let chosen = node.otherwise;
      for (const branch of node.branches) {
        if (holds(branch.condition, scope, branch.line)) {
          chosen = branch.body;
          break;
        }
      }
      output += renderNodes(chosen, scope, options, depth);
      continue;
    }
    if (node.type === "for") {
      const value = evaluate(node.iterable, scope, node.line);
      const items = toIterable(value, node.line);
      if (items.length === 0) {
        output += renderNodes(node.otherwise, scope, options, depth);
        continue;
      }
      for (let index = 0; index < items.length; index += 1) {
        const inner = new Scope(scope, {
          [node.itemName]: items[index],
          loop: loopContext(index, items.length),
        });
        output += renderNodes(node.body, inner, options, depth);
      }
      continue;
    }
    if (node.type === "include") {
      if (depth >= options.maxIncludeDepth) {
        throw new TemplateError(
          `include が深すぎます（上限 ${options.maxIncludeDepth}）`,
          node.line,
        );
      }
      const body = options.templates.require(node.name, node.line);
      const parsed = parseTemplate(tokenize(body));
      output += renderNodes(parsed, scope, options, depth + 1);
      continue;
    }
    throw new TemplateError("知らないノードです", undefined);
  }
  return output;
}

/**
 * テンプレートを描く。
 *
 * @param {string} template
 * @param {Record<string, unknown>} [data]
 * @param {{
 *   templates?: Record<string, string>|Map<string, string>,
 *   escape?: boolean,
 *   maxIncludeDepth?: number,
 * }} [options]
 * @returns {string}
 */
export function render(template, data = {}, options = {}) {
  if (typeof template !== "string") {
    throw new TypeError("テンプレートは文字列です");
  }
  const maxIncludeDepth = options.maxIncludeDepth ?? 10;
  if (!Number.isInteger(maxIncludeDepth) || maxIncludeDepth < 0) {
    throw new RangeError("maxIncludeDepth は0以上の整数です");
  }
  const settings = {
    templates: createStore(options.templates),
    escape: options.escape !== false,
    maxIncludeDepth,
  };
  const values =
    data !== null && typeof data === "object"
      ? data
      : { value: data };
  const scope = new Scope(null, values);
  const nodes = parseTemplate(tokenize(template));
  return renderNodes(nodes, scope, settings, 0);
}
