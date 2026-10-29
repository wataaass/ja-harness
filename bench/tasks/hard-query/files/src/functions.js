import { QueryError } from "./errors.js";
import { isAggregateName, NODE } from "./types.js";
import { compareValues, isNull } from "./values.js";

export const AGGREGATE_NAMES = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
];

export function validateCall(call) {
  const name = call.name.toUpperCase();
  if (!isAggregateName(name)) {
    throw new QueryError(`使えない関数です: ${call.name}`);
  }
  if (name === "COUNT") {
    if (call.args.length !== 1) {
      throw new QueryError("COUNT の引数は1つです");
    }
    return;
  }
  if (call.args.length !== 1) {
    throw new QueryError(`${name} の引数は1つです`);
  }
  if (call.args[0].type === NODE.star) {
    throw new QueryError(`${name} に * は使えません`);
  }
}

function valuesFor(call, rows, evaluate) {
  const argument = call.args[0];
  if (argument.type === NODE.star) {
    return rows.map(() => 1);
  }
  return rows.map((row) => evaluate(argument, row, rows));
}

export function runAggregate(call, rows, evaluate) {
  const name = call.name.toUpperCase();
  validateCall(call);
  if (name === "COUNT") {
    if (call.args[0].type === NODE.star) {
      return rows.length;
    }
    return valuesFor(call, rows, evaluate).filter((value) => !isNull(value))
      .length;
  }

  const values = valuesFor(call, rows, evaluate).filter(
    (value) => !isNull(value),
  );
  if (values.length === 0) {
    return null;
  }

  if (name === "MIN" || name === "MAX") {
    let best = values[0];
    for (const value of values.slice(1)) {
      const order = compareValues(value, best);
      if ((name === "MIN" && order < 0) || (name === "MAX" && order > 0)) {
        best = value;
      }
    }
    return best;
  }

  for (const value of values) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new QueryError(`${name} には数値の列を指定してください`);
    }
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (name === "SUM") {
    return total;
  }
  if (name === "AVG") {
    return total / values.length;
  }
  throw new QueryError(`使えない関数です: ${call.name}`);
}

export function aggregateLabel(call) {
  return call.name.toLowerCase();
}
