import type { Complete } from "../agent/loop.js";
import type { Message, ToolSpec, Usage } from "../llm/types.js";
import type { Estimator } from "./tokens.js";
import { estimateMessages } from "./tokens.js";

export const SUMMARY_INSTRUCTION = `Stop the task for a moment and write a checkpoint of the conversation above, so that the work can continue from it alone.
Use exactly these headings, in this order, with short bullet points under each. Write "None" under a heading with nothing to report; never drop a heading.
## User requests
## Files and changes
## Errors and fixes
## Remaining work
## Current work
## Next step
## Decisions and constraints
Keep file paths, commands, error messages, identifiers and numbers exactly as they are. Record the user's corrections and instructions faithfully.
If the conversation already contains an earlier checkpoint, merge it into this one: keep what is still true and drop what is outdated. Do not copy it as is.
Output only the checkpoint. Do not call tools.`;

export const SUMMARY_PREFIX =
  "This is a checkpoint that replaces the earlier part of the conversation. Treat it as background, do not repeat it, and continue the work from the messages that follow.";

export type Range = { start: number; end: number };

export function selectRange(
  messages: Message[],
  keepRecentTokens: number,
  estimate: Estimator,
): Range | null {
  if (messages.length === 0) {
    return null;
  }

  const start = messages[0].role === "system" ? 1 : 0;

  let end = messages.length - 1;
  let kept = estimateMessages([messages[end]], estimate);
  while (end > start && kept < keepRecentTokens) {
    end -= 1;
    kept += estimateMessages([messages[end]], estimate);
  }

  while (end > start && messages[end].role === "tool") {
    end -= 1;
  }

  if (end - start < 2) {
    return null;
  }

  return { start, end };
}

export function buildSummaryRequest(
  messages: Message[],
  range: Range,
): Message[] {
  return [
    ...messages.slice(0, range.end),
    { role: "user", content: SUMMARY_INSTRUCTION },
  ];
}

export function applySummary(
  messages: Message[],
  range: Range,
  summary: string,
): Message[] {
  return [
    ...messages.slice(0, range.start),
    {
      role: "user",
      content: `${SUMMARY_PREFIX}\n\n<checkpoint>\n${summary}\n</checkpoint>`,
    },
    ...messages.slice(range.end),
  ];
}

export async function summarize(o: {
  complete: Complete;
  messages: Message[];
  tools: ToolSpec[];
  keepRecentTokens: number;
  estimate: Estimator;
  signal?: AbortSignal;
}): Promise<{ messages: Message[] | null; usage?: Usage }> {
  const range = selectRange(o.messages, o.keepRecentTokens, o.estimate);
  if (range === null) {
    return { messages: null };
  }

  const completion = await o.complete(
    buildSummaryRequest(o.messages, range),
    o.tools,
    { signal: o.signal },
  );

  const summary = completion.message.content.trim();
  if (summary === "") {
    return { messages: null, usage: completion.usage };
  }

  const before = estimateMessages(
    o.messages.slice(range.start, range.end),
    o.estimate,
  );
  if (o.estimate(summary) >= before) {
    return { messages: null, usage: completion.usage };
  }

  return {
    messages: applySummary(o.messages, range, summary),
    usage: completion.usage,
  };
}
