import { QueryError } from "./errors.js";

export const TOKEN = {
  identifier: "identifier",
  number: "number",
  string: "string",
  operator: "operator",
  punctuation: "punctuation",
  eof: "eof",
};

const PUNCTUATION = new Set([",", "(", ")", ".", ";", "*"]);
const OPERATOR_START = new Set(["=", "!", "<", ">", "+", "-"]);

function isDigit(char) {
  return char >= "0" && char <= "9";
}

function isIdentifierStart(char) {
  return (
    (char >= "a" && char <= "z") ||
    (char >= "A" && char <= "Z") ||
    char === "_"
  );
}

function isIdentifierPart(char) {
  return isIdentifierStart(char) || isDigit(char);
}

function readString(sql, start) {
  let index = start + 1;
  let value = "";
  while (index < sql.length) {
    const char = sql[index];
    if (char === "'") {
      if (sql[index + 1] === "'") {
        value += "'";
        index += 2;
        continue;
      }
      index += 1;
      return {
        token: {
          type: TOKEN.string,
          value,
          text: sql.slice(start, index),
          pos: start,
        },
        next: index,
      };
    }
    value += char;
    index += 1;
  }
  throw new QueryError("文字列が閉じていません", start);
}

function readNumber(sql, start) {
  let index = start;
  let dots = 0;
  while (index < sql.length) {
    const char = sql[index];
    if (isDigit(char)) {
      index += 1;
      continue;
    }
    if (char === "." && dots === 0) {
      dots += 1;
      index += 1;
      continue;
    }
    break;
  }
  const text = sql.slice(start, index);
  if (text === "." || text.endsWith(".")) {
    throw new QueryError("数値の書き方が正しくありません", start);
  }
  return {
    token: {
      type: TOKEN.number,
      value: Number(text),
      text,
      pos: start,
    },
    next: index,
  };
}

function readIdentifier(sql, start) {
  let index = start + 1;
  while (index < sql.length && isIdentifierPart(sql[index])) {
    index += 1;
  }
  return {
    token: {
      type: TOKEN.identifier,
      value: sql.slice(start, index),
      text: sql.slice(start, index),
      pos: start,
    },
    next: index,
  };
}

function readOperator(sql, start) {
  const two = sql.slice(start, start + 2);
  if (two === "<=" || two === ">=" || two === "<>" || two === "!=") {
    return {
      token: {
        type: TOKEN.operator,
        value: two,
        text: two,
        pos: start,
      },
      next: start + 2,
    };
  }
  const one = sql[start];
  if (one === "!" || one === "=" || one === "<" || one === ">" ||
      one === "+" || one === "-") {
    return {
      token: {
        type: TOKEN.operator,
        value: one,
        text: one,
        pos: start,
      },
      next: start + 1,
    };
  }
  throw new QueryError(`使えない記号です: ${one}`, start);
}

export function tokenize(sql) {
  if (typeof sql !== "string") {
    throw new QueryError("SQL は文字列で指定してください");
  }
  const tokens = [];
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    if (char === undefined) {
      break;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "'") {
      const result = readString(sql, index);
      tokens.push(result.token);
      index = result.next;
      continue;
    }
    if (isDigit(char)) {
      const result = readNumber(sql, index);
      tokens.push(result.token);
      index = result.next;
      continue;
    }
    if (isIdentifierStart(char)) {
      const result = readIdentifier(sql, index);
      tokens.push(result.token);
      index = result.next;
      continue;
    }
    if (OPERATOR_START.has(char)) {
      const result = readOperator(sql, index);
      tokens.push(result.token);
      index = result.next;
      continue;
    }
    if (PUNCTUATION.has(char)) {
      tokens.push({
        type: TOKEN.punctuation,
        value: char,
        text: char,
        pos: index,
      });
      index += 1;
      continue;
    }
    throw new QueryError(`使えない文字です: ${char}`, index);
  }
  tokens.push({
    type: TOKEN.eof,
    value: "",
    text: "",
    pos: sql.length,
  });
  return tokens;
}
