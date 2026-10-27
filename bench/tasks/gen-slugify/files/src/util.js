export function isNil(value) {
  return value === null || value === undefined;
}

export function isNotNull(value) {
  return value !== null && value !== undefined;
}

export function isString(value) {
  return typeof value === "string";
}

export function isNumber(value) {
  return typeof value === "number";
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function isInteger(value) {
  return Number.isInteger(value);
}

export function isBoolean(value) {
  return typeof value === "boolean";
}

export function isFunction(value) {
  return typeof value === "function";
}

export function isArray(value) {
  return Array.isArray(value);
}

export function isDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function isRegExp(value) {
  return value instanceof RegExp;
}

export function isMap(value) {
  return value instanceof Map;
}

export function isSet(value) {
  return value instanceof Set;
}

export function isPromise(value) {
  return value !== null && typeof value === "object" && typeof value.then === "function";
}

export function isTruthy(value) {
  return Boolean(value);
}

export function isFalsy(value) {
  return !value;
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function isEven(value) {
  return Number(value) % 2 === 0;
}

export function isOdd(value) {
  return Math.abs(Number(value) % 2) === 1;
}

export function isPositive(value) {
  return Number(value) > 0;
}

export function isNegative(value) {
  return Number(value) < 0;
}

export function isZero(value) {
  return Number(value) === 0;
}

export function toString(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function nilToEmpty(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function toNumber(value, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toInteger(value, fallback = 0) {
  const number = toNumber(value, fallback);
  return Math.trunc(number);
}

export function toFloat(value, fallback = 0) {
  return toNumber(value, fallback);
}

export function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off", ""].includes(text)) return false;
  return Boolean(value);
}

export function toArray(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return [...value];
  if (typeof value === "string") return [...value];
  if (isIterable(value)) return [...value];
  return [value];
}

export function toSet(value) {
  return new Set(toArray(value));
}

export function toMap(value) {
  const map = new Map();
  for (const [key, entry] of Object.entries(value ?? {})) map.set(key, entry);
  return map;
}

export function toDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function defaultTo(value, fallback) {
  return value === null || value === undefined || Number.isNaN(value) ? fallback : value;
}

export function coalesce(...values) {
  for (const value of values) if (isNotNull(value)) return value;
  return undefined;
}

export function isIterable(value) {
  return value !== null && value !== undefined && typeof value[Symbol.iterator] === "function";
}

export function trim(text) {
  return String(text).trim();
}

export function trimStart(text) {
  return String(text).trimStart();
}

export function trimEnd(text) {
  return String(text).trimEnd();
}

export function collapseWhitespace(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

export function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n");
}

export function splitLines(text) {
  return normalizeNewlines(text).split("\n");
}

export function joinLines(lines) {
  return lines.join("\n");
}

export function toUpper(text) {
  return String(text).toUpperCase();
}

export function toLower(text) {
  return String(text).toLowerCase();
}

export function capitalize(text) {
  const value = String(text);
  if (value === "") return "";
  return value[0].toUpperCase() + value.slice(1);
}

export function decapitalize(text) {
  const value = String(text);
  if (value === "") return "";
  return value[0].toLowerCase() + value.slice(1);
}

export function swapCase(text) {
  return [...String(text)]
      .map((char) => (char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()))
      .join("");
}

export function repeatText(text, count, separator = "") {
  const size = Math.max(0, Math.floor(count));
  return Array.from({ length: size }, () => String(text)).join(separator);
}

export function padStartText(text, width, fill = " ") {
  return String(text).padStart(width, fill);
}

export function padEndText(text, width, fill = " ") {
  return String(text).padEnd(width, fill);
}

export function truncateText(text, maxLength, suffix = "…") {
  const chars = [...String(text)];
  const limit = Math.max(0, Math.floor(maxLength));
  if (chars.length <= limit) return chars.join("");
  const tail = [...String(suffix)];
  if (limit <= tail.length) return chars.slice(0, limit).join("");
  return chars.slice(0, limit - tail.length).join("") + suffix;
}

export function truncateMiddleText(text, maxLength, marker = "…") {
  const chars = [...String(text)];
  const limit = Math.max(0, Math.floor(maxLength));
  if (chars.length <= limit) return chars.join("");
  const marks = [...String(marker)];
  if (limit <= marks.length) return chars.slice(0, limit).join("");
  const remaining = limit - marks.length;
  const left = Math.ceil(remaining / 2);
  const right = Math.floor(remaining / 2);
  return chars.slice(0, left).join("") + marker + chars.slice(chars.length - right).join("");
}

export function ensurePrefix(text, prefix) {
  const value = String(text);
  return value.startsWith(prefix) ? value : String(prefix) + value;
}

export function ensureSuffix(text, suffix) {
  const value = String(text);
  return value.endsWith(suffix) ? value : value + String(suffix);
}

export function removePrefix(text, prefix) {
  const value = String(text);
  return value.startsWith(prefix) ? value.slice(String(prefix).length) : value;
}

export function removeSuffix(text, suffix) {
  const value = String(text);
  return value.endsWith(suffix) ? value.slice(0, value.length - String(suffix).length) : value;
}

export function startsWithText(text, prefix) {
  return String(text).startsWith(String(prefix));
}

export function endsWithText(text, suffix) {
  return String(text).endsWith(String(suffix));
}

export function includesText(text, search) {
  return String(text).includes(String(search));
}

export function countOccurrences(text, search) {
  if (search === "") return 0;
  return String(text).split(String(search)).length - 1;
}

export function replaceAllText(text, search, replacement) {
  return String(text).split(String(search)).join(String(replacement));
}

export function chars(text) {
  return [...String(text)];
}

export function charLength(text) {
  return [...String(text)].length;
}

export function byteLength(text) {
  return new TextEncoder().encode(String(text)).length;
}

export function words(text) {
  return String(text)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function escapeHtml(text) {
  return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

export function unescapeHtml(text) {
  return String(text)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
}

export function stripHtml(text) {
  return String(text)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
}

export function quoteText(text, mark = '"') {
  return `${mark}${String(text)}${mark}`;
}

export function unquoteText(text) {
  const value = String(text);
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  return (first === '"' || first === "'") && first === last ? value.slice(1, -1) : value;
}

export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  const rounded = Math.round(number);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatPercent(value, digits = 0) {
  return `${Number(value).toFixed(digits)}%`;
}

export function formatCurrency(value, symbol = "¥") {
  return `${symbol}${formatNumber(value)}`;
}

export function ordinal(value) {
  const number = Math.floor(Number(value));
  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
}

export function titleCase(text) {
  return String(text)
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => capitalize(word.toLowerCase()))
      .join(" ");
}

export function camelCase(text) {
  return words(text)
      .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word.toLowerCase())))
      .join("");
}

export function pascalCase(text) {
  return words(text).map((word) => capitalize(word.toLowerCase())).join("");
}

export function snakeCase(text) {
  return words(text).map((word) => word.toLowerCase()).join("_");
}

export function kebabCase(text) {
  return words(text).map((word) => word.toLowerCase()).join("-");
}

export function constantCase(text) {
  return words(text).map((word) => word.toUpperCase()).join("_");
}

export function dotCase(text) {
  return words(text).map((word) => word.toLowerCase()).join(".");
}

export function isAscii(text) {
  return /^[\x00-\x7F]*$/.test(String(text));
}

export function toAscii(text) {
  return String(text).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "");
}

export function head(values) {
  return values[0];
}

export function first(values, fallback) {
  return values.length === 0 ? fallback : values[0];
}

export function tail(values) {
  return values.slice(1);
}

export function last(values, fallback) {
  return values.length === 0 ? fallback : values[values.length - 1];
}

export function initial(values) {
  return values.slice(0, -1);
}

export function nth(values, index, fallback) {
  const position = index < 0 ? values.length + index : index;
  return position >= 0 && position < values.length ? values[position] : fallback;
}

export function flatten(values, depth = 1) {
  return depth <= 0 ? [...values] : values.flatMap((value) => (Array.isArray(value) ? flatten(value, depth - 1) : [value]));
}

export function flattenDeep(values) {
  return values.flatMap((value) => (Array.isArray(value) ? flattenDeep(value) : [value]));
}

export function chunk(values, size) {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError("size must be positive");
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export function compact(values) {
  return values.filter((value) => value !== null && value !== undefined && value !== "");
}

export function unique(values) {
  return [...new Set(values)];
}

export function uniqueBy(values, keyFn) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = keyFn(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

export function difference(left, right) {
  const blocked = new Set(right);
  return left.filter((value) => !blocked.has(value));
}

export function intersection(left, right) {
  const allowed = new Set(right);
  return left.filter((value) => allowed.has(value));
}

export function union(left, right) {
  return [...new Set([...left, ...right])];
}

export function without(values, blocked) {
  return values.filter((value) => !blocked.includes(value));
}

export function zip(...lists) {
  const length = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length }, (_, index) => lists.map((list) => list[index]));
}

export function unzip(pairs) {
  const left = [];
  const right = [];
  for (const [a, b] of pairs) {
    left.push(a);
    right.push(b);
  }
  return [left, right];
}

export function partition(values, predicate) {
  const pass = [];
  const fail = [];
  for (const value of values) (predicate(value) ? pass : fail).push(value);
  return [pass, fail];
}

export function groupBy(values, keyFn) {
  const groups = new Map();
  for (const value of values) {
    const key = typeof keyFn === "function" ? keyFn(value) : value[keyFn];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return groups;
}

export function countBy(values, keyFn) {
  const counts = new Map();
  for (const value of values) {
    const key = typeof keyFn === "function" ? keyFn(value) : value[keyFn];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function indexBy(values, keyFn) {
  const result = new Map();
  for (const value of values) result.set(keyFn(value), value);
  return result;
}

export function keyBy(values, keyFn) {
  const result = {};
  for (const value of values) result[keyFn(value)] = value;
  return result;
}

export function sortBy(values, keyFn, direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...values].sort((a, b) => {
    const left = typeof keyFn === "function" ? keyFn(a) : a[keyFn];
    const right = typeof keyFn === "function" ? keyFn(b) : b[keyFn];
    if (left === right) return 0;
    return left < right ? -1 * factor : 1 * factor;
  });
}

export function sortByStable(values, compare) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => compare(a.value, b.value) || a.index - b.index)
    .map((entry) => entry.value);
}

export function orderBy(values, keyFns) {
  const fns = Array.isArray(keyFns) ? keyFns : [keyFns];
  return [...values].sort((a, b) => {
    for (const keyFn of fns) {
      const left = keyFn(a);
      const right = keyFn(b);
      if (left === right) continue;
      return left < right ? -1 : 1;
    }
    return 0;
  });
}

export function range(start, end, step = 1) {
  if (step === 0) throw new RangeError("step must not be zero");
  const result = [];
  if (step > 0) {
    for (let value = start; value < end; value += step) result.push(value);
  } else {
    for (let value = start; value > end; value += step) result.push(value);
  }
  return result;
}

export function times(count, fn = (index) => index) {
  const size = Math.max(0, Math.floor(count));
  return Array.from({ length: size }, (_, index) => fn(index));
}

export function fillArray(length, value) {
  return Array.from({ length: Math.max(0, Math.floor(length)) }, () => value);
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function sumBy(values, keyFn) {
  return values.reduce((total, value) => total + keyFn(value), 0);
}

export function mean(values) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function meanBy(values, keyFn) {
  return values.length === 0 ? 0 : sumBy(values, keyFn) / values.length;
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function min(values) {
  return values.length === 0 ? undefined : Math.min(...values);
}

export function max(values) {
  return values.length === 0 ? undefined : Math.max(...values);
}

export function minBy(values, keyFn) {
  if (values.length === 0) return undefined;
  let best = values[0];
  for (const value of values) if (keyFn(value) < keyFn(best)) best = value;
  return best;
}

export function maxBy(values, keyFn) {
  if (values.length === 0) return undefined;
  let best = values[0];
  for (const value of values) if (keyFn(value) > keyFn(best)) best = value;
  return best;
}

export function take(values, count) {
  return values.slice(0, Math.max(0, count));
}

export function takeWhile(values, predicate) {
  const result = [];
  for (const value of values) {
    if (!predicate(value)) break;
    result.push(value);
  }
  return result;
}

export function drop(values, count) {
  return values.slice(Math.max(0, count));
}

export function dropWhile(values, predicate) {
  let index = 0;
  while (index < values.length && predicate(values[index])) index += 1;
  return values.slice(index);
}

export function findIndex(values, predicate, from = 0) {
  for (let index = Math.max(0, from); index < values.length; index += 1) {
    if (predicate(values[index], index)) return index;
  }
  return -1;
}

export function findLast(values, predicate) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index], index)) return values[index];
  }
  return undefined;
}

