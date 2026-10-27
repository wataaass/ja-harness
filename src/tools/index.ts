import type { Tool } from "../agent/loop.js";
import type { Confirm } from "./confirm.js";
import { createEditTool } from "./edit.js";
import { createGrepTool } from "./grep.js";
import { createListTool } from "./list.js";
import { createPlanTool, type PlanHandler } from "./plan.js";
import { createReadTool } from "./read.js";
import { createShellTool } from "./shell.js";
import { createWriteTool } from "./write.js";

export type { Confirm, ConfirmRequest } from "./confirm.js";
export type { PlanHandler } from "./plan.js";

export function createTools(
  cwd: string,
  confirm: Confirm,
  plan?: PlanHandler,
): Tool[] {
  return [
    createReadTool(cwd),
    createListTool(cwd),
    createGrepTool(cwd),
    createEditTool(cwd, confirm),
    createWriteTool(cwd, confirm),
    createShellTool(cwd, confirm),
    createPlanTool(plan),
  ];
}
