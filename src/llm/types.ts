export type ToolCall = { id: string; name: string; arguments: string };

export type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      reasoning?: string;
      toolCalls?: ToolCall[];
    }
  | { role: "tool"; toolCallId: string; content: string };

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type Usage = {
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
  cost?: number;
};

export type Completion = {
  message: Extract<Message, { role: "assistant" }>;
  usage: Usage;
  finishReason: string;
};
