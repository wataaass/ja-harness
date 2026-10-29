import { column } from "./ast.js";
import { QueryError } from "./errors.js";
import { aggregateLabel, validateCall } from "./functions.js";
import { checkColumns, schemaOf, selectRows } from "./validate.js";
import {
  collectCalls,
  describeExpression,
  isAggregateName,
  NODE,
} from "./types.js";

function checkFunctionCalls(expression) {
  for (const call of collectCalls(expression)) {
    if (!isAggregateName(call.name)) {
      throw new QueryError(`使えない関数です: ${call.name}`);
    }
    validateCall(call);
  }
}

function outputKeyOf(item) {
  if (item.alias !== undefined) {
    if (item.alias === "") {
      throw new QueryError("別名が空です");
    }
    return item.alias;
  }
  const expression = item.expression;
  if (expression.type === NODE.column) {
    return expression.name;
  }
  if (expression.type === NODE.call && isAggregateName(expression.name)) {
    return aggregateLabel(expression);
  }
  return describeExpression(expression);
}

function buildSelect(statement, schema, table, hasRows) {
  if (
    statement.select.length === 1 &&
    statement.select[0].expression.type === NODE.star
  ) {
    return [...schema].map((name) => ({
      expression: column(name),
      outputKey: name,
      aggregate: false,
    }));
  }
  return statement.select.map((item) => {
    if (item.expression.type === NODE.star) {
      throw new QueryError("SELECT の * は単独で使ってください");
    }
    checkFunctionCalls(item.expression);
    if (hasRows) {
      checkColumns(item.expression, schema, table);
    }
    return {
      expression: item.expression,
      outputKey: outputKeyOf(item),
      aggregate: false,
    };
  });
}

export function buildPlan(statement, tables) {
  const rows = selectRows(tables, statement.table);
  const schema = schemaOf(rows);

  if (rows.length > 0) {
    checkColumns(statement.where, schema, statement.table);
  }
  checkFunctionCalls(statement.where);

  return {
    table: statement.table,
    rows,
    select: buildSelect(statement, schema, statement.table, rows.length > 0),
    where: statement.where,
    groupBy: [],
    having: null,
    orderBy: [],
    limit: null,
    offset: null,
    grouped: false,
    hasAggregate: false,
  };
}
