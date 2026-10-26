import type { Message } from "../llm/types.js";
import type { Estimator } from "./tokens.js";

export type PruneOptions = {
  maxTokens: number;
  headTokens: number;
  tailTokens: number;
  estimate: Estimator;
};

function longestPrefix(
  chars: string[],
  limit: number,
  estimate: Estimator,
): number {
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimate(chars.slice(0, mid).join("")) <= limit) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

function longestSuffix(
  chars: string[],
  limit: number,
  estimate: Estimator,
): number {
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimate(chars.slice(chars.length - mid).join("")) <= limit) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

export function pruneText(text: string, o: PruneOptions): string | null {
  if (o.estimate(text) <= o.maxTokens) {
    return null;
  }
  if (!(o.headTokens + o.tailTokens + 20 < o.maxTokens)) {
    throw new Error(
      "prune budget is too small: maxTokens must be greater than headTokens + tailTokens + 20",
    );
  }

  const chars = Array.from(text);
  const headEnd = longestPrefix(chars, o.headTokens, o.estimate);
  const tailLength = longestSuffix(chars, o.tailTokens, o.estimate);
  const tailStart = Math.max(headEnd, chars.length - tailLength);
  const removed = chars.slice(headEnd, tailStart);
  const lines = removed.filter((ch) => ch === "\n").length + 1;

  return `${chars.slice(0, headEnd).join("")}\n[... ${lines} lines pruned ...]\n${chars.slice(tailStart).join("")}`;
}

export function pruneToolResults(
  messages: Message[],
  o: PruneOptions,
): { messages: Message[]; pruned: number; savedTokens: number } {
  let lastAssistant = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i].role === "assistant") {
      lastAssistant = i;
    }
  }

  let pruned = 0;
  let savedTokens = 0;
  const next = messages.map((message, index) => {
    if (index >= lastAssistant || message.role !== "tool") {
      return message;
    }
    const content = pruneText(message.content, o);
    if (content === null) {
      return message;
    }
    pruned += 1;
    savedTokens += o.estimate(message.content) - o.estimate(content);
    return { ...message, content };
  });

  return { messages: next, pruned, savedTokens };
}
