import { QueryError } from "./errors.js";
import { runAggregate } from "./functions.js";
import { isAggregateName, NODE } from "./types.js";
import {
  compareOperator,
  compareValues,
  isNull,
  isTruthy,
} from "./values.js";

function valueOf(row, name) {
  if (!Object.hasOwn(row, name) || row[name] === undefined) {
    return null;
  }
  return row[name];
}

export function evaluate(expression, row, groupRows) {
  switch (expression.type) {
    case NODE.literal:
      return expression.value;
    case NODE.column:
      return valueOf(row, expression.name);
    case NODE.comparison:
      return compareOperator(
        evaluate(expression.left, row, groupRows),
        expression.operator,
        evaluate(expression.right, row, groupRows),
      );
    case NODE.logical: {
      const left = evaluate(expression.left, row, groupRows);
      if (expression.operator === "AND") {
        return isTruthy(left) && isTruthy(evaluate(expression.right, row, groupRows));
      }
      return isTruthy(left) || isTruthy(evaluate(expression.right, row, groupRows));
    }
    case NODE.not:
      return !isTruthy(evaluate(expression.value, row, groupRows));
    case NODE.negative: {
      const value = evaluate(expression.value, row, groupRows);
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new QueryError("マイナスは数値にだけ使えます");
      }
      return -value;
    }
    case NODE.call: {
      if (isAggregateName(expression.name)) {
        return runAggregate(expression, groupRows, evaluate);
      }
      throw new QueryError(`使えない関数です: ${expression.name}`);
    }
    default:
      throw new QueryError("式を評価できません");
  }
}

function filterRows(rows, where) {
  if (where === null) {
    return rows;
  }
  return rows.filter((row) => isTruthy(evaluate(where, row, [row])));
}

function groupKey(values) {
  return JSON.stringify(values.map((value) => (value === undefined ? null : value)));
}

function makeGroups(plan, rows) {
  if (plan.groupBy.length === 0) {
    return [
      {
        values: [],
        rows,
        representative: rows[0] ?? {},
      },
    ];
  }

  const groups = new Map();
  for (const row of rows) {
    const values = plan.groupBy.map((expression) =>
      evaluate(expression, row, [row]),
    );
    const key = groupKey(values);
    let group = groups.get(key);
    if (group === undefined) {
      group = { values, rows: [], representative: row };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}

function project(plan, representative, groupRows) {
  const output = {};
  for (const item of plan.select) {
    output[item.outputKey] = evaluate(
      item.expression,
      representative,
      groupRows,
    );
  }
  return output;
}

function compareOrder(left, right, direction) {
  const leftNull = isNull(left);
  const rightNull = isNull(right);
  if (leftNull || rightNull) {
    if (leftNull && rightNull) {
      return 0;
    }
    return leftNull ? 1 : -1;
  }
  const order = compareValues(left, right);
  return direction === "DESC" ? -order : order;
}

function sortEntries(plan, entries) {
  if (plan.orderBy.length === 0) {
    return entries;
  }
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      for (const item of plan.orderBy) {
        const leftValue =
          item.aliasKey === null
            ? evaluate(item.expression, left.entry.representative, left.entry.groupRows)
            : left.entry.output[item.aliasKey];
        const rightValue =
          item.aliasKey === null
            ? evaluate(item.expression, right.entry.representative, right.entry.groupRows)
            : right.entry.output[item.aliasKey];
        const order = compareOrder(leftValue, rightValue, item.direction);
        if (order !== 0) {
          return order;
        }
      }
      return left.index - right.index;
    })
    .map((item) => item.entry);
}

export function execute(plan) {
  const filtered = filterRows(plan.rows, plan.where);
  const groups = plan.grouped
    ? makeGroups(plan, filtered)
    : filtered.map((row) => ({
        values: [],
        rows: [row],
        representative: row,
      }));

  let entries = groups
    .filter((group) => {
      if (plan.having === null) {
        return true;
      }
      return isTruthy(
        evaluate(plan.having, group.representative, group.rows),
      );
    })
    .map((group) => ({
      representative: group.representative,
      groupRows: group.rows,
      output: project(plan, group.representative, group.rows),
    }));

  entries = sortEntries(plan, entries);

  const offset = plan.offset ?? 0;
  const limit = plan.limit;
  const end = limit === null ? undefined : offset + limit;
  return entries.slice(offset, end).map((entry) => entry.output);
}