export function arrayToMap(values, keyFn, valueFn = (value) => value) {
  const result = new Map();
  for (const value of values) result.set(keyFn(value), valueFn(value));
  return result;
}

export function transpose(matrix) {
  const width = Math.max(0, ...matrix.map((row) => row.length));
  return Array.from({ length: width }, (_, column) => matrix.map((row) => row[column]));
}

export function windows(values, size) {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError("size must be positive");
  const result = [];
  for (let index = 0; index + size <= values.length; index += 1) result.push(values.slice(index, index + size));
  return result;
}

export function cartesian(left, right) {
  const result = [];
  for (const a of left) for (const b of right) result.push([a, b]);
  return result;
}

export function chunkWhile(values, predicate) {
  const result = [];
  let current = [];
  for (const value of values) {
    if (current.length === 0 || predicate(current[current.length - 1], value)) {
      current.push(value);
    } else {
      result.push(current);
      current = [value];
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

export function rotate(values, count) {
  if (values.length === 0) return [];
  const offset = ((count % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

export function interleave(left, right) {
  const result = [];
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (index < left.length) result.push(left[index]);
    if (index < right.length) result.push(right[index]);
  }
  return result;
}

export function pushUnique(values, value) {
  return values.includes(value) ? values : [...values, value];
}

export function removeAt(values, index) {
  return values.filter((_, position) => position !== index);
}

export function insertAt(values, index, value) {
  const result = [...values];
  result.splice(index, 0, value);
  return result;
}

export function moveItem(values, from, to) {
  const result = [...values];
  if (from < 0 || from >= result.length) return result;
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

export function isSorted(values, compare = (a, b) => a - b) {
  for (let index = 1; index < values.length; index += 1) {
    if (compare(values[index - 1], values[index]) > 0) return false;
  }
  return true;
}

export function keys(object) {
  return Object.keys(object ?? {});
}

export function values(object) {
  return Object.values(object ?? {});
}

export function entries(object) {
  return Object.entries(object ?? {});
}

export function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

export function getPath(object, path, fallback) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let current = object;
  for (const part of parts) {
    if (current === null || current === undefined) return fallback;
    current = current[part];
  }
  return current === undefined ? fallback : current;
}

export function setPath(object, path, value) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let current = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!isPlainObject(current[part]) && !Array.isArray(current[part])) current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
  return object;
}

export function unsetPath(object, path) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let current = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = current?.[parts[index]];
    if (current === null || current === undefined) return false;
  }
  return delete current[parts[parts.length - 1]];
}

export function hasPath(object, path) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let current = object;
  for (const part of parts) {
    if (current === null || current === undefined || !(part in current)) return false;
    current = current[part];
  }
  return true;
}

