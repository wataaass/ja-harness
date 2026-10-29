import { QueryError } from "./errors.js";
import { isAggregateName, NODE } from "./types.js";
import { compareOperator, isTruthy } from "./values.js";

function valueOf(row, name) {
  if (!Object.hasOwn(row, name) || row[name] === undefined) {
    return null;
  }
  return row[name];
}

export function evaluate(expression, row) {
  switch (expression.type) {
    case NODE.literal:
      return expression.value;
    case NODE.column:
      return valueOf(row, expression.name);
    case NODE.comparison:
      return compareOperator(
        evaluate(expression.left, row),
        expression.operator,
        evaluate(expression.right, row),
      );
    case NODE.logical: {
      const left = evaluate(expression.left, row);
      if (expression.operator === "AND") {
        return isTruthy(left) && isTruthy(evaluate(expression.right, row));
      }
      return isTruthy(left) || isTruthy(evaluate(expression.right, row));
    }
    case NODE.not:
      return !isTruthy(evaluate(expression.value, row));
    case NODE.negative: {
      const value = evaluate(expression.value, row);
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new QueryError("マイナスは数値にだけ使えます");
      }
      return -value;
    }
    case NODE.call:
      if (isAggregateName(expression.name)) {
        throw new QueryError("集計関数はまだ使えません");
      }
      throw new QueryError(`使えない関数です: ${expression.name}`);
    default:
      throw new QueryError("式を評価できません");
  }
}

function filterRows(rows, where) {
  if (where === null) {
    return rows;
  }
  return rows.filter((row) => isTruthy(evaluate(where, row)));
}

function project(plan, row) {
  const output = {};
  for (const item of plan.select) {
    output[item.outputKey] = evaluate(item.expression, row);
  }
  return output;
}

export function execute(plan) {
  const filtered = filterRows(plan.rows, plan.where);
  return filtered.map((row) => project(plan, row));
}
