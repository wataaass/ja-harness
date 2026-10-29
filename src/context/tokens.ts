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

export function lastUserIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      return i;
    }
  }
  return -1;
}

export function estimateMessages(
  messages: Message[],
  estimate: Estimator,
): number {
  const lastUser = lastUserIndex(messages);
  let total = 0;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    total += 4 + estimate(message.content);
    if (message.role === "assistant") {
      if (message.reasoning !== undefined && index > lastUser) {
        total += estimate(message.reasoning);
      }
      for (const call of message.toolCalls ?? []) {
        total += estimate(call.name) + estimate(call.arguments);
      }
    }
  }
  return total;
}
