import { parseLine as parseOneLine } from "./pattern.js";

export { parseLine } from "./pattern.js";
export {
  countBy,
  countByDay,
  countByHour,
  countByIp,
  countByMethod,
  countByPath,
  countByStatus,
  countByStatusClass,
  errorCount,
  errorRate,
  errorsByDay,
  filterByDay,
  filterByMethod,
  filterByPathPrefix,
  filterByStatus,
  filterByStatusClass,
  hourlyErrorRate,
  isClientError,
  isErrorStatus,
  isServerError,
  percent,
  statusClass,
  summarize,
  topCounts,
  uniqueIps,
} from "./stats.js";
export { formatTimestamp, localDateKey, parseISOTimestamp, parseTimestamp } from "./timestamp.js";

/**
 * ログの文字列を行に分ける。空行は落とす。
 * @param {string} text
 * @returns {string[]}
 */
export function splitLines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
}

/**
 * ログの文字列を読み取る。読めない行は飛ばす。
 * @param {string} text
 * @returns {object[]}
 */
export function parseLog(text) {
  return splitLines(text)
    .map((line) => parseOneLine(line))
    .filter((entry) => entry !== null);
}

/**
 * ログを読み取り、読めた件数と飛ばした件数を返す。
 * @param {string} text
 * @returns {{entries: object[], parsed: number, skipped: number}}
 */
export function parseLogSafe(text) {
  const lines = splitLines(text);
  const entries = [];
  let skipped = 0;
  for (const line of lines) {
    const entry = parseOneLine(line);
    if (entry === null) {
      skipped += 1;
    } else {
      entries.push(entry);
    }
  }
  return { entries, parsed: entries.length, skipped };
}

/**
 * ログの先頭の 1 件を返す。空なら null。
 * @param {string} text
 * @returns {object|null}
 */
export function parseFirst(text) {
  return parseLog(text)[0] ?? null;
}

/**
 * 行数を返す。空行は数えない。
 * @param {string} text
 * @returns {number}
 */
export function countLines(text) {
  return splitLines(text).length;
}

/**
 * 読めなかった行だけを返す。
 * @param {string} text
 * @returns {string[]}
 */
export function invalidLines(text) {
  return splitLines(text).filter((line) => parseOneLine(line) === null);
}

/**
 * ログの内容をテキストのまま検索する。
 * @param {string} text
 * @param {string|RegExp} query
 * @returns {string[]}
 */
export function searchLines(text, query) {
  const pattern = query instanceof RegExp ? query : new RegExp(String(query));
  return splitLines(text).filter((line) => pattern.test(line));
}

/**
 * パスが一致する行だけを返す。
 * @param {string} text
 * @param {string} path
 * @returns {object[]}
 */
export function entriesForPath(text, path) {
  return parseLog(text).filter((entry) => entry.path === path);
}

/**
 * IP が一致する行だけを返す。
 * @param {string} text
 * @param {string} ip
 * @returns {object[]}
 */
export function entriesForIp(text, ip) {
  return parseLog(text).filter((entry) => entry.ip === ip);
}

/**
 * エラーの行だけを返す。
 * @param {string} text
 * @returns {object[]}
 */
export function errorEntries(text) {
  return parseLog(text).filter((entry) => entry.status !== null && entry.status >= 400);
}

/**
 * 読めた行の合計バイト数を返す。
 * @param {string} text
 * @returns {number}
 */
export function totalBytes(text) {
  return parseLog(text).reduce((total, entry) => total + Number(entry.bytes ?? 0), 0);
}

/**
 * ステータスごとの代表的な行を返す。
 * @param {string} text
 * @returns {Record<string, object>}
 */
export function firstByStatus(text) {
  const result = {};
  for (const entry of parseLog(text)) {
    const key = String(entry.status);
    if (!Object.hasOwn(result, key)) {
      result[key] = entry;
    }
  }
  return result;
}

/**
 * ログを日付ごとにまとめる。
 * @param {string} text
 * @returns {Record<string, object[]>}
 */
export function groupByDay(text) {
  const groups = {};
  for (const entry of parseLog(text)) {
    if (!(entry.timestamp instanceof Date)) {
      continue;
    }
    const key = entry.timestamp.toISOString().slice(0, 10);
    groups[key] = groups[key] ?? [];
    groups[key].push(entry);
  }
  return groups;
}

/**
 * ログの概要を文字列にする。
 * @param {string} text
 * @returns {string}
 */
export function describeLog(text) {
  const result = parseLogSafe(text);
  const statuses = {};
  for (const entry of result.entries) {
    const key = String(entry.status);
    statuses[key] = (statuses[key] ?? 0) + 1;
  }
  return `行数 ${result.parsed}、読めない行 ${result.skipped}、ステータス ${JSON.stringify(statuses)}`;
}

/**
 * 2 つのログを結合して読み取る。
 * @param {string[]} texts
 * @returns {object[]}
 */
export function parseMany(texts) {
  return texts.flatMap((text) => parseLog(text));
}

/**
 * ステータスが 200 番台かを返す。
 * @param {object} entry
 * @returns {boolean}
 */
export function isSuccess(entry) {
  return typeof entry.status === "number" && entry.status >= 200 && entry.status < 300;
}

/**
 * ステータスが 300 番台かを返す。
 * @param {object} entry
 * @returns {boolean}
 */
export function isRedirect(entry) {
  return typeof entry.status === "number" && entry.status >= 300 && entry.status < 400;
}

/**
 * リクエストが API 向けかを返す。
 * @param {object} entry
 * @returns {boolean}
 */
export function isApiRequest(entry) {
  return String(entry.path ?? "").startsWith("/api/");
}

/**
 * ログを時刻順に並べる。
 * @param {object[]} entries
 * @returns {object[]}
 */
export function sortByTime(entries) {
  return [...entries].sort((left, right) => {
    const a = left.timestamp instanceof Date ? left.timestamp.getTime() : 0;
    const b = right.timestamp instanceof Date ? right.timestamp.getTime() : 0;
    return a - b;
  });
}

/**
 * 1 行のログを、短い説明にする。
 * @param {object} entry
 * @returns {string}
 */
export function describeEntry(entry) {
  return `${entry.ip ?? "-"} ${entry.method ?? "-"} ${entry.path ?? "-"} ${entry.status ?? "-"}`;
}
