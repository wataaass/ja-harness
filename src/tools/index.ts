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

export type ToolsOptions = {
  beforeWrite?: (absPath: string) => void;
  plan?: PlanHandler;
};

export function createTools(
  cwd: string,
  confirm: Confirm,
  options: ToolsOptions | PlanHandler = {},
): Tool[] {
  const opts: ToolsOptions =
    typeof options === "function" ? { plan: options } : options;
  return [
    createReadTool(cwd),
    createListTool(cwd),
    createGrepTool(cwd),
    createEditTool(cwd, confirm, opts.beforeWrite),
    createWriteTool(cwd, confirm, opts.beforeWrite),
    createShellTool(cwd, confirm),
    createPlanTool(opts.plan),
  ];
}
