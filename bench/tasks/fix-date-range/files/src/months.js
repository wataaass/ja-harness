import { daysInMonth, makeDate, parseDate } from "./dates.js";

/**
 * 日付を月の単位で加算する。
 *
 * 加算後の月に同じ日があればその日を保つ。なければ、その月の
 * 末日に丸める（例: 1 月 31 日の 1 か月後は 2 月の末日）。
 *
 * @param {unknown} value
 * @param {number} count
 * @returns {Date|null}
 */
export function addMonths(value, count) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + Number(count);
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), 30);
  return makeDate(year, month, Math.min(day, daysInMonth(year, month)));
}

/**
 * 日付を年の単位で加算する。2 月 29 日は翌年の 2 月 28 日になる。
 * @param {unknown} value
 * @param {number} count
 * @returns {Date|null}
 */
export function addYears(value, count) {
  return addMonths(value, Number(count) * 12);
}

/**
 * 月の初日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function startOfMonth(value) {
  const date = parseDate(value);
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
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return makeDate(year, month, daysInMonth(year, month));
}

/**
 * 翌月の初日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function nextMonth(value) {
  const start = startOfMonth(value);
  return start === null ? null : addMonths(start, 1);
}

/**
 * 前月の初日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function previousMonth(value) {
  const start = startOfMonth(value);
  return start === null ? null : addMonths(start, -1);
}

/**
 * 4 半期の初日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function startOfQuarter(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  const month = Math.floor(date.getUTCMonth() / 3) * 3;
  return makeDate(date.getUTCFullYear(), month, 1);
}

/**
 * 4 半期の末日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function endOfQuarter(value) {
  const start = startOfQuarter(value);
  if (start === null) {
    return null;
  }
  return endOfMonth(addMonths(start, 2));
}

/**
 * 年の初日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function startOfYear(value) {
  const date = parseDate(value);
  return date === null ? null : makeDate(date.getUTCFullYear(), 0, 1);
}

/**
 * 年の末日を返す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function endOfYear(value) {
  const date = parseDate(value);
  return date === null ? null : makeDate(date.getUTCFullYear(), 11, 31);
}

/**
 * 2 つの日付の間の月数を返す。端数は切り捨てる。
 * @param {unknown} start
 * @param {unknown} end
 * @returns {number|null}
 */
export function monthsBetween(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (from === null || to === null) {
    return null;
  }
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

/**
 * 月の番号（0〜11）を返す。
 * @param {unknown} value
 * @returns {number|null}
 */
export function monthOf(value) {
  const date = parseDate(value);
  return date === null ? null : date.getUTCMonth();
}

/**
 * 年を返す。
 * @param {unknown} value
 * @returns {number|null}
 */
export function yearOf(value) {
  const date = parseDate(value);
  return date === null ? null : date.getUTCFullYear();
}

/**
 * 月の日数を返す。
 * @param {unknown} value
 * @returns {number|null}
 */
export function daysOfMonth(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  return daysInMonth(date.getUTCFullYear(), date.getUTCMonth());
}

/**
 * その日が月末かを返す。
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEndOfMonth(value) {
  const date = parseDate(value);
  if (date === null) {
    return false;
  }
  return date.getUTCDate() === daysInMonth(date.getUTCFullYear(), date.getUTCMonth());
}

/**
 * その日が月初かを返す。
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStartOfMonth(value) {
  const date = parseDate(value);
  return date !== null && date.getUTCDate() === 1;
}

/**
 * 月の一覧を、月の初日で返す。
 * @param {unknown} start
 * @param {number} count
 * @returns {Date[]}
 */
export function monthsFrom(start, count) {
  const date = startOfMonth(start);
  if (date === null) {
    return [];
  }
  return Array.from({ length: Math.max(0, Number(count)) }, (_, index) => addMonths(date, index));
}

/**
 * 月をまたいだ日数を返す。月末から翌月 1 日は 1。
 * @param {unknown} start
 * @param {unknown} end
 * @returns {number|null}
 */
export function daysAcrossMonths(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (from === null || to === null) {
    return null;
  }
  const startDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const endDay = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((endDay - startDay) / 86400000);
}
