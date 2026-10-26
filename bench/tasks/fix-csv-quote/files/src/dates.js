const MONTH_INDEX = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

/**
 * うるう年かを返す。西暦 100 年ごとの例外も扱う。
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

function makeDate(year, month, day) {
  if (!Number.isInteger(month) || month < 0 || month > 11) {
    return null;
  }
  const last = daysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > last) {
    return null;
  }
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 日付の文字列を読み取る。読めない値は null。
 *
 * 受け付ける形:
 * - `2024-02-29` / `2024/02/29` / `2024.02.29`
 * - `02/29/2024`（月が 12 以下で日が 12 より大きいとき）
 * - `29/02/2024`（日が 12 より大きいとき）
 * - `2024年2月29日`
 * - ISO 8601 の日時
 *
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseDateValue(value) {
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

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (match) {
    return makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  match = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (match) {
    return makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    if (first > 12) {
      return makeDate(year, second - 1, first);
    }
    return makeDate(year, first - 1, second);
  }

  match = text.match(/^(\d{1,2})[-\s](\w{3})[-\s](\d{4})$/);
  if (match) {
    const month = MONTH_INDEX[match[2]];
    if (month === undefined) {
      return null;
    }
    return makeDate(Number(match[3]), month, Number(match[1]));
  }

  return null;
}

/**
 * 日付を書式に従って整形する。date が読めなければ空文字。
 * @param {unknown} value
 * @param {string} [format]
 * @returns {string}
 */
export function formatDate(value, format = "YYYY-MM-DD") {
  const date = parseDateValue(value);
  if (date === null) {
    return "";
  }
  const tokens = {
    YYYY: String(date.getUTCFullYear()).padStart(4, "0"),
    MM: String(date.getUTCMonth() + 1).padStart(2, "0"),
    DD: String(date.getUTCDate()).padStart(2, "0"),
    HH: String(date.getUTCHours()).padStart(2, "0"),
    mm: String(date.getUTCMinutes()).padStart(2, "0"),
    ss: String(date.getUTCSeconds()).padStart(2, "0"),
  };
  return String(format).replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => tokens[token]);
}

/**
 * 日付を ISO の日付部分にする。
 * @param {unknown} value
 * @returns {string}
 */
export function toISODate(value) {
  return formatDate(value, "YYYY-MM-DD");
}

/**
 * 日付に日数を足す。
 * @param {unknown} value
 * @param {number} days
 * @returns {Date|null}
 */
export function addDays(value, days) {
  const date = parseDateValue(value);
  if (date === null) {
    return null;
  }
  return new Date(date.getTime() + Number(days) * 86400000);
}

/**
 * 2 つの日付の差を日数で返す。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {number|null}
 */
export function diffDays(left, right) {
  const a = parseDateValue(left);
  const b = parseDateValue(right);
  if (a === null || b === null) {
    return null;
  }
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * 日付の比較。left が前なら負、同じなら 0、後なら正。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {number}
 */
export function compareDates(left, right) {
  return (diffDays(left, right) ?? 0) * -1;
}

/**
 * 日付の範囲を、両端を含む日付の配列にする。
 * @param {unknown} start
 * @param {unknown} end
 * @returns {Date[]}
 */
export function dateRange(start, end) {
  const from = parseDateValue(start);
  const to = parseDateValue(end);
  if (from === null || to === null || from.getTime() > to.getTime()) {
    return [];
  }
  const days = diffDays(from, to) ?? 0;
  return Array.from({ length: days + 1 }, (_, index) => addDays(from, index));
}

/**
 * 日付が今日より前かを返す。
 * @param {unknown} value
 * @param {Date} [today]
 * @returns {boolean}
 */
export function isPast(value, today = new Date()) {
  return (diffDays(value, today) ?? 0) > 0;
}

/**
 * 日付が今日より後かを返す。
 * @param {unknown} value
 * @param {Date} [today]
 * @returns {boolean}
 */
export function isFuture(value, today = new Date()) {
  return (diffDays(today, value) ?? 0) > 0;
}

/**
 * 日付の曜日を返す。0 が日曜日。
 * @param {unknown} value
 * @returns {number|null}
 */
export function weekday(value) {
  const date = parseDateValue(value);
  return date === null ? null : date.getUTCDay();
}

/**
 * 日付の曜日名を返す。
 * @param {unknown} value
 * @returns {string}
 */
export function weekdayName(value) {
  const names = ["日", "月", "火", "水", "木", "金", "土"];
  const index = weekday(value);
  return index === null ? "" : names[index];
}

/**
 * 月の初日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function startOfMonth(value) {
  const date = parseDateValue(value);
  if (date === null) {
    return null;
  }
  return makeDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/**
 * 月の末日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function endOfMonth(value) {
  const date = parseDateValue(value);
  if (date === null) {
    return null;
  }
  const month = date.getUTCMonth();
  return makeDate(date.getUTCFullYear(), month, daysInMonth(date.getUTCFullYear(), month));
}

/**
 * 日付を月の単位で加算する。月末はその月の末日に丸める。
 * @param {unknown} value
 * @param {number} months
 * @returns {Date|null}
 */
export function addMonths(value, months) {
  const date = parseDateValue(value);
  if (date === null) {
    return null;
  }
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + Number(months);
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, month));
  return makeDate(year, month, day);
}

/**
 * 年の初日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function startOfYear(value) {
  const date = parseDateValue(value);
  return date === null ? null : makeDate(date.getUTCFullYear(), 0, 1);
}

/**
 * 4 半期の開始月を返す。
 * @param {unknown} value
 * @returns {number|null}
 */
export function quarter(value) {
  const date = parseDateValue(value);
  return date === null ? null : Math.floor(date.getUTCMonth() / 3) + 1;
}

/**
 * 日付を `YYYY-MM-DD` の文字列で比較する。
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
export function sameDate(left, right) {
  return toISODate(left) !== "" && toISODate(left) === toISODate(right);
}
