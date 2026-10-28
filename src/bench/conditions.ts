import { join, relative } from "node:path";
import type { Complete, RunOptions, Tool } from "../agent/loop.js";
import {
  type ContextConfig,
  createContextManager,
  DEFAULT_CONTEXT,
} from "../context/manager.js";
import { createFileSaver, limitToolResult } from "../context/spill.js";
import type { Estimator } from "../context/tokens.js";
import { modelPrices } from "../llm/models.js";

export const CONDITIONS = ["none", "input-only", "default"] as const;

export type ConditionName = (typeof CONDITIONS)[number];

export type ConditionOptions = {
  name: ConditionName;
  workspace: string;
  complete: Complete;
  contextWindow: number;
  estimate: Estimator;
  model?: string;
  context?: Partial<ContextConfig>;
};

export type ConditionParts = Pick<RunOptions, "limitResult" | "context">;

export function isConditionName(value: string): value is ConditionName {
  return (CONDITIONS as readonly string[]).includes(value);
}

export function createCondition(o: ConditionOptions): ConditionParts {
  if (o.name === "none") {
    return {};
  }

  const saver = createFileSaver(join(o.workspace, ".ja-harness", "out"));
  const save = (text: string) => relative(o.workspace, saver(text));
  const limitResult = (text: string, tool: Tool | undefined): string =>
    limitToolResult(text, {
      maxTokens: tool?.maxResultTokens ?? 2000,
      estimate: o.estimate,
      save,
    });

  if (o.name === "input-only") {
    return { limitResult };
  }

  const prices = o.model === undefined ? undefined : modelPrices(o.model);
  const manager = createContextManager({
    config: {
      ...DEFAULT_CONTEXT,
      contextWindow: o.contextWindow,
      ...o.context,
      ...(prices === undefined ? {} : { prices }),
    },
    complete: o.complete,
    estimate: o.estimate,
  });

  return {
    limitResult,
    context: {
      manager,
      overflowRetries: DEFAULT_CONTEXT.overflowRetries,
    },
  };
}
