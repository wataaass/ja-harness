import { QueryError } from "./errors.js";

export function isNull(value) {
  return value === null || value === undefined;
}

export function isTruthy(value) {
  if (isNull(value)) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0 && !Number.isNaN(value);
  }
  if (typeof value === "string") {
    return value !== "";
  }
  return true;
}

function typeRank(value) {
  if (typeof value === "number") {
    return 0;
  }
  if (typeof value === "string") {
    return 1;
  }
  if (typeof value === "boolean") {
    return 2;
  }
  return 3;
}

export function compareValues(left, right) {
  if (isNull(left) || isNull(right)) {
    return 0;
  }
  const leftRank = typeRank(left);
  const rightRank = typeRank(right);
  if (leftRank !== rightRank) {
    return leftRank < rightRank ? -1 : 1;
  }
  if (typeof left === "number" && Number.isNaN(left)) {
    return Number.isNaN(right) ? 0 : -1;
  }
  if (typeof right === "number" && Number.isNaN(right)) {
    return 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function equalValues(left, right) {
  if (isNull(left) || isNull(right)) {
    return false;
  }
  return left === right;
}

export function compareOperator(left, operator, right) {
  if (isNull(left) || isNull(right)) {
    return false;
  }
  switch (operator) {
    case "=":
      return equalValues(left, right);
    case "!=":
    case "<>":
      return !equalValues(left, right);
    case "<":
      return compareValues(left, right) < 0;
    case "<=":
      return compareValues(left, right) <= 0;
    case ">":
      return compareValues(left, right) > 0;
    case ">=":
      return compareValues(left, right) >= 0;
    default:
      throw new QueryError(`使えない比較演算子です: ${operator}`);
  }
}

export function compareForSort(left, right) {
  const leftNull = isNull(left);
  const rightNull = isNull(right);
  if (leftNull && rightNull) {
    return 0;
  }
  if (leftNull) {
    return 1;
  }
  if (rightNull) {
    return -1;
  }
  return compareValues(left, right);
}

export function toNumber(value, label) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    if (!Number.isNaN(number)) {
      return number;
    }
  }
  throw new QueryError(`${label} には数値が必要です`);
}
