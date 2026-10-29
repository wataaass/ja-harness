/**
 * 分けたかたまりを、テンプレートの木にする。
 *
 * 式は、値・名前・比較・and / or / not・フィルターだけを扱う。
 * 計算のための四則演算はない。
 */

import {
  binary,
  filterNode,
  forNode,
  identifier,
  ifNode,
  includeNode,
  literal,
  outputNode,
  textNode,
  unary,
} from "./ast.js";
import { TemplateError } from "./errors.js";
import { tagName, tagRest } from "./lexer.js";

/**
 * 式の中の文字を分ける。
 *
 * @param {string} source
 * @param {number} line
 * @returns {Array<{type: string, value: unknown}>}
 */
export function tokenizeExpression(source, line) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      let value = "";
      let cursor = index + 1;
      let closed = false;
      while (cursor < source.length) {
        const current = source[cursor];
        if (current === "\\") {
          const next = source[cursor + 1];
          if (next === "n") {
            value += "\n";
          } else if (next === "t") {
            value += "\t";
          } else {
            value += next ?? "";
          }
          cursor += 2;
          continue;
        }
        if (current === quote) {
          closed = true;
          cursor += 1;
          break;
        }
        value += current;
        cursor += 1;
      }
      if (!closed) {
        throw new TemplateError("文字列を閉じる引用符がありません", line);
      }
      tokens.push({ type: "string", value });
      index = cursor;
      continue;
    }
    const number = /^-?\d+(?:\.\d+)?/.exec(source.slice(index));
    if (number !== null) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*/.exec(
      source.slice(index),
    );
    if (name !== null) {
      tokens.push({ type: "name", value: name[0] });
      index += name[0].length;
      continue;
    }
    const pair = source.slice(index, index + 2);
    if (pair === "==" || pair === "!=" || pair === "<=" || pair === ">=") {
      tokens.push({ type: "op", value: pair });
      index += 2;
      continue;
    }
    if ("|,()<>".includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }
    throw new TemplateError(`式に使えない文字です: ${char}`, line);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

const COMPARISONS = new Set(["==", "!=", "<", ">", "<=", ">="]);

class ExpressionParser {
  /**
   * @param {string} source
   * @param {number} line
   */
  constructor(source, line) {
    this.tokens = tokenizeExpression(source, line);
    this.position = 0;
    this.line = line;
  }

  peek() {
    return this.tokens[this.position] ?? { type: "eof", value: "" };
  }

  take() {
    const token = this.peek();
    this.position += 1;
    return token;
  }

  isOp(value) {
    const token = this.peek();
    return token.type === "op" && token.value === value;
  }

  isWord(value) {
    const token = this.peek();
    return token.type === "name" && token.value === value;
  }

  expectOp(value) {
    if (!this.isOp(value)) {
      throw new TemplateError(`${value} がありません`, this.line);
    }
    return this.take();
  }

  expectEnd() {
    if (this.peek().type !== "eof") {
      throw new TemplateError("式の後ろに余分なものがあります", this.line);
    }
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.isWord("or")) {
      this.take();
      left = binary("or", left, this.parseAnd());
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.isWord("and")) {
      this.take();
      left = binary("and", left, this.parseNot());
    }
    return left;
  }

  parseNot() {
    if (this.isWord("not")) {
      this.take();
      return unary("not", this.parseNot());
    }
    return this.parseComparison();
  }

  parseComparison() {
    const left = this.parsePrimary();
    const token = this.peek();
    if (token.type === "op" && COMPARISONS.has(token.value)) {
      this.take();
      return binary(String(token.value), left, this.parsePrimary());
    }
    return left;
  }

  parsePrimary() {
    const token = this.take();
    if (token.type === "number" || token.type === "string") {
      return literal(token.value);
    }
    if (token.type === "name") {
      if (token.value === "true") {
        return literal(true);
      }
      if (token.value === "false") {
        return literal(false);
      }
      if (token.value === "null" || token.value === "undefined") {
        return literal(null);
      }
      return identifier(String(token.value).split("."));
    }
    if (token.type === "op" && token.value === "(") {
      const inner = this.parseOr();
      this.expectOp(")");
      return inner;
    }
    throw new TemplateError("式に値がありません", this.line);
  }

  parseArgument() {
    const token = this.take();
    if (token.type === "number" || token.type === "string") {
      return token.value;
    }
    if (token.type === "name") {
      if (token.value === "true") {
        return true;
      }
      if (token.value === "false") {
        return false;
      }
      if (token.value === "null" || token.value === "undefined") {
        return null;
      }
    }
    throw new TemplateError(
      "フィルターの引数には、文字・数・true / false / null だけを使えます",
      this.line,
    );
  }

  parseFilters(input) {
    let expression = input;
    while (this.isOp("|")) {
      this.take();
      const name = this.take();
      if (name.type !== "name" || String(name.value).includes(".")) {
        throw new TemplateError("フィルターの名前がありません", this.line);
      }
      const args = [];
      if (this.isOp("(")) {
        this.take();
        if (!this.isOp(")")) {
          while (true) {
            args.push(this.parseArgument());
            if (this.isOp(",")) {
              this.take();
              continue;
            }
            break;
          }
        }
        this.expectOp(")");
      }
      expression = filterNode(String(name.value), args, expression, this.line);
    }
    return expression;
  }
}

