export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * うるう年かを返す。100 で割り切れる年は 400 で割り切れるときだけうるう年。
 * @param {number} year
 * @returns {boolean}
 */
export function isLeapYear(year) {
  const value = Number(year);
  return value % 4 === 0 && (value % 100 !== 0 || value % 400 === 0);
}

/**
 * 月の日数を返す。month は 0 始まり。
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export function daysInMonth(year, month) {
  const value = Number(month);
  if (!Number.isInteger(value) || value < 0 || value > 11) {
    throw new RangeError("month must be between 0 and 11");
  }
  if (value === 1) {
    return isLeapYear(year) ? 29 : 28;
  }
  return 31 - ((value % 7) % 2);
}

/**
 * 年月日から UTC の Date を作る。存在しない日付は null。
 * @param {number} year
 * @param {number} month 0 始まり
 * @param {number} day
 * @returns {Date|null}
 */
export function makeDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return null;
  }
  if (m < 0 || m > 11) {
    return null;
  }
  if (d < 1 || d > daysInMonth(y, m)) {
    return null;
  }
  return new Date(Date.UTC(y, m, d));
}

/**
 * 日付として読める値を Date にする。
 *
 * - Date はそのまま複製する。
 * - `YYYY-MM-DD` / `YYYY/MM/DD` / `YYYY.MM.DD` は UTC の 0 時として読む。
 * - ISO 8601 の日時はその時刻を保つ。
 * - 読めない値は null。
 *
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (text === "") {
    return null;
  }

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    return makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const date = makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date === null) {
      return null;
    }
    date.setUTCHours(Number(match[4]), Number(match[5]), Number(match[6] ?? 0), 0);
    return date;
  }

  match = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (match) {
    return makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    if (first > 12) {
      return makeDate(year, second - 1, first);
    }
    return makeDate(year, first - 1, second);
  }

  return null;
}

/**
 * 日付の時刻を無視して、UTC の 0 時のタイムスタンプにする。
 * @param {unknown} value
 * @returns {number|null}
 */
export function toDateOnly(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * 日付を `YYYY-MM-DD` にする。読めなければ空文字。
 * @param {unknown} value
 * @returns {string}
 */
export function toISO(value) {
  const date = parseDate(value);
  if (date === null) {
    return "";
  }
  return formatDate(date, "YYYY-MM-DD");
}

/**
 * 日付を書式に従って整形する。
 * @param {unknown} value
 * @param {string} [format]
 * @returns {string}
 */
export function formatDate(value, format = "YYYY-MM-DD") {
  const date = parseDate(value);
  if (date === null) {
    return "";
  }
  const tokens = {
    YYYY: String(date.getUTCFullYear()).padStart(4, "0"),
    MM: String(date.getUTCMonth() + 1).padStart(2, "0"),
    M: String(date.getUTCMonth() + 1),
    DD: String(date.getUTCDate()).padStart(2, "0"),
    D: String(date.getUTCDate()),
    HH: String(date.getUTCHours()).padStart(2, "0"),
    mm: String(date.getUTCMinutes()).padStart(2, "0"),
    ss: String(date.getUTCSeconds()).padStart(2, "0"),
  };
  return String(format).replace(/YYYY|MM|M|DD|D|HH|mm|ss/g, (token) => tokens[token]);
}

/**
 * 日付の年・月・日を取り出す。
 * @param {unknown} value
 * @returns {{year: number, month: number, day: number}|null}
 */
export function dateParts(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

/**
 * 日付を複製する。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function cloneDate(value) {
  const date = parseDate(value);
  return date === null ? null : new Date(date.getTime());
}

/**
 * 2 つの日付が同じ日かを返す。時刻は無視する。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function isSameDay(left, right) {
  const a = toDateOnly(left);
  const b = toDateOnly(right);
  return a !== null && a === b;
}

/**
 * 日付を月曜始まりの曜日番号（0〜6）にする。
 * @param {unknown} value
 * @returns {number|null}
 */
export function mondayIndex(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  return (date.getUTCDay() + 6) % 7;
}

/**
 * 日付が有効かを返す。
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidDate(value) {
  return parseDate(value) !== null;
}

/**
 * 日付を文字列から作り直す。無効なら null。
 * @param {string} text
 * @returns {Date|null}
 */
export function fromISO(text) {
  return parseDate(text);
}

/**
 * 日付の時刻を 0 時にする。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function atMidnight(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
