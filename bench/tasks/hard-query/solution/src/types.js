export const NODE = {
  literal: "literal",
  column: "column",
  comparison: "comparison",
  logical: "logical",
  not: "not",
  negative: "negative",
  call: "call",
  star: "star",
};

export const COMPARISON_OPERATORS = new Set([
  "=",
  "!=",
  "<>",
  "<",
  "<=",
  ">",
  ">=",
]);

export const LOGICAL_OPERATORS = new Set(["AND", "OR"]);

export const DIRECTIONS = new Set(["ASC", "DESC"]);

export function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

export function isAggregateName(name) {
  const upper = String(name).toUpperCase();
  return (
    upper === "COUNT" ||
    upper === "SUM" ||
    upper === "AVG" ||
    upper === "MIN" ||
    upper === "MAX"
  );
}

export function columnName(expression) {
  if (expression.type !== NODE.column) {
    return undefined;
  }
  return expression.name;
}

export function isColumn(expression, name) {
  return (
    expression.type === NODE.column &&
    expression.name === name &&
    (expression.table === undefined || expression.table === null)
  );
}

export function sameColumn(left, right) {
  if (left.type !== NODE.column || right.type !== NODE.column) {
    return false;
  }
  return (
    String(left.table ?? "") === String(right.table ?? "") &&
    left.name === right.name
  );
}

export function walkExpression(expression, visit) {
  if (expression === null || expression === undefined) {
    return;
  }
  visit(expression);
  switch (expression.type) {
    case NODE.comparison:
      walkExpression(expression.left, visit);
      walkExpression(expression.right, visit);
      break;
    case NODE.logical:
      walkExpression(expression.left, visit);
      walkExpression(expression.right, visit);
      break;
    case NODE.not:
    case NODE.negative:
      walkExpression(expression.value, visit);
      break;
    case NODE.call:
      for (const argument of expression.args) {
        walkExpression(argument, visit);
      }
      break;
    default:
      break;
  }
}

export function collectColumns(expression) {
  const found = [];
  if (expression === null || expression === undefined) {
    return found;
  }
  walkExpression(expression, (node) => {
    if (node.type === NODE.column) {
      found.push(node);
    }
  });
  return found;
}

export function collectCalls(expression) {
  const found = [];
  if (expression === null || expression === undefined) {
    return found;
  }
  walkExpression(expression, (node) => {
    if (node.type === NODE.call) {
      found.push(node);
    }
  });
  return found;
}

export function containsAggregate(expression) {
  return collectCalls(expression).some((call) =>
    isAggregateName(call.name),
  );
}

export function describeExpression(expression) {
  switch (expression.type) {
    case NODE.literal:
      if (expression.value === null) {
        return "NULL";
      }
      if (typeof expression.value === "string") {
        return `'${expression.value.replaceAll("'", "''")}'`;
      }
      return String(expression.value);
    case NODE.column:
      return expression.table === undefined
        ? expression.name
        : `${expression.table}.${expression.name}`;
    case NODE.comparison:
      return `${describeExpression(expression.left)} ${expression.operator} ${describeExpression(expression.right)}`;
    case NODE.logical:
      return `${describeExpression(expression.left)} ${expression.operator} ${describeExpression(expression.right)}`;
    case NODE.not:
      return `NOT ${describeExpression(expression.value)}`;
    case NODE.negative:
      return `-${describeExpression(expression.value)}`;
    case NODE.call:
      return `${expression.name}(${expression.args.map(describeExpression).join(", ")})`;
    case NODE.star:
      return "*";
    default:
      return "?";
  }
}
