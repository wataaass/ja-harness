import type { Complete } from "../agent/loop.js";
import type { Message, ToolSpec, Usage } from "../llm/types.js";
import { rewritePays } from "./price.js";
import { pruneToolResults } from "./prune.js";
import { summarize } from "./summary.js";
import type { Estimator } from "./tokens.js";
import { estimateMessages } from "./tokens.js";

export type ContextConfig = {
  contextWindow: number;
  summaryMaxTokens: number;
  summaryMaxRatio: number;
  targetRatio: number;
  keepRecentTokens: number;
  prune: { maxTokens: number; headTokens: number; tailTokens: number };
  overflowRetries: number;
  mode: "price" | "always";
  prices?: { input: number; cachedInput: number; cacheWrite?: number };
  minCallsAhead: number;
};

export const DEFAULT_CONTEXT: Omit<ContextConfig, "contextWindow"> = {
  summaryMaxTokens: 64000,
  summaryMaxRatio: 0.5,
  targetRatio: 1,
  keepRecentTokens: 20000,
  prune: { maxTokens: 4000, headTokens: 2000, tailTokens: 500 },
  overflowRetries: 1,
  mode: "price",
  minCallsAhead: 3,
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
  compactNow(
    messages: Message[],
    tools: ToolSpec[],
    signal?: AbortSignal,
  ): Promise<StepPrep>;
} {
  const { config, complete, estimate } = o;
  const threshold = summaryThreshold(config);
  const target = Math.floor(threshold * config.targetRatio);
  const retryGrowth = Math.max(4000, Math.floor(threshold * 0.1));
  let calls = 0;
  let failedSummaryAt: number | undefined;

  function firstRewrittenIndex(before: Message[], after: Message[]): number {
    for (let i = 0; i < after.length; i += 1) {
      if (after[i] !== before[i]) {
        return i;
      }
    }
    return -1;
  }

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
    keepRecentTokens: number,
    signal?: AbortSignal,
  ): Promise<{ usage?: Usage; applied: boolean }> {
    const before = estimateMessages(messages, estimate);
    const result = await summarize({
      complete,
      messages,
      tools,
      keepRecentTokens,
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
      calls += 1;
      const actions: ContextAction[] = [];
      const currentPressure = pressure(messages, reportedTokens);
      if (currentPressure <= threshold) {
        const prices = config.prices;
        if (config.mode === "always" || prices === undefined) {
          return { actions };
        }

        const pruned = pruneToolResults(messages, pruneOptions());
        if (pruned.pruned === 0) {
          return { actions };
        }
        const first = firstRewrittenIndex(messages, pruned.messages);
        if (first === -1) {
          return { actions };
        }
        const rewrittenTokens = estimateMessages(
          pruned.messages.slice(first),
          estimate,
        );
        if (
          rewritePays({
            rewrittenTokens,
            savedTokens: pruned.savedTokens,
            callsAhead: Math.max(config.minCallsAhead, calls),
            prices,
          })
        ) {
          applyPrune(messages, pruned, actions);
        }
        return { actions };
      }

      const pruned = pruneToolResults(messages, pruneOptions());
      const prunedPressure = Math.max(
        estimateMessages(pruned.messages, estimate),
        (reportedTokens ?? 0) - pruned.savedTokens,
      );
      if (prunedPressure <= target) {
        applyPrune(messages, pruned, actions);
        return { actions };
      }

      if (
        failedSummaryAt !== undefined &&
        currentPressure - failedSummaryAt < retryGrowth
      ) {
        applyPrune(messages, pruned, actions);
        return { actions };
      }

      const keepRecentTokens = Math.min(
        config.keepRecentTokens,
        Math.floor(target / 2),
      );
      const result = await summarizeStep(
        messages,
        tools,
        actions,
        keepRecentTokens,
        signal,
      );
      if (result.applied) {
        failedSummaryAt = undefined;
        applyPrune(
          messages,
          pruneToolResults(messages, pruneOptions()),
          actions,
        );
      } else {
        failedSummaryAt = currentPressure;
        applyPrune(messages, pruned, actions);
      }
      return result.usage === undefined
        ? { actions }
        : { usage: result.usage, actions };
    },

    async onOverflow(messages, tools, signal) {
      const actions: ContextAction[] = [];
      prune(messages, actions);
      const currentPressure = pressure(messages, undefined);
      const result = await summarizeStep(
        messages,
        tools,
        actions,
        config.keepRecentTokens,
        signal,
      );
      if (result.applied) {
        failedSummaryAt = undefined;
      } else {
        failedSummaryAt = currentPressure;
      }
      return result.usage === undefined
        ? { actions }
        : { usage: result.usage, actions };
    },

    async compactNow(messages, tools, signal) {
      const actions: ContextAction[] = [];
      prune(messages, actions);
      const currentPressure = pressure(messages, undefined);
      const last = messages[messages.length - 1];
      const keepRecent =
        last === undefined ? 0 : estimateMessages([last], estimate) + 1;
      const result = await summarizeStep(
        messages,
        tools,
        actions,
        keepRecent,
        signal,
      );
      if (result.applied) {
        failedSummaryAt = undefined;
      } else {
        failedSummaryAt = currentPressure;
      }
      return result.usage === undefined
        ? { actions }
        : { usage: result.usage, actions };
    },
  };
}
