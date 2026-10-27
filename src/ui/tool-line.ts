import type { Theme } from "./theme.js";
import { truncate } from "./width.js";

const MARKS: Record<string, string> = {
  read: "読",
  list: "覧",
  grep: "探",
  edit: "編",
  write: "作",
  shell: "実",
  plan: "計",
  submit_plan: "計",
  ask: "問",
};

export function toolMark(name: string): string {
  return MARKS[name] ?? "・";
}

export function formatToolLine(o: {
  name: string;
  summary: string;
  detail?: string;
  failed?: boolean;
  theme: Theme;
  width: number;
}): string {
  const mark = toolMark(o.name);
  const prefix = o.failed ? ` ✕${mark}  ` : ` ${mark}  `;
  let line = o.failed
    ? o.theme.error(`${prefix}${o.summary}`)
    : `${prefix}${o.summary}`;
  if (o.detail !== undefined) {
    line += `  ${o.theme.dim(o.detail)}`;
  }
  return truncate(line, o.width);
}
