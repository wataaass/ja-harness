import type { Complete } from "../agent/loop.js";
import type { Message, ToolSpec, Usage } from "../llm/types.js";
import {
  applyMask,
  belowThresholdCandidates,
  type MaskCandidate,
  maskCandidates,
} from "./mask.js";
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
  mask: {
    window: number;
    minTokens: number;
    maxCallsAhead: number;
    margin: number;
    rereadStale: number;
    rereadPrevious: number;
  };
  cacheTtlSeconds: number;
  maskBelowThreshold?: boolean;
  overflowRetries: number;
  mode: "price" | "always";
  prices?: { input: number; cachedInput: number; cacheWrite?: number };
  minCallsAhead: number;
};

export const DEFAULT_CONTEXT: Omit<ContextConfig, "contextWindow"> = {
  summaryMaxTokens: 64000,
  summaryMaxRatio: 0.5,
  targetRatio: 0.7,
  keepRecentTokens: 20000,
  prune: { maxTokens: 4000, headTokens: 2000, tailTokens: 500 },
  mask: {
    window: 5,
    minTokens: 300,
    maxCallsAhead: 10,
    margin: 2,
    rereadStale: 0.1,
    rereadPrevious: 0.4,
  },
  cacheTtlSeconds: 300,
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
  action: "prune" | "summary" | "mask";
  savedTokens: number;
};

export type StepPrep = { usage?: Usage; actions: ContextAction[] };

