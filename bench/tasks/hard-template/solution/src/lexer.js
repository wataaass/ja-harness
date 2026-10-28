/**
 * テンプレートを、文字・変数・タグに分ける。
 *
 * 行番号は、そのかたまりが始まる行。`{%-` や `-%}` の空白の調整も
 * ここで行う。
 */

import { TemplateError } from "./errors.js";

/**
 * 文字列の中の改行を数える。
 *
 * @param {string} text
 * @returns {number}
 */
export function countNewlines(text) {
  let count = 0;
  for (const char of text) {
    if (char === "\n") {
      count += 1;
    }
  }
  return count;
}

/**
 * 閉じる印を探す。引用符の中の印は無視する。
 *
 * @param {string} source
 * @param {number} start
 * @param {string} close
 * @returns {number} 見つからなければ -1
 */
function findClose(source, start, close) {
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (source.startsWith(close, index)) {
      return index;
    }
  }
  return -1;
}

/**
 * 次のタグの位置を返す。なければ -1。
 *
 * @param {string} source
 * @param {number} start
 * @returns {number}
 */
function nextTag(source, start) {
  const variable = source.indexOf("{{", start);
  const statement = source.indexOf("{%", start);
  if (variable === -1) {
    return statement;
  }
  if (statement === -1) {
    return variable;
  }
  return Math.min(variable, statement);
}

/**
 * 空白の調整を行う。
 *
 * @param {Array<object>} tokens
 * @returns {Array<object>}
 */
export function applyWhitespaceControl(tokens) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "text") {
      continue;
    }
    if (token.trimLeft) {
      const previous = tokens[index - 1];
      if (previous !== undefined && previous.type === "text") {
        previous.value = previous.value.replace(/\s+$/, "");
      }
    }
    if (token.trimRight) {
      const next = tokens[index + 1];
      if (next !== undefined && next.type === "text") {
        next.value = next.value.replace(/^\s+/, "");
      }
    }
  }
  return tokens;
}

/**
 * テンプレートを分ける。
 *
 * @param {string} template
 * @returns {Array<{
 *   type: "text"|"variable"|"tag",
 *   value: string,
 *   line: number,
 *   trimLeft: boolean,
 *   trimRight: boolean,
 * }>}
 */
export function tokenize(template) {
  const source = String(template);
  const tokens = [];
  let index = 0;
  let line = 1;

  while (index < source.length) {
    const opensVariable = source.startsWith("{{", index);
    const opensTag = source.startsWith("{%", index);

    if (opensVariable || opensTag) {
      const startLine = line;
      const close = opensVariable ? "}}" : "%}";
      let cursor = index + 2;
      let trimLeft = false;
      if (source[cursor] === "-") {
        trimLeft = true;
        cursor += 1;
      }
      const closeAt = findClose(source, cursor, close);
      if (closeAt === -1) {
        throw new TemplateError(`タグを閉じる ${close} がありません`, startLine);
      }
      let contentEnd = closeAt;
      let trimRight = false;
      if (contentEnd > cursor && source[contentEnd - 1] === "-") {
        trimRight = true;
        contentEnd -= 1;
      }
      const consumed = source.slice(index, closeAt + 2);
      tokens.push({
        type: opensVariable ? "variable" : "tag",
        value: source.slice(cursor, contentEnd),
        line: startLine,
        trimLeft,
        trimRight,
      });
      line += countNewlines(consumed);
      index = closeAt + 2;
      continue;
    }

    const startLine = line;
    const end = nextTag(source, index);
    if (end === -1) {
      const rest = source.slice(index);
      tokens.push({
        type: "text",
        value: rest,
        line: startLine,
        trimLeft: false,
        trimRight: false,
      });
      break;
    }
    const text = source.slice(index, end);
    if (text !== "") {
      tokens.push({
        type: "text",
        value: text,
        line: startLine,
        trimLeft: false,
        trimRight: false,
      });
    }
    line += countNewlines(text);
    index = end;
  }

  return applyWhitespaceControl(tokens);
}

/**
 * タグの中の最初の単語を返す。
 *
 * @param {string} content
 * @returns {string}
 */
export function tagName(content) {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(content);
  return match === null ? "" : match[1];
}

/**
 * タグの中の、最初の単語より後ろを返す。
 *
 * @param {string} content
 * @returns {string}
 */
export function tagRest(content) {
  const match = /^\s*[A-Za-z_][A-Za-z0-9_]*([\s\S]*)$/.exec(content);
  return match === null ? "" : match[1];
}
