export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

export function isDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function toDate(value) {
  if (isDate(value)) return new Date(value.getTime());
  if (typeof value === "number") {
    const date = new Date(value);
    if (!isDate(date)) throw new RangeError("invalid timestamp");
    return date;
  }
  if (typeof value === "string") {
    const parsed = parseDate(value);
    if (!parsed) throw new RangeError(`invalid date: ${value}`);
    return parsed;
  }
  throw new TypeError("unsupported date value");
}

export function normalizeDate(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfDay(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month];
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

export function addDays(value, amount) {
  const date = toDate(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function addMonths(value, amount) {
  const date = toDate(value);
  const targetMonth = date.getMonth() + amount;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(date.getDate(), daysInMonth(year, month));
  return new Date(
    year,
    month,
    day,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

export function addYears(value, amount) {
  return addMonths(value, amount * 12);
}

export function startOfWeek(value) {
  const date = startOfDay(value);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

export function endOfWeek(value) {
  const start = startOfWeek(value);
  return endOfDay(addDays(start, 6));
}

export function startOfMonth(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), daysInMonth(date.getFullYear(), date.getMonth()), 23, 59, 59, 999);
}

export function startOfYear(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), 0, 1);
}

export function endOfYear(value) {
  const date = toDate(value);
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function isSameDay(left, right) {
  const a = toDate(left);
  const b = toDate(right);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(left, right) {
  const a = toDate(left);
  const b = toDate(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isWeekend(value) {
  const day = toDate(value).getDay();
  return day === 0 || day === 6;
}

export function compareDates(left, right) {
  return toDate(left).getTime() - toDate(right).getTime();
}

export function minDate(...values) {
  return values.reduce((min, value) => (compareDates(value, min) < 0 ? value : min));
}

export function maxDate(...values) {
  return values.reduce((max, value) => (compareDates(value, max) > 0 ? value : max));
}

export function diffDays(start, end) {
  const a = startOfDay(start);
  const b = startOfDay(end);
  const aUTC = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUTC = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const days = Math.round((bUTC - aUTC) / MS_PER_DAY);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return days;
  }
  return days - 1;
}

export function diffMonths(start, end) {
  const a = toDate(start);
  const b = toDate(end);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function diffYears(start, end) {
  const a = toDate(start);
  const b = toDate(end);
  let years = b.getFullYear() - a.getFullYear();
  const anniversary = new Date(a.getFullYear() + years, a.getMonth(), a.getDate());
  if (compareDates(anniversary, b) > 0) years -= 1;
  return years;
}

export function eachDay(start, end) {
  const first = startOfDay(start);
  const last = startOfDay(end);
  const days = [];
  if (first.getTime() > last.getTime()) return days;
  let cursor = first;
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function dateRange(start, end) {
  return eachDay(start, end);
}

export function eachMonth(start, end) {
  const first = startOfMonth(start);
  const last = startOfMonth(end);
  const months = [];
  let cursor = first;
  while (cursor.getTime() <= last.getTime()) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

export function businessDays(start, end) {
  return eachDay(start, end).filter((date) => !isWeekend(date));
}

export function isBetween(value, start, end, inclusive = true) {
  const target = toDate(value).getTime();
  const from = toDate(start).getTime();
  const to = toDate(end).getTime();
  if (inclusive) return target >= from && target <= to;
  return target > from && target < to;
}

export function clampDate(value, min, max) {
  const date = toDate(value);
  if (compareDates(date, min) < 0) return toDate(min);
  if (compareDates(date, max) > 0) return toDate(max);
  return date;
}

export function formatDate(value, pattern = "YYYY-MM-DD") {
  const date = toDate(value);
  const tokens = {
    YYYY: String(date.getFullYear()).padStart(4, "0"),
    YY: String(date.getFullYear()).slice(-2),
    MM: pad(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: pad(date.getDate()),
    D: String(date.getDate()),
    HH: pad(date.getHours()),
    H: String(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    ddd: JP_WEEKDAYS[date.getDay()],
    dddd: WEEKDAY_NAMES[date.getDay()],
    MMM: MONTH_NAMES[date.getMonth()].slice(0, 3),
    MMMM: MONTH_NAMES[date.getMonth()],
  };
  return pattern.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D|HH|H|mm|ss|dddd|ddd/g, (token) => tokens[token]);
}

export function formatJapanese(value, options = {}) {
  const date = toDate(value);
  const weekday = options.weekday ?? true;
  const base = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  return weekday ? `${base}(${JP_WEEKDAYS[date.getDay()]})` : base;
}

export function parseDate(value) {
  if (isDate(value)) return new Date(value.getTime());
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text === "") return null;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return buildLocalDate(match[1], match[2], match[3]);
  match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) return buildLocalDate(match[1], match[2], match[3]);
  match = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (match) return buildLocalDate(match[1], match[2], match[3]);
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    return buildLocalDate(match[1], match[2], match[3], match[4], match[5], match[6]);
  }
  const fallback = new Date(text);
  return isDate(fallback) ? fallback : null;
}

function buildLocalDate(year, month, day, hour = 0, minute = 0, second = 0) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m - 1)) return null;
  return new Date(y, m - 1, d, Number(hour), Number(minute), Number(second));
}

export function toISO(value) {
  return formatDate(value, "YYYY-MM-DD");
}

export function toTimestamp(value) {
  return toDate(value).getTime();
}

export function fromTimestamp(value) {
  return new Date(value);
}

export function quarter(value) {
  return Math.floor(toDate(value).getMonth() / 3) + 1;
}

export function season(value) {
  const month = toDate(value).getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

export function weekNumber(value) {
  const date = startOfDay(value);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = target.getDay() || 7;
  target.setDate(target.getDate() + 4 - day);
  const yearStart = new Date(target.getFullYear(), 0, 1);
  return Math.ceil(((target - yearStart) / MS_PER_DAY + 1) / 7);
}

export function isoWeekYear(value) {
  const date = startOfDay(value);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = target.getDay() || 7;
  target.setDate(target.getDate() + 4 - day);
  return target.getFullYear();
}

export function firstWeekday(year, month) {
  return new Date(year, month, 1).getDay();
}

export function calendarMatrix(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const total = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function durationParts(start, end) {
  const a = toDate(start);
  const b = toDate(end);
  if (a.getTime() > b.getTime()) return durationParts(b, a);
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();
  if (days < 0) {
    months -= 1;
    const previousMonth = new Date(b.getFullYear(), b.getMonth(), 0);
    days += previousMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

export function age(birthday, today = new Date()) {
  const parts = durationParts(birthday, today);
  return parts.years;
}

export function isPast(value, now = new Date()) {
  return compareDates(value, now) < 0;
}

export function isFuture(value, now = new Date()) {
  return compareDates(value, now) > 0;
}

export function nextWeekday(value, weekday) {
  const date = startOfDay(value);
  const delta = (weekday - date.getDay() + 7) % 7 || 7;
  return addDays(date, delta);
}

export function previousWeekday(value, weekday) {
  const date = startOfDay(value);
  const delta = (date.getDay() - weekday + 7) % 7 || 7;
  return addDays(date, -delta);
}

export function monthName(value, style = "long") {
  const month = toDate(value).getMonth();
  return style === "short" ? MONTH_NAMES[month].slice(0, 3) : MONTH_NAMES[month];
}

export function weekdayName(value, style = "long") {
  const day = toDate(value).getDay();
  return style === "short" ? WEEKDAY_NAMES[day].slice(0, 3) : WEEKDAY_NAMES[day];
}

export function sameWeek(left, right) {
  return startOfWeek(left).getTime() === startOfWeek(right).getTime();
}

export function moveToMonth(value, month) {
  const date = toDate(value);
  const day = Math.min(date.getDate(), daysInMonth(date.getFullYear(), month));
  return new Date(date.getFullYear(), month, day);
}

export function daysRemainingInMonth(value) {
  const date = toDate(value);
  return daysInMonth(date.getFullYear(), date.getMonth()) - date.getDate();
}

export function daysUntil(start, end) {
  return diffDays(start, end);
}
