export const DEFAULT_DELIMITER = ",";
export const DEFAULT_QUOTE = '"';

/**
 * 1 つの値を CSV のフィールドにする。
 *
 * 次のどれかに当てはまるときは引用符で囲む。
 * - 区切り文字を含む
 * - 引用符を含む
 * - 改行を含む
 * - 先頭または末尾に空白がある（読み込み時の trim で消えないようにするため）
 *
 * 引用符そのものは 2 つ続けて書く。
 *
 * @param {unknown} value
 * @param {string} [delimiter]
 * @param {string} [quote]
 * @returns {string}
 */
export function escapeField(value, delimiter = DEFAULT_DELIMITER, quote = DEFAULT_QUOTE) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  const needsQuote =
    text.includes(delimiter) ||
    text.includes(quote) ||
    text.includes("\n") ||
    text.includes("\r") ||
    /^\s/.test(text);
  if (!needsQuote) {
    return text;
  }
  return quote + text.split(quote).join(quote + quote) + quote;
}

/**
 * 行の配列を CSV の文字列にする。
 * @param {unknown[][]} rows
 * @param {{delimiter?: string, quote?: string, newline?: string, trailingNewline?: boolean}} [options]
 * @returns {string}
 */
export function stringifyCsv(rows, options = {}) {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER;
  const quote = options.quote ?? DEFAULT_QUOTE;
  const newline = options.newline ?? "\n";
  const trailingNewline = options.trailingNewline ?? true;
  const lines = rows.map((row) =>
    row.map((value) => escapeField(value, delimiter, quote)).join(delimiter),
  );
  const body = lines.join(newline);
  return trailingNewline && body.length > 0 ? body + newline : body;
}

/**
 * ヘッダー付きレコードを CSV の文字列にする。
 * @param {Record<string, unknown>[]} records
 * @param {string[]} [headers]
 * @param {{delimiter?: string, quote?: string, newline?: string, trailingNewline?: boolean}} [options]
 * @returns {string}
 */
export function stringifyRecords(records, headers, options = {}) {
  const columns =
    headers ?? [...new Set(records.flatMap((record) => Object.keys(record)))];
  const rows = [
    columns,
    ...records.map((record) => columns.map((column) => record[column] ?? "")),
  ];
  return stringifyCsv(rows, options);
}

/**
 * 1 行だけを CSV の文字列にする。末尾の改行は付けない。
 * @param {unknown[]} row
 * @param {{delimiter?: string, quote?: string}} [options]
 * @returns {string}
 */
export function stringifyRow(row, options = {}) {
  return row
    .map((value) =>
      escapeField(value, options.delimiter ?? DEFAULT_DELIMITER, options.quote ?? DEFAULT_QUOTE),
    )
    .join(options.delimiter ?? DEFAULT_DELIMITER);
}

/**
 * 値を引用符で囲んだ形にする。値をそのまま確認したいとき用。
 * @param {unknown} value
 * @param {string} [quote]
 * @returns {string}
 */
export function quoted(value, quote = DEFAULT_QUOTE) {
  return quote + String(value).split(quote).join(quote + quote) + quote;
}

/**
 * 値に引用符が必要かを返す。
 * @param {unknown} value
 * @param {string} [delimiter]
 * @param {string} [quote]
 * @returns {boolean}
 */
export function needsQuotes(value, delimiter = DEFAULT_DELIMITER, quote = DEFAULT_QUOTE) {
  if (value === null || value === undefined) {
    return false;
  }
  const text = String(value);
  return (
    text.includes(delimiter) ||
    text.includes(quote) ||
    text.includes("\n") ||
    text.includes("\r") ||
    /^\s/.test(text)
  );
}

/**
 * 行の配列を、列ごとの文字列にまとめる。
 * @param {unknown[][]} rows
 * @param {number} index
 * @returns {string[]}
 */
export function columnOf(rows, index) {
  return rows.map((row) => String(row[index] ?? ""));
}

/**
 * 列の幅をそろえるため、足りない値を空文字で埋める。
 * @param {unknown[][]} rows
 * @param {number} width
 * @returns {string[][]}
 */
export function padRows(rows, width) {
  return rows.map((row) => {
    const copy = row.map((value) => String(value ?? ""));
    while (copy.length < width) {
      copy.push("");
    }
    return copy.slice(0, width);
  });
}

/**
 * 行の最大列数に合わせて、すべての行を同じ長さにする。
 * @param {unknown[][]} rows
 * @returns {string[][]}
 */
export function padToLongest(rows) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return padRows(rows, width);
}

/**
 * 行の配列を、指定した改行コードで連結する。
 * @param {unknown[][]} rows
 * @param {string} newline
 * @returns {string}
 */
export function joinRows(rows, newline) {
  return rows.map((row) => stringifyRow(row)).join(newline);
}

/**
 * CSV の文字列に、末尾の改行を付ける。
 * @param {string} text
 * @param {string} [newline]
 * @returns {string}
 */
export function withTrailingNewline(text, newline = "\n") {
  return text.endsWith(newline) ? text : `${text}${newline}`;
}

/**
 * CSV の文字列から、末尾の改行を落とす。
 * @param {string} text
 * @returns {string}
 */
export function withoutTrailingNewline(text) {
  return String(text).replace(/\r?\n$/, "");
}

/**
 * 値を文字列に変換する。null と undefined は空文字。
 * @param {unknown} value
 * @returns {string}
 */
export function toFieldText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}
