import { buildPlan } from "./planner.js";
import { parse } from "./parser.js";
import { execute } from "./executor.js";
import { validateInput } from "./validate.js";

export { QueryError } from "./errors.js";
export { parse } from "./parser.js";
export { tokenize } from "./tokenizer.js";
export { buildPlan } from "./planner.js";
export { execute } from "./executor.js";

export function query(tables, sql) {
  const text = validateInput(tables, sql);
  const statement = parse(text);
  const plan = buildPlan(statement, tables);
  return execute(plan);
}