export function createContextManager(o: {
  config: ContextConfig;
  complete: Complete;
  estimate: Estimator;
  now?: () => number;
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
  const now = o.now ?? Date.now;
  const threshold = summaryThreshold(config);
  const target = Math.floor(threshold * config.targetRatio);
  const retryGrowth = Math.max(4000, Math.floor(threshold * 0.1));
  let calls = 0;
  let failedSummaryAt: number | undefined;
  let lastRequestAt: number | undefined;

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

  function candidates(messages: Message[]): number[] {
    return maskCandidates(messages, {
      window: config.mask.window,
      minTokens: config.mask.minTokens,
      estimate,
    });
  }

  function belowCandidates(messages: Message[]): MaskCandidate[] {
    return belowThresholdCandidates(messages, {
      minTokens: config.mask.minTokens,
      estimate,
    });
  }

  function rereadCost(
    messages: Message[],
    chosen: MaskCandidate[],
    prices: { input: number; cachedInput: number },
  ): number {
    const contextTokens = estimateMessages(messages, estimate);
    let total = 0;
    for (const candidate of chosen) {
      const message = messages[candidate.index];
      if (message === undefined || message.role !== "tool") {
        continue;
      }
      const probability =
        candidate.kind === "stale"
          ? (config.mask.rereadStale ?? 0.1)
          : (config.mask.rereadPrevious ?? 0.3);
      const resultTokens = estimate(message.content);
      total +=
        probability *
        (contextTokens * prices.cachedInput + resultTokens * prices.input);
    }
    return total;
  }

  function applyMasked(
    messages: Message[],
    positions: number[],
    actions: ContextAction[],
  ): number {
    const result = applyMask(messages, positions, estimate);
    if (result.firstIndex === -1) {
      return 0;
    }
    messages.splice(0, messages.length, ...result.messages);
    actions.push({ action: "mask", savedTokens: result.savedTokens });
    return result.savedTokens;
  }

  function maskAll(messages: Message[], actions: ContextAction[]): number {
    const positions = candidates(messages);
    if (positions.length === 0) {
      return 0;
    }
    return applyMasked(messages, positions, actions);
  }

  function maskOutsideWindow(
    messages: Message[],
    actions: ContextAction[],
  ): number {
    const positions = maskCandidates(messages, {
      window: config.mask.window,
      minTokens: 0,
      estimate,
    });
    if (positions.length === 0) {
      return 0;
    }
    return applyMasked(messages, positions, actions);
  }

  function maskUntilTarget(
    messages: Message[],
    actions: ContextAction[],
    target: number,
    reportedTokens: number | undefined,
  ): number {
    const positions = maskCandidates(messages, {
      window: 0,
      minTokens: 0,
      estimate,
    });
    const chosen: number[] = [];
    let working = messages;
    let saved = 0;
    for (const position of positions) {
      const step = applyMask(working, [position], estimate);
      if (step.firstIndex === -1) {
        continue;
      }
      chosen.push(position);
      working = step.messages;
      saved += step.savedTokens;
      const adjusted =
        reportedTokens === undefined
          ? undefined
          : Math.max(0, reportedTokens - saved);
      if (pressure(working, adjusted) <= target) {
        break;
      }
    }
    if (chosen.length === 0) {
      return 0;
    }
    const result = applyMask(messages, chosen, estimate);
    messages.splice(0, messages.length, ...result.messages);
    actions.push({ action: "mask", savedTokens: result.savedTokens });
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
      const finish = (usage?: Usage): StepPrep => {
        lastRequestAt = now();
        return usage === undefined ? { actions } : { usage, actions };
      };

      let currentPressure = pressure(messages, reportedTokens);
      if (currentPressure <= threshold) {
        if (config.maskBelowThreshold === false) {
          return finish();
        }
        const below = belowCandidates(messages);
        if (below.length === 0) {
          return finish();
        }
        const positions = below.map((candidate) => candidate.index);
        if (config.mode === "always") {
          applyMasked(messages, positions, actions);
          return finish();
        }
        const prices = config.prices;
        if (prices === undefined) {
          return finish();
        }
        const cold =
          lastRequestAt !== undefined &&
          now() - lastRequestAt > config.cacheTtlSeconds * 1000;
        const result = applyMask(messages, positions, estimate);
        const rewrittenTokens = cold
          ? 0
          : estimateMessages(
              result.messages.slice(result.firstIndex),
              estimate,
            );
        const callsAhead = Math.min(
          config.mask.maxCallsAhead ?? Infinity,
          Math.max(config.minCallsAhead, calls),
        );
        if (
          rewritePays({
            rewrittenTokens,
            savedTokens: result.savedTokens,
            callsAhead,
            prices,
            margin: config.mask.margin ?? 1,
            rereadCost: rereadCost(messages, below, prices),
          })
        ) {
          messages.splice(0, messages.length, ...result.messages);
          actions.push({ action: "mask", savedTokens: result.savedTokens });
        }
        return finish();
      }

      const maskedSaved = maskOutsideWindow(messages, actions);
      let adjustedReported =
        reportedTokens === undefined
          ? undefined
          : Math.max(0, reportedTokens - maskedSaved);
      currentPressure = pressure(messages, adjustedReported);
      if (currentPressure <= target) {
        return finish();
      }

      const maskedInside = maskUntilTarget(
        messages,
        actions,
        target,
        adjustedReported,
      );
      if (maskedInside > 0) {
        adjustedReported =
          adjustedReported === undefined
            ? undefined
            : Math.max(0, adjustedReported - maskedInside);
        currentPressure = pressure(messages, adjustedReported);
      }
      if (currentPressure <= target) {
        return finish();
      }

      const pruned = pruneToolResults(messages, pruneOptions());
      const prunedPressure = Math.max(
        estimateMessages(pruned.messages, estimate),
        (adjustedReported ?? 0) - pruned.savedTokens,
      );
      if (prunedPressure <= target) {
        applyPrune(messages, pruned, actions);
        return finish();
      }

      if (
        failedSummaryAt !== undefined &&
        currentPressure - failedSummaryAt < retryGrowth
      ) {
        applyPrune(messages, pruned, actions);
        return finish();
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
      return finish(result.usage);
    },

    async onOverflow(messages, tools, signal) {
      const actions: ContextAction[] = [];
      maskAll(messages, actions);
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
      maskAll(messages, actions);
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
