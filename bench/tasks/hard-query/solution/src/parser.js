import {
  call,
  column,
  comparison,
  literal,
  logical,
  negative,
  not,
  orderItem,
  selectItem,
  statement,
  star,
} from "./ast.js";
import { QueryError } from "./errors.js";
import { tokenize, TOKEN } from "./tokenizer.js";
import { COMPARISON_OPERATORS } from "./types.js";

const KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "BY",
  "HAVING",
  "ORDER",
  "LIMIT",
  "OFFSET",
  "ASC",
  "DESC",
  "AND",
  "OR",
  "NOT",
  "AS",
  "NULL",
  "TRUE",
  "FALSE",
]);

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  peek(offset = 0) {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  next() {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  atEnd() {
    return this.peek().type === TOKEN.eof;
  }

  isKeyword(token, word) {
    return (
      token.type === TOKEN.identifier &&
      token.value.toUpperCase() === word
    );
  }

  matchKeyword(word) {
    if (this.isKeyword(this.peek(), word)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  expectKeyword(word) {
    if (!this.matchKeyword(word)) {
      const token = this.peek();
      throw new QueryError(`${word} が必要です`, token.pos);
    }
  }

  isPunctuation(token, value) {
    return token.type === TOKEN.punctuation && token.value === value;
  }

  matchPunctuation(value) {
    if (this.isPunctuation(this.peek(), value)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  expectPunctuation(value) {
    if (!this.matchPunctuation(value)) {
      const token = this.peek();
      throw new QueryError(`${value} が必要です`, token.pos);
    }
  }

  expectIdentifier(label = "名前") {
    const token = this.peek();
    if (token.type !== TOKEN.identifier) {
      throw new QueryError(`${label} が必要です`, token.pos);
    }
    this.index += 1;
    return token;
  }

  parseStatement() {
    this.expectKeyword("SELECT");
    const select = this.parseSelectList();
    this.expectKeyword("FROM");
    const table = this.expectIdentifier("テーブル名").value;

    let where = null;
    if (this.matchKeyword("WHERE")) {
      where = this.parseExpression();
    }

    let groupBy = [];
    if (this.matchKeyword("GROUP")) {
      this.expectKeyword("BY");
      groupBy = this.parseExpressionList();
      for (const expression of groupBy) {
        if (expression.type !== "column") {
          throw new QueryError(
            "GROUP BY には列名だけを使えます",
            this.peek().pos,
          );
        }
      }
    }

    let having = null;
    if (this.matchKeyword("HAVING")) {
      having = this.parseExpression();
    }

    const orderBy = [];
    if (this.matchKeyword("ORDER")) {
      this.expectKeyword("BY");
      orderBy.push(...this.parseOrderList());
    }

    let limit = null;
    let offset = null;
    let scanning = true;
    while (scanning) {
      if (this.matchKeyword("LIMIT")) {
        if (limit !== null) {
          throw new QueryError("LIMIT が重複しています", this.peek().pos);
        }
        limit = this.parseCount("LIMIT");
        continue;
      }
      if (this.matchKeyword("OFFSET")) {
        if (offset !== null) {
          throw new QueryError("OFFSET が重複しています", this.peek().pos);
        }
        offset = this.parseCount("OFFSET");
        continue;
      }
      scanning = false;
    }

    this.matchPunctuation(";");
    if (!this.atEnd()) {
      const token = this.peek();
      throw new QueryError(
        `SQL の終わりに余分なものがあります: ${token.text}`,
        token.pos,
      );
    }

    return statement({
      select,
      table,
      where,
      groupBy,
      having,
      orderBy,
      limit,
      offset,
    });
  }

  parseSelectList() {
    const items = [];
    if (this.matchPunctuation("*")) {
      items.push(selectItem(star()));
      return items;
    }
    while (true) {
      const expression = this.parseExpression();
      let alias;
      if (this.matchKeyword("AS")) {
        alias = this.expectIdentifier("別名").value;
      }
      items.push(selectItem(expression, alias));
      if (!this.matchPunctuation(",")) {
        break;
      }
    }
    return items;
  }

  parseExpressionList() {
    const expressions = [this.parseExpression()];
    while (this.matchPunctuation(",")) {
      expressions.push(this.parseExpression());
    }
    return expressions;
  }

  parseOrderList() {
    const items = [];
    while (true) {
      const expression = this.parseExpression();
      let direction = "ASC";
      if (this.matchKeyword("ASC")) {
        direction = "ASC";
      } else if (this.matchKeyword("DESC")) {
        direction = "DESC";
      }
      items.push(orderItem(expression, direction));
      if (!this.matchPunctuation(",")) {
        break;
      }
    }
    return items;
  }

  parseCount(label) {
    const token = this.peek();
    if (token.type !== TOKEN.number) {
      throw new QueryError(`${label} には整数を指定してください`, token.pos);
    }
    this.index += 1;
    if (!Number.isInteger(token.value) || token.value < 0) {
      throw new QueryError(
        `${label} には0以上の整数を指定してください`,
        token.pos,
      );
    }
    return token.value;
  }

  parseExpression() {
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.matchKeyword("OR")) {
      const right = this.parseAnd();
      left = logical(left, "OR", right);
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.matchKeyword("AND")) {
      const right = this.parseNot();
      left = logical(left, "AND", right);
    }
    return left;
  }

  parseNot() {
    if (this.matchKeyword("NOT")) {
      return not(this.parseNot());
    }
    return this.parseComparison();
  }

  parseComparison() {
    const left = this.parseUnary();
    const token = this.peek();
    if (
      token.type === TOKEN.operator &&
      COMPARISON_OPERATORS.has(token.value)
    ) {
      this.index += 1;
      const right = this.parseUnary();
      return comparison(left, token.value, right);
    }
    return left;
  }

  parseUnary() {
    const token = this.peek();
    if (token.type === TOKEN.operator && token.value === "-") {
      this.index += 1;
      return negative(this.parseUnary());
    }
    if (token.type === TOKEN.operator && token.value === "+") {
      this.index += 1;
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.peek();
    if (token.type === TOKEN.number || token.type === TOKEN.string) {
      this.index += 1;
      return literal(token.value);
    }
    if (this.matchPunctuation("(")) {
      const expression = this.parseExpression();
      this.expectPunctuation(")");
      return expression;
    }
    if (token.type !== TOKEN.identifier) {
      throw new QueryError(
        `式を読めません: ${token.text === "" ? "末尾" : token.text}`,
        token.pos,
      );
    }

    const upper = token.value.toUpperCase();
    if (upper === "NULL") {
      this.index += 1;
      return literal(null);
    }
    if (upper === "TRUE") {
      this.index += 1;
      return literal(true);
    }
    if (upper === "FALSE") {
      this.index += 1;
      return literal(false);
    }
    if (KEYWORDS.has(upper)) {
      throw new QueryError(`ここでは ${upper} を使えません`, token.pos);
    }

    this.index += 1;
    if (this.matchPunctuation("(")) {
      return this.parseCall(token.value);
    }
    if (this.matchPunctuation(".")) {
      const name = this.expectIdentifier("列名").value;
      return column(name, token.value);
    }
    return column(token.value);
  }

  parseCall(name) {
    if (this.matchPunctuation("*")) {
      this.expectPunctuation(")");
      return call(name, [star()]);
    }
    if (this.matchPunctuation(")")) {
      return call(name, []);
    }
    const args = this.parseExpressionList();
    this.expectPunctuation(")");
    return call(name, args);
  }
}

export function parse(sql) {
  return new Parser(tokenize(sql)).parseStatement();
}