export function pick(object, selected) {
  const result = {};
  for (const key of selected) if (key in object) result[key] = object[key];
  return result;
}

export function omit(object, blocked) {
  const blockedSet = new Set(blocked);
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (!blockedSet.has(key)) result[key] = value;
  }
  return result;
}

export function merge(target, ...sources) {
  const result = { ...target };
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (isPlainObject(value) && isPlainObject(result[key])) result[key] = merge(result[key], value);
      else result[key] = value;
    }
  }
  return result;
}

export function mergeDeep(target, ...sources) {
  return merge(target, ...sources);
}

export function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Map) return new Map([...value].map(([key, entry]) => [deepClone(key), deepClone(entry)]));
  if (value instanceof Set) return new Set([...value].map(deepClone));
  if (Array.isArray(value)) return value.map(deepClone);
  const result = {};
  for (const [key, entry] of Object.entries(value)) result[key] = deepClone(entry);
  return result;
}

export function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => deepEqual(left[key], right[key]));
}

export function isEqual(left, right) {
  return deepEqual(left, right);
}

export function mapValues(object, fn) {
  const result = {};
  for (const [key, value] of Object.entries(object)) result[key] = fn(value, key);
  return result;
}

export function mapKeys(object, fn) {
  const result = {};
  for (const [key, value] of Object.entries(object)) result[fn(key, value)] = value;
  return result;
}

