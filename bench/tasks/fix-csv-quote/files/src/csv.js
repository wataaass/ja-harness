const DEFAULT_DELIMITER = ",";
const DEFAULT_QUOTE = '"';

export function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
}

export function detectDelimiter(text) {
  const sample = normalizeNewlines(text).split("\n").slice(0, 10).join("\n");
  const candidates = [",", ";", "\t", "|"];
  let best = DEFAULT_DELIMITER;
  let bestCount = -1;
  for (const candidate of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < sample.length; i += 1) {
      const ch = sample[i];
      if (ch === DEFAULT_QUOTE) {
        quoted = !quoted;
      } else if (!quoted && ch === candidate) {
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

export function escapeField(value, delimiter = DEFAULT_DELIMITER, quote = DEFAULT_QUOTE) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const needsQuote =
    text.includes(delimiter) ||
    text.includes(quote) ||
    text.includes("\n") ||
    text.includes("\r") ||
    /^\s|\s$/.test(text);
  if (!needsQuote) return text;
  return quote + text.split(quote).join(quote + quote) + quote;
}

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

export function parseCsv(text, options = {}) {
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const quote = options.quote ?? DEFAULT_QUOTE;
  const trim = options.trim ?? false;
  const skipEmptyLines = options.skipEmptyLines ?? false;
  const source = normalizeNewlines(text);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let lastWasNewline = true;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === quote) {
        if (source[i + 1] === quote) {
          field += quote;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      i += 1;
      continue;
    }

    if (ch === quote && field.length === 0) {
      inQuotes = true;
      lastWasNewline = false;
      i += 1;
      continue;
    }

    if (ch === delimiter) {
      row.push(trim ? field.trim() : field);
      field = "";
      lastWasNewline = false;
      i += 1;
      continue;
    }

    if (ch === "\n") {
      row.push(trim ? field.trim() : field);
      field = "";
      if (!(skipEmptyLines && row.length === 1 && row[0] === "")) {
        rows.push(row);
      }
      row = [];
      lastWasNewline = true;
      i += 1;
      continue;
    }

    field += ch;
    lastWasNewline = false;
    i += 1;
  }

  if (!lastWasNewline || row.length > 0 || field.length > 0) {
    row.push(trim ? field.trim() : field);
    if (!(skipEmptyLines && row.length === 1 && row[0] === "")) {
      rows.push(row);
    }
  }

  return rows;
}

export function parseCsvRecords(text, options = {}) {
  const rows = parseCsv(text, options);
  if (rows.length === 0) return [];
  const header = options.header ?? rows[0];
  const body = options.header ? rows : rows.slice(1);
  const mapper = options.map ?? ((value) => value);
  return body
    .filter((row) => !(row.length === 1 && row[0] === ""))
    .map((row) => {
      const record = {};
      header.forEach((key, index) => {
        record[key] = mapper(row[index] ?? "", key, index);
      });
      return record;
    });
}

export function stringifyRecords(records, options = {}) {
  if (records.length === 0) return "";
  const columns = options.columns ?? Object.keys(records[0]);
  const includeHeader = options.header ?? true;
  const rows = records.map((record) => columns.map((key) => record[key]));
  if (includeHeader) rows.unshift(columns);
  return stringifyCsv(rows, options);
}

export function splitLines(text) {
  return normalizeNewlines(text).split("\n");
}

export function parseNumber(value, options = {}) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (text === "") return null;
  const thousands = options.thousands ?? ",";
  const decimal = options.decimal ?? ".";
  if (thousands) text = text.split(thousands).join("");
  if (decimal !== ".") text = text.split(decimal).join(".");
  text = text.replace(/\s/g, "");
  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1, -1);
  const match = text.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/);
  if (!match) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

export function formatNumber(value, options = {}) {
  const number = typeof value === "number" ? value : parseNumber(value);
  if (number === null) return "";
  const decimals = options.decimals ?? 0;
  const thousands = options.thousands ?? ",";
  const fixed = number.toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const sign = integer.startsWith("-") ? "-" : "";
  const digits = sign ? integer.slice(1) : integer;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return fraction === undefined ? sign + grouped : sign + grouped + "." + fraction;
}

export function parseBool(value, options = {}) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toLowerCase();
  const truthy = options.truthy ?? ["true", "1", "yes", "y", "on"];
  const falsy = options.falsy ?? ["false", "0", "no", "n", "off"];
  if (truthy.includes(text)) return true;
  if (falsy.includes(text)) return false;
  return null;
}

export function formatBool(value, options = {}) {
  const trueText = options.trueText ?? "true";
  const falseText = options.falseText ?? "false";
  return value ? trueText : falseText;
}

export function parseDateValue(value, options = {}) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "") return null;
  const formats = options.formats ?? ["iso", "slash-ymd", "slash-mdy", "dot-ymd"];
  for (const format of formats) {
    const parsed = parseDateWithFormat(text, format);
    if (parsed) return parsed;
  }
  return null;
}

