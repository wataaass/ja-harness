import { isFiniteNumber, isPlainObject } from "./utils.js";

export function monthOf(date) {
  if (typeof date !== "string" || date.length < 7) {
    throw new TypeError("date must be a string of YYYY-MM");
  }
  return date.slice(0, 7);
}

export function validateRecord(record, index) {
  if (!isPlainObject(record)) {
    throw new TypeError(`record ${index} must be an object`);
  }
  if (!isFiniteNumber(record.quantity)) {
    throw new TypeError(`quantity must be a finite number at record ${index}`);
  }
  if (!isFiniteNumber(record.unitPrice)) {
    throw new TypeError(`unitPrice must be a finite number at record ${index}`);
  }
  if (typeof record.date !== "string" || record.date.length < 7) {
    throw new TypeError(`date must be a string of YYYY-MM at record ${index}`);
  }
  if (typeof record.product !== "string" || record.product === "") {
    throw new TypeError(`product must be a non-empty string at record ${index}`);
  }
  const category = record.category;
  if (category === undefined || category === null || category === "") {
    return "未分類";
  }
  if (typeof category !== "string") {
    throw new TypeError(`category must be a string at record ${index}`);
  }
  return category;
}

export function createBucket(key, keyName) {
  return { [keyName]: key, total: 0, quantity: 0, count: 0 };
}

export function accumulate(bucket, amount, quantity) {
  bucket.total += amount;
  bucket.quantity += quantity;
  bucket.count += 1;
  return bucket;
}

export function finalizeBuckets(buckets, compare) {
  return [...buckets.values()].sort(compare);
}

export function byTotalThenName(nameKey) {
  return (left, right) =>
    right.total - left.total || left[nameKey].localeCompare(right[nameKey], "ja");
}

export function normalizeOptions(options = {}) {
  const top = options?.top ?? 3;
  if (!Number.isInteger(top) || top < 0) {
    throw new RangeError("top must be a non-negative integer");
  }
  return { top };
}

export function compareMonth(left, right) {
  return left.month.localeCompare(right.month);
}

export function emptySummary() {
  return {
    byMonth: [],
    byProduct: [],
    byCategory: [],
    topProducts: [],
    total: 0,
    quantity: 0,
    count: 0,
    average: 0,
  };
}

export function sumAmounts(records) {
  return records.reduce(
    (total, record) => total + record.quantity * record.unitPrice,
    0,
  );
}

export function sumQuantities(records) {
  return records.reduce((total, record) => total + record.quantity, 0);
}

export function describeRecord(record, index) {
  const category = validateRecord(record, index);
  return `${monthOf(record.date)} ${record.product} ${category}`;
}
