const MONTHS = {
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

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const APACHE_PATTERN =
  /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2})(\d{2})$/;

/**
 * Apache 形式の時刻を Date にする。
 *
 * `10/Oct/2024:13:55:36 +0900` のように、末尾に UTC からの時差が付く。
 * `+0900` は UTC より 9 時間進んだ時刻なので、UTC に直すときは
 * 9 時間引く。読めない値は null。
 *
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseTimestamp(value) {
  const match = String(value ?? "").trim().match(APACHE_PATTERN);
  if (!match) {
    return null;
  }
  const [, day, monthName, year, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const month = MONTHS[monthName];
  if (month === undefined) {
    return null;
  }
  const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === "-" ? -1 : 1);
  const utc = Date.UTC(
    Number(year),
    month,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const date = new Date(utc - offset * 60 * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ISO 8601 / RFC 3339 の時刻を Date にする。
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseISOTimestamp(value) {
  const text = String(value ?? "").trim();
  if (text === "") {
    return null;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * タイムスタンプを ISO の文字列にする。
 * @param {unknown} value
 * @returns {string}
 */
export function formatTimestamp(value) {
  const date = value instanceof Date ? value : parseTimestamp(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

/**
 * タイムスタンプの時差を分で返す。分からないときは null。
 * @param {unknown} value
 * @returns {number|null}
 */
export function offsetMinutes(value) {
  const match = String(value ?? "").trim().match(/[+-](\d{2})(\d{2})$/);
  if (!match) {
    return null;
  }
  const text = String(value);
  const sign = text.slice(-5, -4) === "-" ? -1 : 1;
  return (Number(match[1]) * 60 + Number(match[2])) * sign;
}

/**
 * タイムスタンプをミリ秒にする。
 * @param {unknown} value
 * @returns {number|null}
 */
export function epochMillis(value) {
  const date = value instanceof Date ? value : parseTimestamp(value);
  return date === null || Number.isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * タイムスタンプを、時差を考えた現地の年月日にする。
 * 例: `2024-10-10T00:30:00+09:00` は `2024-10-10`。
 * @param {unknown} value
 * @returns {{year: number, month: number, day: number, hour: number, minute: number}|null}
 */
export function localParts(value) {
  const text = String(value ?? "");
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (match) {
    const offset = parseOffsetText(match[7]);
    const utc = Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0),
    );
    const local = new Date(utc + offset * 60 * 1000);
    return {
      year: local.getUTCFullYear(),
      month: local.getUTCMonth() + 1,
      day: local.getUTCDate(),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
    };
  }

  const apache = text.match(
    /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2})(\d{2})$/,
  );
  if (apache) {
    const month = MONTHS[apache[2]];
    if (month === undefined) {
      return null;
    }
    return {
      year: Number(apache[3]),
      month: month + 1,
      day: Number(apache[1]),
      hour: Number(apache[4]),
      minute: Number(apache[5]),
    };
  }

  const date = value instanceof Date ? value : new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function parseOffsetText(text) {
  if (!text || text === "Z") {
    return 0;
  }
  const match = text.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    return 0;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return (Number(match[2]) * 60 + Number(match[3])) * sign;
}

/**
 * タイムスタンプを `YYYY-MM-DD` の現地日付にする。
 * @param {unknown} value
 * @returns {string}
 */
export function localDateKey(value) {
  const parts = localParts(value);
  if (parts === null) {
    return "";
  }
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Apache 形式の時刻を組み立てる。
 * @param {{year: number, month: number, day: number, hour?: number, minute?: number, second?: number, offsetMinutes?: number}} parts
 * @returns {string}
 */
export function formatApacheTimestamp(parts) {
  const month = MONTH_NAMES[parts.month - 1] ?? "Jan";
  const day = String(parts.day).padStart(2, "0");
  const hour = String(parts.hour ?? 0).padStart(2, "0");
  const minute = String(parts.minute ?? 0).padStart(2, "0");
  const second = String(parts.second ?? 0).padStart(2, "0");
  const offset = Number(parts.offsetMinutes ?? 0);
  const sign = offset < 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  const offsetHour = String(Math.floor(absolute / 60)).padStart(2, "0");
  const offsetMinute = String(absolute % 60).padStart(2, "0");
  return `${day}/${month}/${parts.year}:${hour}:${minute}:${second} ${sign}${offsetHour}${offsetMinute}`;
}
