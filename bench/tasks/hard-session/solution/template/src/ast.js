/**
 * テンプレートの木。
 *
 * ノードはすべて普通のオブジェクトで、`type` で見分ける。
 * 式のノードも同じ形だが、テンプレートのノードとは別の場所で使う。
 */

/**
 * ただの文字。
 *
 * @param {string} value
 * @returns {{type: "text", value: string}}
 */
export function textNode(value) {
  return { type: "text", value };
}

/**
 * 値を出力する。
 *
 * @param {object} expression
 * @param {number} line
 * @returns {{type: "output", expression: object, line: number}}
 */
export function outputNode(expression, line) {
  return { type: "output", expression, line };
}

/**
 * if / elif / else。
 *
 * @param {Array<{condition: object, body: object[], line: number}>} branches
 * @param {object[]} otherwise
 * @param {number} line
 * @returns {{type: "if", branches: object[], otherwise: object[], line: number}}
 */
export function ifNode(branches, otherwise, line) {
  return { type: "if", branches, otherwise, line };
}

/**
 * for。空のときの else も持てる。
 *
 * @param {string} itemName
 * @param {object} iterable
 * @param {object[]} body
 * @param {object[]} otherwise
 * @param {number} line
 * @returns {{
 *   type: "for",
 *   itemName: string,
 *   iterable: object,
 *   body: object[],
 *   otherwise: object[],
 *   line: number,
 * }}
 */
export function forNode(itemName, iterable, body, otherwise, line) {
  return {
    type: "for",
    itemName,
    iterable,
    body,
    otherwise,
    line,
  };
}

/**
 * include。
 *
 * @param {string} name
 * @param {number} line
 * @returns {{type: "include", name: string, line: number}}
 */
export function includeNode(name, line) {
  return { type: "include", name, line };
}

/**
 * 文字や数の値。
 *
 * @param {unknown} value
 * @returns {{type: "literal", value: unknown}}
 */
export function literal(value) {
  return { type: "literal", value };
}

/**
 * 名前（`a.b.c` は ["a", "b", "c"]）。
 *
 * @param {string[]} path
 * @returns {{type: "identifier", path: string[]}}
 */
export function identifier(path) {
  return { type: "identifier", path };
}

/**
 * `not` などの単項。
 *
 * @param {"not"} operator
 * @param {object} operand
 * @returns {{type: "unary", operator: string, operand: object}}
 */
export function unary(operator, operand) {
  return { type: "unary", operator, operand };
}

/**
 * 比較や and / or。
 *
 * @param {string} operator
 * @param {object} left
 * @param {object} right
 * @returns {{type: "binary", operator: string, left: object, right: object}}
 */
export function binary(operator, left, right) {
  return { type: "binary", operator, left, right };
}

/**
 * フィルター。
 *
 * @param {string} name
 * @param {unknown[]} args
 * @param {object} input
 * @param {number} line
 * @returns {{type: "filter", name: string, args: unknown[], input: object, line: number}}
 */
export function filterNode(name, args, input, line) {
  return { type: "filter", name, args, input, line };
}

/**
 * 木を歩いて、ノードの種類を集める。確認用。
 *
 * @param {object|object[]} node
 * @returns {string[]}
 */
export function nodeTypes(node) {
  if (Array.isArray(node)) {
    return node.flatMap((child) => nodeTypes(child));
  }
  const types = [node.type];
  if (node.type === "if") {
    for (const branch of node.branches) {
      types.push(...nodeTypes(branch.body));
    }
    types.push(...nodeTypes(node.otherwise));
  } else if (node.type === "for") {
    types.push(...nodeTypes(node.body));
    types.push(...nodeTypes(node.otherwise));
  }
  return types;
}