export function invert(object) {
  const result = {};
  for (const [key, value] of Object.entries(object)) result[value] = key;
  return result;
}

export function defaults(target, source) {
  return { ...source, ...omitUndefined(target) };
}

export function toPairs(object) {
  return Object.entries(object);
}

export function fromPairs(pairs) {
  const result = {};
  for (const [key, value] of pairs) result[key] = value;
  return result;
}

export function freezeDeep(value) {
  if (value === null || typeof value !== "object") return value;
  for (const entry of Object.values(value)) freezeDeep(entry);
  return Object.freeze(value);
}

export function assignDefined(target, ...sources) {
  const result = { ...target };
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (value !== undefined) result[key] = value;
    }
  }
  return result;
}

export function isEmptyObject(object) {
  return Object.keys(object ?? {}).length === 0;
}

export function compactObject(object) {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== null && value !== undefined && value !== "") result[key] = value;
  }
  return result;
}

export function omitUndefined(object) {
  const result = {};
  for (const [key, value] of Object.entries(object ?? {})) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function renameKeys(object, mapping) {
  const result = {};
  for (const [key, value] of Object.entries(object)) result[mapping[key] ?? key] = value;
  return result;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function inRange(value, min, max) {
  return value >= min && value < max;
}

export function roundTo(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function floorTo(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.floor(value * factor) / factor;
}

export function ceilTo(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.ceil(value * factor) / factor;
}

export function parseNumberStrict(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = String(value).trim();
  if (text === "") return undefined;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

export function parseIntegerStrict(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : undefined;
  const text = String(value).trim();
  if (!/^[+-]?\d+$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : undefined;
}

export function sign(value) {
  return Math.sign(Number(value));
}

export function gcd(left, right) {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function lcm(left, right) {
  return Math.abs(left * right) / gcd(left, right);
}

export function factorial(value) {
  const number = Math.max(0, Math.floor(value));
  let result = 1;
  for (let index = 2; index <= number; index += 1) result *= index;
  return result;
}

export function percentOf(part, whole) {
  return whole === 0 ? 0 : (part / whole) * 100;
}

export function identity(value) {
  return value;
}

export function noop() {
}

export function constant(value) {
  return () => value;
}

export function once(fn) {
  let called = false;
  let result;
  return (...args) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
}

export function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return (...args) => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };
}

export function debounce(fn, wait = 0) {
  let timer = null;
  return (...args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

export function throttle(fn, wait = 0) {
  let last = 0;
  let pending = null;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    pending = args;
    if (remaining <= 0) {
      last = now;
      fn(...pending);
      pending = null;
      return;
    }
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...pending);
        pending = null;
      }, remaining);
    }
  };
}

export function negate(fn) {
  return (...args) => !fn(...args);
}

export function partial(fn, ...bound) {
  return (...args) => fn(...bound, ...args);
}

export function compose(...fns) {
  return (value) => fns.reduceRight((current, fn) => fn(current), value);
}

export function pipe(...fns) {
  return (value) => fns.reduce((current, fn) => fn(current), value);
}

export function flip(fn) {
  return (left, right, ...rest) => fn(right, left, ...rest);
}

export function after(count, fn) {
  let calls = 0;
  return (...args) => {
    calls += 1;
    return calls >= count ? fn(...args) : undefined;
  };
}

export function before(count, fn) {
  let calls = 0;
  return (...args) => {
    calls += 1;
    return calls < count ? fn(...args) : undefined;
  };
}

export function tap(fn) {
  return (value) => {
    fn(value);
    return value;
  };
}

export class Stack {
  constructor(values = []) {
    this.items = [...values];
  }

  push(value) {
    this.items.push(value);
    return this;
  }

  pop() {
    return this.items.pop();
  }

  peek() {
    return this.items[this.items.length - 1];
  }

  get size() {
    return this.items.length;
  }

  get empty() {
    return this.items.length === 0;
  }

  clear() {
    this.items = [];
  }
}

export class Queue {
  constructor(values = []) {
    this.items = [...values];
    this.head = 0;
  }

  enqueue(value) {
    this.items.push(value);
    return this;
  }

  dequeue() {
    if (this.head >= this.items.length) return undefined;
    const value = this.items[this.head];
    this.head += 1;
    if (this.head > 32 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return value;
  }

  peek() {
    return this.items[this.head];
  }

  get size() {
    return this.items.length - this.head;
  }

  get empty() {
    return this.size === 0;
  }
}

export class Deque {
  constructor(values = []) {
    this.items = [...values];
  }

  pushFront(value) {
    this.items.unshift(value);
    return this;
  }

  pushBack(value) {
    this.items.push(value);
    return this;
  }

  popFront() {
    return this.items.shift();
  }

  popBack() {
    return this.items.pop();
  }

  get size() {
    return this.items.length;
  }

  toArray() {
    return [...this.items];
  }
}

export class Counter {
  constructor() {
    this.counts = new Map();
  }

  add(key, amount = 1) {
    this.counts.set(key, (this.counts.get(key) ?? 0) + amount);
    return this;
  }

  get(key) {
    return this.counts.get(key) ?? 0;
  }

  entries() {
    return [...this.counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  get size() {
    return this.counts.size;
  }
}

export class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  once(event, listener) {
    const wrapped = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  off(event, listener) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit(event, ...args) {
    const set = this.listeners.get(event);
    if (!set) return 0;
    for (const listener of [...set]) listener(...args);
    return set.size;
  }

  listenerCount(event) {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAll(event) {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
  }
}

export class LinkedMap {
  constructor(entries = []) {
    this.nodes = new Map();
    for (const [key, value] of entries) this.set(key, value);
  }

  set(key, value) {
    if (this.nodes.has(key)) {
      this.nodes.get(key).value = value;
    } else {
      this.nodes.set(key, { key, value });
    }
    return this;
  }

  get(key) {
    return this.nodes.get(key)?.value;
  }

  has(key) {
    return this.nodes.has(key);
  }

  delete(key) {
    return this.nodes.delete(key);
  }

  moveToEnd(key) {
    const node = this.nodes.get(key);
    if (!node) return false;
    this.nodes.delete(key);
    this.nodes.set(key, node);
    return true;
  }

  firstKey() {
    return this.nodes.keys().next().value;
  }

  lastKey() {
    let key;
    for (key of this.nodes.keys()) {
    }
    return key;
  }

  keys() {
    return [...this.nodes.keys()];
  }

  values() {
    return [...this.nodes.values()].map((node) => node.value);
  }

  entries() {
    return [...this.nodes.values()].map((node) => [node.key, node.value]);
  }

  clear() {
    this.nodes.clear();
  }

  get size() {
    return this.nodes.size;
  }

  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
}

export class Clock {
  constructor(now = () => Date.now()) {
    this.now = now;
  }

  read() {
    return this.now();
  }

  deadline(ttlMs) {
    return ttlMs > 0 ? this.read() + ttlMs : null;
  }

  expired(deadline, at = this.read()) {
    return deadline !== null && at >= deadline;
  }
}


export function foldSpecialLatin(text) {
  const map = {
    "ß": "ss",
    "Æ": "AE",
    "æ": "ae",
    "Œ": "OE",
    "œ": "oe",
    "Ø": "O",
    "ø": "o",
    "Đ": "D",
    "đ": "d",
    "Ð": "D",
    "ð": "d",
    "Ł": "L",
    "ł": "l",
    "Þ": "TH",
    "þ": "th",
  };
  return [...String(text)].map((char) => map[char] ?? char).join("");
}
