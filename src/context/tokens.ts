import type { Message } from "../llm/types.js";

export type Estimator = (text: string) => number;

export function createEstimator(nonAsciiTokensPerChar = 0.7): Estimator {
  return (text) => {
    let ascii = 0;
    let nonAscii = 0;
    for (const ch of text) {
      if ((ch.codePointAt(0) ?? 0) <= 0x7f) {
        ascii += 1;
      } else {
        nonAscii += 1;
      }
    }
    return Math.ceil(ascii / 4 + nonAscii * nonAsciiTokensPerChar);
  };
}

export function estimateMessages(
  messages: Message[],
  estimate: Estimator,
): number {
  let total = 0;
  for (const message of messages) {
    total += 4 + estimate(message.content);
    if (message.role === "assistant") {
      if (message.reasoning !== undefined) {
        total += estimate(message.reasoning);
      }
      for (const call of message.toolCalls ?? []) {
        total += estimate(call.name) + estimate(call.arguments);
      }
    }
  }
  return total;
}