/**
 * 式を読む。
 *
 * @param {string} source
 * @param {number} line
 * @param {{filters?: boolean}} [options]
 * @returns {object}
 */
export function parseExpression(source, line, options = {}) {
  const parser = new ExpressionParser(source, line);
  const base = parser.parseOr();
  const expression =
    options.filters === true ? parser.parseFilters(base) : base;
  parser.expectEnd();
  return expression;
}

class TemplateParser {
  /**
   * @param {Array<object>} tokens
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  peek() {
    return this.tokens[this.position];
  }

  take() {
    const token = this.peek();
    this.position += 1;
    return token;
  }

  atTag(name) {
    const token = this.peek();
    return (
      token !== undefined && token.type === "tag" && tagName(token.value) === name
    );
  }

  parseNodes(stopWords) {
    const nodes = [];
    while (this.position < this.tokens.length) {
      const token = this.peek();
      if (token.type === "tag" && stopWords.has(tagName(token.value))) {
        break;
      }
      nodes.push(this.parseOne());
    }
    return nodes;
  }

  parseOne() {
    const token = this.take();
    if (token.type === "text") {
      return textNode(token.value);
    }
    if (token.type === "variable") {
      const expression = parseExpression(token.value, token.line, {
        filters: true,
      });
      return outputNode(expression, token.line);
    }
    if (token.type !== "tag") {
      throw new TemplateError("知らないかたまりです", token.line);
    }
    const name = tagName(token.value);
    const rest = tagRest(token.value);
    if (name === "if") {
      return this.parseIf(token, rest);
    }
    if (name === "for") {
      return this.parseFor(token, rest);
    }
    if (name === "include") {
      return this.parseInclude(token, rest);
    }
    throw new TemplateError(`知らないタグです: ${name}`, token.line);
  }

  parseIf(token, rest) {
    if (rest.trim() === "") {
      throw new TemplateError("if に条件がありません", token.line);
    }
    const branches = [];
    let condition = parseExpression(rest, token.line);
    let body = this.parseNodes(new Set(["elif", "else", "endif"]));
    branches.push({ condition, body, line: token.line });

    while (this.atTag("elif")) {
      const elifToken = this.take();
      const elifRest = tagRest(elifToken.value);
      if (elifRest.trim() === "") {
        throw new TemplateError("elif に条件がありません", elifToken.line);
      }
      condition = parseExpression(elifRest, elifToken.line);
      body = this.parseNodes(new Set(["elif", "else", "endif"]));
      branches.push({ condition, body, line: elifToken.line });
    }

    let otherwise = [];
    if (this.atTag("else")) {
      this.take();
      otherwise = this.parseNodes(new Set(["endif"]));
    }
    if (!this.atTag("endif")) {
      throw new TemplateError("endif がありません", token.line);
    }
    this.take();
    return ifNode(branches, otherwise, token.line);
  }

  parseFor(token, rest) {
    const match = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s+in\s+([\s\S]+)$/.exec(
      rest,
    );
    if (match === null) {
      throw new TemplateError("for は「for 名前 in 値」の形で書きます", token.line);
    }
    const itemName = String(match[1]);
    const iterable = parseExpression(String(match[2]), token.line);
    const body = this.parseNodes(new Set(["else", "endfor"]));
    let otherwise = [];
    if (this.atTag("else")) {
      this.take();
      otherwise = this.parseNodes(new Set(["endfor"]));
    }
    if (!this.atTag("endfor")) {
      throw new TemplateError("endfor がありません", token.line);
    }
    this.take();
    return forNode(itemName, iterable, body, otherwise, token.line);
  }

  parseInclude(token, rest) {
    if (rest.trim() === "") {
      throw new TemplateError("include に名前がありません", token.line);
    }
    const expression = parseExpression(rest, token.line);
    if (expression.type !== "literal" || typeof expression.value !== "string") {
      throw new TemplateError(
        "include には文字列のテンプレート名を書きます",
        token.line,
      );
    }
    return includeNode(String(expression.value), token.line);
  }
}

/**
 * テンプレートの木を作る。
 *
 * @param {Array<object>} tokens
 * @returns {object[]}
 */
export function parseTemplate(tokens) {
  const parser = new TemplateParser(tokens);
  const nodes = parser.parseNodes(new Set());
  if (parser.position < parser.tokens.length) {
    const token = parser.peek();
    throw new TemplateError(
      `余分なタグです: ${tagName(token.value)}`,
      token.line,
    );
  }
  return nodes;
}
