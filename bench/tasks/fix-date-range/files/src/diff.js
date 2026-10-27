import { DAY_MS, makeDate, parseDate, toDateOnly } from "./dates.js";

/**
 * 2 つの日付の差を日数で返す。
 *
 * 時刻は無視して、日付だけを比べる。end が start より後なら正、
 * 前なら負、同じ日なら 0。読めない値は null。
 *
 * @param {unknown} start
 * @param {unknown} end
 * @returns {number|null}
 */
export function diffDays(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (from === null || to === null) {
    return null;
  }
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * 両端を含む日数。同じ日なら 1。
 * @param {unknown} start
 * @param {unknown} end
 * @returns {number|null}
 */
export function diffDaysInclusive(start, end) {
  const days = diffDays(start, end);
  return days === null ? null : Math.abs(days) + 1;
}

/**
 * 2 つの日付の間の日付を、両端を含めて並べる。
 * @param {unknown} start
 * @param {unknown} end
 * @returns {Date[]}
 */
export function eachDay(start, end) {
  const from = toDateOnly(start);
  const to = toDateOnly(end);
  if (from === null || to === null) {
    return [];
  }
  const step = from <= to ? 1 : -1;
  const days = Math.abs(Math.round((to - from) / DAY_MS));
  const result = [];
  for (let index = 0; index <= days; index += 1) {
    result.push(new Date(from + step * index * DAY_MS));
  }
  return result;
}

/**
 * 2 つの日付を比べる。left が前なら負、同じなら 0、後なら正。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {number}
 */
export function compareDates(left, right) {
  const a = toDateOnly(left);
  const b = toDateOnly(right);
  if (a === null || b === null) {
    return 0;
  }
  return Math.sign(a - b);
}

/**
 * 左が右より前かを返す。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function isBefore(left, right) {
  return compareDates(left, right) < 0;
}

/**
 * 左が右より後かを返す。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function isAfter(left, right) {
  return compareDates(left, right) > 0;
}

/**
 * 日付が週末（土日）かを返す。
 * @param {unknown} value
 * @returns {boolean}
 */
export function isWeekendDate(value) {
  const date = parseDate(value);
  if (date === null) {
    return false;
  }
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * 週末を除いた営業日の一覧を返す。祝日は考えない。
 * @param {unknown} start
 * @param {unknown} end
 * @returns {Date[]}
 */
export function businessDays(start, end) {
  return eachDay(start, end).filter((date) => !isWeekendDate(date));
}

/**
 * 次の営業日を返す。当日が営業日でも、次の日から探す。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function nextBusinessDay(value) {
  const days = eachDay(value, addCalendarDays(value, 10));
  for (const date of days.slice(1)) {
    if (!isWeekendDate(date)) {
      return date;
    }
  }
  return null;
}

/**
 * 営業日を指定した日数だけ進める。
 * @param {unknown} value
 * @param {number} count
 * @returns {Date|null}
 */
export function addBusinessDays(value, count) {
  let current = parseDate(value);
  if (current === null) {
    return null;
  }
  let remaining = Math.abs(Number(count));
  const step = Number(count) < 0 ? -1 : 1;
  while (remaining > 0) {
    current = addCalendarDays(current, step);
    if (!isWeekendDate(current)) {
      remaining -= 1;
    }
  }
  return current;
}

function addCalendarDays(value, days) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  return new Date(date.getTime() + Number(days) * DAY_MS);
}

/**
 * 2 つの日付のうち早い方を返す。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {Date|null}
 */
export function minDate(left, right) {
  return compareDates(left, right) <= 0 ? parseDate(left) : parseDate(right);
}

/**
 * 2 つの日付のうち遅い方を返す。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {Date|null}
 */
export function maxDate(left, right) {
  return compareDates(left, right) >= 0 ? parseDate(left) : parseDate(right);
}

/**
 * 2 つの期間が重なるかを返す。両端は含む。
 * @param {{start: unknown, end: unknown}} left
 * @param {{start: unknown, end: unknown}} right
 * @returns {boolean}
 */
export function overlaps(left, right) {
  return compareDates(left.start, right.end) <= 0 && compareDates(right.start, left.end) <= 0;
}

/**
 * その年の日数を返す。
 * @param {number} year
 * @returns {number}
 */
export function daysInYear(year) {
  return isLeapYearNumber(year) ? 366 : 365;
}

function isLeapYearNumber(year) {
  const value = Number(year);
  return value % 4 === 0 && (value % 100 !== 0 || value % 400 === 0);
}

/**
 * 1 月 1 日から数えた日番号を返す。1 月 1 日は 1。
 * @param {unknown} value
 * @returns {number|null}
 */
export function dayOfYear(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = toDateOnly(date);
  return Math.round((current - start) / DAY_MS) + 1;
}

/**
 * 経過した日数を返す。未来の日付なら負になる。
 * @param {unknown} from
 * @param {unknown} to
 * @returns {number|null}
 */
export function elapsedDays(from, to) {
  return diffDays(from, to);
}

/**
 * 日付を指定した範囲に収める。
 * @param {unknown} value
 * @param {unknown} lower
 * @param {unknown} upper
 * @returns {Date|null}
 */
export function clampDate(value, lower, upper) {
  if (compareDates(value, lower) < 0) {
    return parseDate(lower);
  }
  if (compareDates(value, upper) > 0) {
    return parseDate(upper);
  }
  return parseDate(value);
}

/**
 * 日付の一覧を昇順に並べる。
 * @param {unknown[]} values
 * @returns {Date[]}
 */
export function sortDates(values) {
  return values
    .map((value) => parseDate(value))
    .filter((value) => value !== null)
    .sort((left, right) => left.getTime() - right.getTime());
}

/**
 * 日付の一覧から重複した日を除く。
 * @param {unknown[]} values
 * @returns {Date[]}
 */
export function uniqueDates(values) {
  const seen = new Set();
  const result = [];
  for (const date of sortDates(values)) {
    const key = toDateOnly(date);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(date);
    }
  }
  return result;
}

/**
 * 月の初日と末日を返す。
 * @param {unknown} value
 * @returns {{start: Date|null, end: Date|null}}
 */
export function monthBounds(value) {
  const date = parseDate(value);
  if (date === null) {
    return { start: null, end: null };
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const last = 31 - ((month % 7) % 2) === 31 ? 31 : 30;
  const endDay = month === 1 ? (isLeapYearNumber(year) ? 29 : 28) : last;
  return {
    start: makeDate(year, month, 1),
    end: makeDate(year, month, endDay),
  };
}
