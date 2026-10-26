import type { Message } from "../llm/types.js";

export function notice(text: string): Message {
  return {
    role: "user",
    content: `<harness-notice>\n${text}\n</harness-notice>`,
  };
}
