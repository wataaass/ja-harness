import { column } from "./ast.js";
import { QueryError } from "./errors.js";
import { aggregateLabel, validateCall } from "./functions.js";
import {
  checkColumns,
  schemaOf,
  selectRows,
} from "./validate.js";
import {
  collectCalls,
  containsAggregate,
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
    if (call.args.some((argument) => containsAggregate(argument))) {
      throw new QueryError("集計関数の中に集計関数は書けません");
    }
  }
}

function nonAggregateColumns(expression, found = []) {
  if (expression === null || expression === undefined) {
    return found;
  }
  if (expression.type === NODE.column) {
    found.push(expression);
    return found;
  }
  switch (expression.type) {
    case NODE.comparison:
    case NODE.logical:
      nonAggregateColumns(expression.left, found);
      nonAggregateColumns(expression.right, found);
      break;
    case NODE.not:
    case NODE.negative:
      nonAggregateColumns(expression.value, found);
      break;
    case NODE.call:
      if (!isAggregateName(expression.name)) {
        for (const argument of expression.args) {
          nonAggregateColumns(argument, found);
        }
      }
      break;
    default:
      break;
  }
  return found;
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

function buildSelect(statement, schema, grouped, check) {
  if (statement.select.length === 1 && statement.select[0].expression.type === NODE.star) {
    if (grouped) {
      throw new QueryError("GROUP BY と一緒に * は使えません");
    }
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
    check(item.expression);
    return {
      expression: item.expression,
      outputKey: outputKeyOf(item),
      aggregate: containsAggregate(item.expression),
    };
  });
}

function checkGroupedColumns(expression, groupNames, label) {
  for (const node of nonAggregateColumns(expression)) {
    if (!groupNames.has(node.name)) {
      throw new QueryError(
        `${label} では GROUP BY にない列 ${node.name} を使えません`,
      );
    }
  }
}

export function buildPlan(statement, tables) {
  const rows = selectRows(tables, statement.table);
  const schema = schemaOf(rows);
  const check =
    rows.length === 0
      ? () => {}
      : (expression) => checkColumns(expression, schema, statement.table);

  check(statement.where);
  if (statement.where !== null && containsAggregate(statement.where)) {
    throw new QueryError("WHERE に集計関数は使えません");
  }
  checkFunctionCalls(statement.where);

  for (const expression of statement.groupBy) {
    check(expression);
    checkFunctionCalls(expression);
  }

  const hasAggregate =
    statement.select.some((item) => containsAggregate(item.expression)) ||
    (statement.having !== null && containsAggregate(statement.having)) ||
    statement.orderBy.some((item) => containsAggregate(item.expression));

  const grouped = statement.groupBy.length > 0 || hasAggregate;
  const groupNames = new Set(
    statement.groupBy.map((expression) => expression.name),
  );

  if (statement.having !== null) {
    checkFunctionCalls(statement.having);
    check(statement.having);
    if (!grouped) {
      throw new QueryError(
        "HAVING には GROUP BY か集計関数が必要です",
      );
    }
    checkGroupedColumns(statement.having, groupNames, "HAVING");
  }

  const select = buildSelect(statement, schema, grouped, check);
  if (grouped) {
    for (const item of select) {
      checkGroupedColumns(item.expression, groupNames, "SELECT");
    }
  }

  const aliases = new Set(select.map((item) => item.outputKey));
  const orderBy = statement.orderBy.map((item) => {
    const expression = item.expression;
    const isAlias =
      expression.type === NODE.column &&
      expression.table === undefined &&
      aliases.has(expression.name);
    if (!isAlias) {
      checkFunctionCalls(expression);
      check(expression);
      if (grouped) {
        checkGroupedColumns(expression, groupNames, "ORDER BY");
      }
      if (!grouped && hasAggregate) {
        throw new QueryError(
          "集計した問い合わせでは列だけで並べ替えられません",
        );
      }
    }
    return {
      expression,
      direction: item.direction,
      aliasKey: isAlias ? expression.name : null,
    };
  });

  return {
    table: statement.table,
    rows,
    select,
    where: statement.where,
    groupBy: statement.groupBy,
    having: statement.having,
    orderBy,
    limit: statement.limit,
    offset: statement.offset,
    grouped,
    hasAggregate,
  };
}
