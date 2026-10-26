import { DAY_MS, daysInMonth, makeDate, parseDate, toDateOnly } from "./dates.js";

/**
 * ISO 8601 の週番号を返す。
 *
 * 月曜日を週の始まりとし、木曜日を含む週をその年の第 1 週とする。
 * 年をまたぐ週は、木曜日が属する年の週番号になる。
 *
 * @param {unknown} value
 * @returns {number|null}
 */
export function weekNumber(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

/**
 * ISO 週番号が属する年を返す。1 月 1 日でも前年の第 52 週になることがある。
 * @param {unknown} value
 * @returns {number|null}
 */
export function weekYear(value) {
  const date = parseDate(value);
  if (date === null) {
    return null;
  }
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  return target.getUTCFullYear();
}

/**
 * 週の初日を返す。firstDay は 0（日曜）〜6（土曜）。
 * @param {unknown} value
 * @param {number} [firstDay]
 * @returns {Date|null}
 */
export function startOfWeek(value, firstDay = 1) {
  const date = parseDate(value);
  const first = Number(firstDay);
  if (date === null || !Number.isInteger(first) || first < 0 || first > 6) {
    return null;
  }
  const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const offset = (date.getUTCDay() - first + 7) % 7;
  return new Date(base - offset * DAY_MS);
}

/**
 * 週の末日を返す。
 * @param {unknown} value
 * @param {number} [firstDay]
 * @returns {Date|null}
 */
export function endOfWeek(value, firstDay = 1) {
  const start = startOfWeek(value, firstDay);
  return start === null ? null : new Date(start.getTime() + 6 * DAY_MS);
}

/**
 * 日付が週の何日目か（0〜6）を返す。
 * @param {unknown} value
 * @param {number} [firstDay]
 * @returns {number|null}
 */
export function dayOfWeek(value, firstDay = 1) {
  const date = parseDate(value);
  const first = Number(firstDay);
  if (date === null || !Number.isInteger(first) || first < 0 || first > 6) {
    return null;
  }
  return (date.getUTCDay() - first + 7) % 7;
}

/**
 * カレンダーの行列を返す。日曜始まりで、前後の月の日付も入る。
 * @param {number} year
 * @param {number} month 0 始まり
 * @returns {Date[][]}
 */
export function calendarMatrix(year, month) {
  const first = makeDate(year, month, 1);
  if (first === null) {
    return [];
  }
  const start = startOfWeek(first, 0);
  const last = makeDate(year, month, daysInMonth(year, month));
  const end = endOfWeek(last, 0);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const cells = Array.from({ length: days }, (_, index) => new Date(start.getTime() + index * DAY_MS));
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

/**
 * その年が 53 週あるかを返す。
 * @param {number} year
 * @returns {boolean}
 */
export function has53Weeks(year) {
  const jan1 = makeDate(year, 0, 1);
  const dec31 = makeDate(year, 11, 31);
  return weekNumber(jan1) === 53 || weekNumber(dec31) === 53;
}

/**
 * その年の週数を返す。
 * @param {number} year
 * @returns {number}
 */
export function weeksInYear(year) {
  return has53Weeks(year) ? 53 : 52;
}

/**
 * 週番号から、その週の月曜日を返す。
 * @param {number} year
 * @param {number} week
 * @returns {Date|null}
 */
export function dateOfWeek(year, week) {
  const jan4 = makeDate(year, 0, 4);
  if (jan4 === null) {
    return null;
  }
  const week1 = startOfWeek(jan4, 1);
  return new Date(week1.getTime() + (Number(week) - 1) * 7 * DAY_MS);
}

/**
 * 日付の曜日番号を返す。0 が日曜日。
 * @param {unknown} value
 * @returns {number|null}
 */
export function weekdayIndex(value) {
  const date = parseDate(value);
  return date === null ? null : date.getUTCDay();
}

/**
 * 週の範囲を返す。
 * @param {unknown} value
 * @param {number} [firstDay]
 * @returns {{start: Date, end: Date}|null}
 */
export function weekRange(value, firstDay = 1) {
  const start = startOfWeek(value, firstDay);
  const end = endOfWeek(value, firstDay);
  return start === null || end === null ? null : { start, end };
}

/**
 * 2 つの日付が同じ ISO 週かを返す。
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function isSameWeek(left, right) {
  const a = parseDate(left);
  const b = parseDate(right);
  if (a === null || b === null) {
    return false;
  }
  return weekNumber(a) === weekNumber(b) && weekYear(a) === weekYear(b);
}

/**
 * 日付の週の初日を ISO の文字列で返す。
 * @param {unknown} value
 * @param {number} [firstDay]
 * @returns {string}
 */
export function weekStartISO(value, firstDay = 1) {
  const start = startOfWeek(value, firstDay);
  if (start === null) {
    return "";
  }
  const year = start.getUTCFullYear();
  const month = String(start.getUTCMonth() + 1).padStart(2, "0");
  const day = String(start.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 日付の週の末日を ISO の文字列で返す。
 * @param {unknown} value
 * @param {number} [firstDay]
 * @returns {string}
 */
export function weekEndISO(value, firstDay = 1) {
  const end = endOfWeek(value, firstDay);
  if (end === null) {
    return "";
  }
  const year = end.getUTCFullYear();
  const month = String(end.getUTCMonth() + 1).padStart(2, "0");
  const day = String(end.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 日付の属する月の週数を返す。
 * @param {unknown} value
 * @returns {number}
 */
export function weeksInMonth(value) {
  const date = parseDate(value);
  if (date === null) {
    return 0;
  }
  return calendarMatrix(date.getUTCFullYear(), date.getUTCMonth()).length;
}

/**
 * 日付を ISO 週の表記（YYYY-Www）にする。
 * @param {unknown} value
 * @returns {string}
 */
export function toISOWeek(value) {
  const week = weekNumber(value);
  const year = weekYear(value);
  if (week === null || year === null) {
    return "";
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * 日付の時刻を落とした ISO 文字列を返す。
 * @param {unknown} value
 * @returns {string}
 */
export function toISODay(value) {
  const stamp = toDateOnly(value);
  if (stamp === null) {
    return "";
  }
  const date = new Date(stamp);
  return date.toISOString().slice(0, 10);
}
