import { QueryError } from "./errors.js";
import { collectColumns, isPlainObject } from "./types.js";

export function validateInput(tables, sql) {
  if (!isPlainObject(tables)) {
    throw new QueryError("tables はテーブル名をキーにしたオブジェクトです");
  }
  if (typeof sql !== "string" || sql.trim() === "") {
    throw new QueryError("SQL は空でない文字列で指定してください");
  }
  return sql;
}

export function selectRows(tables, table) {
  if (!Object.hasOwn(tables, table)) {
    throw new QueryError(`テーブルがありません: ${table}`);
  }
  const rows = tables[table];
  if (!Array.isArray(rows)) {
    throw new QueryError(`テーブル ${table} は行の配列です`);
  }
  for (const row of rows) {
    if (!isPlainObject(row)) {
      throw new QueryError(`テーブル ${table} の行はオブジェクトです`);
    }
  }
  return rows;
}

export function schemaOf(rows) {
  const names = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      names.add(key);
    }
  }
  return names;
}

export function checkColumns(expression, schema, table) {
  if (expression === null || expression === undefined) {
    return;
  }
  for (const node of collectColumns(expression)) {
    if (node.table !== undefined && node.table !== table) {
      throw new QueryError(
        `この問い合わせでは ${node.table}.${node.name} を参照できません`,
      );
    }
    if (!schema.has(node.name)) {
      throw new QueryError(`列がありません: ${node.name}`);
    }
  }
}
