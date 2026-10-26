import type { Complete } from "../agent/loop.js";
import type { Message, ToolSpec, Usage } from "../llm/types.js";
import { pruneToolResults } from "./prune.js";
import { summarize } from "./summary.js";
import type { Estimator } from "./tokens.js";
import { estimateMessages } from "./tokens.js";

export type ContextConfig = {
  contextWindow: number;
  summaryMaxTokens: number;
  summaryMaxRatio: number;
  keepRecentTokens: number;
  prune: { maxTokens: number; headTokens: number; tailTokens: number };
  overflowRetries: number;
};

export const DEFAULT_CONTEXT: Omit<ContextConfig, "contextWindow"> = {
  summaryMaxTokens: 64000,
  summaryMaxRatio: 0.5,
  keepRecentTokens: 20000,
  prune: { maxTokens: 4000, headTokens: 2000, tailTokens: 500 },
  overflowRetries: 1,
};

export function summaryThreshold(c: ContextConfig): number {
  return Math.floor(
    Math.min(c.summaryMaxTokens, c.contextWindow * c.summaryMaxRatio),
  );
}

export type ContextAction = {
  action: "prune" | "summary";
  savedTokens: number;
};

export type StepPrep = { usage?: Usage; actions: ContextAction[] };

export function createContextManager(o: {
  config: ContextConfig;
  complete: Complete;
  estimate: Estimator;
}): {
  beforeStep(
    messages: Message[],
    tools: ToolSpec[],
    reportedTokens: number | undefined,
    signal?: AbortSignal,
  ): Promise<StepPrep>;
  onOverflow(
    messages: Message[],
    tools: ToolSpec[],
    signal?: AbortSignal,
  ): Promise<StepPrep>;
} {
  const { config, complete, estimate } = o;
  const threshold = summaryThreshold(config);

  function pressure(
    messages: Message[],
    reportedTokens: number | undefined,
  ): number {
    return Math.max(estimateMessages(messages, estimate), reportedTokens ?? 0);
  }

  function pruneOptions() {
    return {
      maxTokens: config.prune.maxTokens,
      headTokens: config.prune.headTokens,
      tailTokens: config.prune.tailTokens,
      estimate,
    };
  }

  type PruneResult = ReturnType<typeof pruneToolResults>;

  function applyPrune(
    messages: Message[],
    result: PruneResult,
    actions: ContextAction[],
  ): void {
    if (result.pruned > 0) {
      messages.splice(0, messages.length, ...result.messages);
      actions.push({ action: "prune", savedTokens: result.savedTokens });
    }
  }

  function prune(messages: Message[], actions: ContextAction[]): number {
    const result = pruneToolResults(messages, pruneOptions());
    applyPrune(messages, result, actions);
    return result.savedTokens;
  }

  async function summarizeStep(
    messages: Message[],
    tools: ToolSpec[],
    actions: ContextAction[],
    signal?: AbortSignal,
  ): Promise<{ usage?: Usage; applied: boolean }> {
    const before = estimateMessages(messages, estimate);
    const result = await summarize({
      complete,
      messages,
      tools,
      keepRecentTokens: config.keepRecentTokens,
      estimate,
      signal,
    });
    if (result.messages !== null) {
      messages.splice(0, messages.length, ...result.messages);
      const after = estimateMessages(messages, estimate);
      actions.push({ action: "summary", savedTokens: before - after });
      return { usage: result.usage, applied: true };
    }
    return { usage: result.usage, applied: false };
  }

  return {
    async beforeStep(messages, tools, reportedTokens, signal) {
      const actions: ContextAction[] = [];
      if (pressure(messages, reportedTokens) <= threshold) {
        return { actions };
      }

      const pruned = pruneToolResults(messages, pruneOptions());
      const prunedPressure = Math.max(
        estimateMessages(pruned.messages, estimate),
        (reportedTokens ?? 0) - pruned.savedTokens,
      );
      if (prunedPressure <= threshold) {
        applyPrune(messages, pruned, actions);
        return { actions };
      }

      const result = await summarizeStep(messages, tools, actions, signal);
      if (result.applied) {
        applyPrune(
          messages,
          pruneToolResults(messages, pruneOptions()),
          actions,
        );
      } else {
        applyPrune(messages, pruned, actions);
      }
      return result.usage === undefined
        ? { actions }
        : { usage: result.usage, actions };
    },

    async onOverflow(messages, tools, signal) {
      const actions: ContextAction[] = [];
      prune(messages, actions);
      const result = await summarizeStep(messages, tools, actions, signal);
      return result.usage === undefined
        ? { actions }
        : { usage: result.usage, actions };
    },
  };
}
