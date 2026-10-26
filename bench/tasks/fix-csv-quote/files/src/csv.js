import { DIALECTS, getDialect, readOptionsOf, writeOptionsOf } from "./dialects.js";
import { escapeField, stringifyCsv, stringifyRecords } from "./writer.js";

export { escapeField, stringifyCsv, stringifyRecords };

export const DEFAULT_DELIMITER = ",";
export const DEFAULT_QUOTE = '"';

/**
 * 改行コードを LF にそろえ、先頭の BOM を落とす。
 * @param {string} text
 * @returns {string}
 */
export function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
}

/**
 * 先頭の数行から区切り文字を推測する。引用符の中は数えない。
 * @param {string} text
 * @param {string[]} [candidates]
 * @returns {string}
 */
export function detectDelimiter(text, candidates = [",", ";", "\t", "|"]) {
  const sample = normalizeNewlines(text).split("\n").slice(0, 20).join("\n");
  let best = DEFAULT_DELIMITER;
  let bestCount = -1;
  for (const candidate of candidates) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < sample.length; index += 1) {
      const char = sample[index];
      if (char === DEFAULT_QUOTE) {
        quoted = !quoted;
      } else if (!quoted && char === candidate) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * CSV を読み込んで行の配列を返す。
 *
 * - 引用符で囲まれた値の中の区切り文字と改行は、そのまま値の一部になる。
 * - 値の中の引用符は 2 つ続けて書く。読み込み時に 1 つに戻す。
 * - trim が true なら、引用符の外側の前後空白を落とす。
 * - skipEmptyLines が true なら、空の行を飛ばす。
 *
 * @param {string} text
 * @param {{delimiter?: string, quote?: string, trim?: boolean, skipEmptyLines?: boolean}} [options]
 * @returns {string[][]}
 */
export function parseCsv(text, options = {}) {
  const source = normalizeNewlines(text);
  const delimiter = options.delimiter ?? detectDelimiter(source);
  const quote = options.quote ?? DEFAULT_QUOTE;
  const trim = options.trim ?? false;
  const skipEmptyLines = options.skipEmptyLines ?? false;

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let rowStarted = false;
  let index = 0;

  const pushField = () => {
    row.push(trim && !inQuotes ? field.trim() : field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    const empty = row.length === 1 && row[0] === "";
    if (!(skipEmptyLines && empty)) {
      rows.push(row);
    }
    row = [];
    rowStarted = false;
  };

  while (index < source.length) {
    const char = source[index];

    if (inQuotes) {
      if (char === quote) {
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === quote && field.length === 0) {
      inQuotes = true;
      rowStarted = true;
      index += 1;
      continue;
    }

    if (char === delimiter) {
      pushField();
      rowStarted = true;
      index += 1;
      continue;
    }

    if (char === "\n") {
      pushRow();
      index += 1;
      continue;
    }

    field += char;
    rowStarted = true;
    index += 1;
  }

  if (rowStarted || field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

/**
 * CSV を読み込んで、ヘッダー付きのレコードにする。
 * ヘッダーの列数より多い値は切り捨て、足りない値は空文字で埋める。
 * @param {string} text
 * @param {{delimiter?: string, quote?: string, trim?: boolean, skipEmptyLines?: boolean, headers?: string[]}} [options]
 * @returns {Record<string, string>[]}
 */
export function parseCsvRecords(text, options = {}) {
  const rows = parseCsv(text, { skipEmptyLines: true, ...options });
  if (rows.length === 0) {
    return [];
  }
  const headers = options.headers ?? rows[0];
  const body = options.headers ? rows : rows.slice(1);
  return body.map((row) => {
    const record = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = row[index] ?? "";
    }
    return record;
  });
}

/**
 * 方言 ID を指定して読み込む。
 * @param {string} text
 * @param {string} dialectId
 * @returns {string[][]}
 */
export function parseWithDialect(text, dialectId) {
  return parseCsv(text, readOptionsOf(dialectId));
}

/**
 * 方言 ID を指定して書き出す。
 * @param {string[][]} rows
 * @param {string} dialectId
 * @returns {string}
 */
export function stringifyWithDialect(rows, dialectId) {
  return stringifyCsv(rows, writeOptionsOf(dialectId));
}

/**
 * 読み込んだ行のうち、指定した列だけを取り出す。
 * @param {string[][]} rows
 * @param {number[]} indexes
 * @returns {string[][]}
 */
export function pickColumns(rows, indexes) {
  return rows.map((row) => indexes.map((index) => row[index] ?? ""));
}

/**
 * 指定した列を除いた行を返す。
 * @param {string[][]} rows
 * @param {number[]} indexes
 * @returns {string[][]}
 */
export function dropColumns(rows, indexes) {
  const drop = new Set(indexes);
  return rows.map((row) => row.filter((_, index) => !drop.has(index)));
}

/**
 * 行を列に、列を行に変換する。短い行は空文字で埋める。
 * @param {string[][]} rows
 * @returns {string[][]}
 */
export function transpose(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const result = [];
  for (let column = 0; column < width; column += 1) {
    result.push(rows.map((row) => row[column] ?? ""));
  }
  return result;
}

/**
 * 行数を返す。空行は数えない。
 * @param {string[][]} rows
 * @returns {number}
 */
export function countRows(rows) {
  return rows.filter((row) => row.some((value) => value !== "")).length;
}

/**
 * 行の最大列数を返す。
 * @param {string[][]} rows
 * @returns {number}
 */
export function columnCount(rows) {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

/**
 * すべての行が同じ列数かを返す。
 * @param {string[][]} rows
 * @returns {boolean}
 */
export function isRectangular(rows) {
  if (rows.length === 0) {
    return true;
  }
  const width = rows[0].length;
  return rows.every((row) => row.length === width);
}

/**
 * 列名の一覧を返す。重複した名前には連番を付ける。
 * @param {string[]} headers
 * @returns {string[]}
 */
export function uniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((header, index) => {
    const base = header === "" ? `column${index + 1}` : header;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

/**
 * ヘッダー行を除いた行を返す。
 * @param {string[][]} rows
 * @returns {string[][]}
 */
export function withoutHeader(rows) {
  return rows.slice(1);
}

/**
 * 指定した列の値だけを返す。
 * @param {string[][]} rows
 * @param {number} index
 * @param {{skipHeader?: boolean}} [options]
 * @returns {string[]}
 */
export function columnValues(rows, index, options = {}) {
  const body = options.skipHeader ? rows.slice(1) : rows;
  return body.map((row) => row[index] ?? "");
}

/**
 * 空の行を除いた配列を返す。
 * @param {string[][]} rows
 * @returns {string[][]}
 */
export function removeEmptyRows(rows) {
  return rows.filter((row) => row.some((value) => value !== ""));
}

/**
 * 行の値をまとめて trim する。
 * @param {string[][]} rows
 * @returns {string[][]}
 */
export function trimRows(rows) {
  return rows.map((row) => row.map((value) => String(value).trim()));
}

/**
 * 2 つの行の配列が同じ内容かを返す。
 * @param {string[][]} left
 * @param {string[][]} right
 * @returns {boolean}
 */
export function sameRows(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((row, index) => {
    const other = right[index];
    return row.length === other.length && row.every((value, column) => value === other[column]);
  });
}

/**
 * 行の配列を、先頭行をキーにしたオブジェクトの配列にする。
 * @param {string[][]} rows
 * @returns {Record<string, string>[]}
 */
export function rowsToRecords(rows) {
  if (rows.length === 0) {
    return [];
  }
  const headers = uniqueHeaders(rows[0]);
  return rows.slice(1).map((row) => {
    const record = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]] = row[index] ?? "";
    }
    return record;
  });
}

/**
 * レコードの配列を、ヘッダー付きの行の配列にする。
 * @param {Record<string, string>[]} records
 * @param {string[]} [headers]
 * @returns {string[][]}
 */
export function recordsToRows(records, headers) {
  const columns = headers ?? [...new Set(records.flatMap((record) => Object.keys(record)))];
  return [columns, ...records.map((record) => columns.map((column) => record[column] ?? ""))];
}

/**
 * CSV の文字列から、指定した列名の値だけを取り出す。
 * @param {string} text
 * @param {string} name
 * @returns {string[]}
 */
export function valuesOfColumn(text, name) {
  const records = parseCsvRecords(text);
  return records.map((record) => record[name] ?? "");
}

/**
 * 方言 ID の一覧を返す。
 * @returns {string[]}
 */
export function dialectIds() {
  return Object.keys(DIALECTS).sort();
}

/**
 * 方言 ID から定義を返す。
 * @param {string} id
 * @returns {object}
 */
export function dialectOf(id) {
  return getDialect(id);
}
