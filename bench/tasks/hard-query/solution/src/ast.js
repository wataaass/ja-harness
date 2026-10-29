import { NODE } from "./types.js";

export function literal(value) {
  return { type: NODE.literal, value };
}

export function column(name, table) {
  return {
    type: NODE.column,
    name,
    ...(table === undefined ? {} : { table }),
  };
}

export function star() {
  return { type: NODE.star };
}

export function comparison(left, operator, right) {
  return { type: NODE.comparison, left, operator, right };
}

export function logical(left, operator, right) {
  return { type: NODE.logical, left, operator, right };
}

export function not(value) {
  return { type: NODE.not, value };
}

export function negative(value) {
  return { type: NODE.negative, value };
}

export function call(name, args) {
  return { type: NODE.call, name, args };
}

export function selectItem(expression, alias) {
  return {
    expression,
    ...(alias === undefined ? {} : { alias }),
  };
}

export function orderItem(expression, direction) {
  return { expression, direction };
}

export function statement({
  select,
  table,
  where,
  groupBy,
  having,
  orderBy,
  limit,
  offset,
}) {
  return {
    select,
    table,
    where: where ?? null,
    groupBy: groupBy ?? [],
    having: having ?? null,
    orderBy: orderBy ?? [],
    limit: limit ?? null,
    offset: offset ?? null,
  };
}