function parseDateWithFormat(text, format) {
  let match;
  if (format === "iso") {
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return null;
    return buildDate(match[1], match[2], match[3], match[4], match[5], match[6]);
  }
  if (format === "slash-ymd") {
    match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) return null;
    return buildDate(match[1], match[2], match[3]);
  }
  if (format === "slash-mdy") {
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    return buildDate(match[3], match[1], match[2]);
  }
  if (format === "dot-ymd") {
    match = text.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    if (!match) return null;
    return buildDate(match[1], match[2], match[3]);
  }
  return null;
}

function buildDate(year, month, day, hour = "0", minute = "0", second = "0") {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const min = Number(minute);
  const s = Number(second);
  const date = new Date(Date.UTC(y, m - 1, d, h, min, s));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

export function formatDate(date, pattern = "YYYY-MM-DD") {
  const value = parseDateValue(date);
  if (!value) return "";
  const parts = {
    YYYY: String(value.getUTCFullYear()).padStart(4, "0"),
    MM: String(value.getUTCMonth() + 1).padStart(2, "0"),
    DD: String(value.getUTCDate()).padStart(2, "0"),
    HH: String(value.getUTCHours()).padStart(2, "0"),
    mm: String(value.getUTCMinutes()).padStart(2, "0"),
    ss: String(value.getUTCSeconds()).padStart(2, "0"),
  };
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => parts[token]);
}

export function isDateString(value) {
  return parseDateValue(value) !== null;
}

export function columnValues(records, key) {
  return records.map((record) => record[key]);
}

export function selectColumns(records, keys) {
  return records.map((record) => {
    const selected = {};
    for (const key of keys) selected[key] = record[key];
    return selected;
  });
}

export function renameColumns(records, mapping) {
  return records.map((record) => {
    const renamed = {};
    for (const [key, value] of Object.entries(record)) {
      renamed[mapping[key] ?? key] = value;
    }
    return renamed;
  });
}

export function filterRows(records, predicate) {
  return records.filter(predicate);
}

export function sortRecords(records, key, direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...records].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right), "ja") * factor;
  });
}

export function chunk(rows, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError("size must be a positive integer");
  }
  const result = [];
  for (let i = 0; i < rows.length; i += size) {
    result.push(rows.slice(i, i + size));
  }
  return result;
}

export function unique(values) {
  return [...new Set(values)];
}

export function toJson(records, space = 0) {
  return JSON.stringify(records, null, space);
}

export function fromJson(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new TypeError("expected an array");
  return parsed;
}

export function inferSchema(records) {
  const schema = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (schema[key]) continue;
      if (value === null || value === undefined || value === "") {
        schema[key] = "string";
      } else if (typeof value === "boolean" || parseBool(value) !== null) {
        schema[key] = "boolean";
      } else if (parseNumber(value) !== null) {
        schema[key] = "number";
      } else if (isDateString(value)) {
        schema[key] = "date";
      } else {
        schema[key] = "string";
      }
    }
  }
  return schema;
}

export function convertRecord(record, schema) {
  const converted = {};
  for (const [key, value] of Object.entries(record)) {
    const type = schema[key] ?? "string";
    if (type === "number") converted[key] = parseNumber(value);
    else if (type === "boolean") converted[key] = parseBool(value);
    else if (type === "date") converted[key] = parseDateValue(value);
    else converted[key] = value === null || value === undefined ? "" : String(value);
  }
  return converted;
}

export function convertRecords(records, schema) {
  return records.map((record) => convertRecord(record, schema));
}

export function mergeRecords(base, extra, key) {
  const index = new Map(extra.map((record) => [record[key], record]));
  return base.map((record) => {
    const other = index.get(record[key]);
    return other ? { ...record, ...other } : { ...record };
  });
}

export function transpose(rows) {
  if (rows.length === 0) return [];
  const width = Math.max(...rows.map((row) => row.length));
  const result = [];
  for (let column = 0; column < width; column += 1) {
    result.push(rows.map((row) => row[column] ?? ""));
  }
  return result;
}

export function summarizeColumns(records) {
  const summary = {};
  for (const key of Object.keys(records[0] ?? {})) {
    const values = columnValues(records, key)
      .filter((value) => value !== "" && value !== null && value !== undefined);
    const numbers = values.map((value) => parseNumber(value)).filter((n) => n !== null);
    summary[key] = {
      count: values.length,
      distinct: unique(values).length,
      numeric: numbers.length === values.length && numbers.length > 0,
      min: numbers.length > 0 ? Math.min(...numbers) : null,
      max: numbers.length > 0 ? Math.max(...numbers) : null,
      sum: numbers.reduce((total, number) => total + number, 0),
    };
  }
  return summary;
}

export function groupRecords(records, keyFn) {
  const groups = new Map();
  for (const record of records) {
    const key = typeof keyFn === "function" ? keyFn(record) : record[keyFn];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return groups;
}

export function countBy(records, keyFn) {
  const counts = {};
  for (const record of records) {
    const key = typeof keyFn === "function" ? keyFn(record) : record[keyFn];
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function pluck(records, key, fallback = "") {
  return records.map((record) => (record[key] === undefined ? fallback : record[key]));
}

export function compact(records) {
  return records.filter((record) =>
    Object.values(record).some((value) => value !== "" && value !== null && value !== undefined),
  );
}
