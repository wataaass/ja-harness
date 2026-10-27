import type { Completion, Message, ToolSpec, Usage } from "./types.js";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function toWire(messages: Message[]): unknown[] {
  return messages.map((message) => {
    switch (message.role) {
      case "system":
      case "user":
        return { role: message.role, content: message.content };
      case "assistant": {
        const wire: Record<string, unknown> = {
          role: "assistant",
          content: message.content,
        };
        if (message.reasoning !== undefined) {
          wire.reasoning_content = message.reasoning;
        }
        if (message.toolCalls !== undefined) {
          wire.tool_calls = message.toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: call.arguments },
          }));
        }
        return wire;
      }
      case "tool":
        return {
          role: "tool",
          tool_call_id: message.toolCallId,
          content: message.content,
        };
      default:
        throw new Error("未知の role です");
    }
  });
}

export function parseUsage(u: unknown): Usage {
  const usage = asRecord(u);
  const promptDetails = asRecord(usage.prompt_tokens_details);
  const completionDetails = asRecord(usage.completion_tokens_details);
  const opencode = asRecord(usage.opencode);

  const cachedInput =
    typeof promptDetails.cached_tokens === "number"
      ? promptDetails.cached_tokens
      : numberOrZero(usage.prompt_cache_hit_tokens);

  const result: Usage = {
    input: numberOrZero(usage.prompt_tokens),
    cachedInput,
    output: numberOrZero(usage.completion_tokens),
    reasoning: numberOrZero(completionDetails.reasoning_tokens),
  };
  if (typeof opencode.list_cost === "number") {
    result.cost = opencode.list_cost;
  }
  return result;
}

type SseLine = { done: true } | { done: false; data: unknown };

function parseSseLine(line: string): SseLine | null {
  if (line === "" || line.startsWith(":")) {
    return null;
  }
  if (!line.startsWith("data:")) {
    return null;
  }
  const data = line.slice(5).trimStart();
  if (data === "") {
    return null;
  }
  if (data === "[DONE]") {
    return { done: true };
  }
  return { done: false, data: JSON.parse(data) };
}

export async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        const parsed = parseSseLine(line);
        if (parsed !== null) {
          if (parsed.done) {
            return;
          }
          yield parsed.data;
        }
        newline = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      const parsed = parseSseLine(buffer.replace(/\r$/, ""));
      if (parsed !== null && !parsed.done) {
        yield parsed.data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export type ClientOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  maxTokens?: number;
  reasoningEffort?: string;
};

type CompleteCallback = {
  onText?: (s: string) => void;
  onReasoning?: (s: string) => void;
  signal?: AbortSignal;
};

type ToolCallAccumulator = {
  id: string;
  name: string;
  arguments: string;
};

export function createClient(opts: ClientOptions) {
  const doFetch = opts.fetch ?? fetch;

  async function complete(
    messages: Message[],
    tools: ToolSpec[],
    cb: CompleteCallback = {},
  ): Promise<Completion> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: toWire(messages),
    };
    if (tools.length > 0) {
      body.tools = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }
    if (opts.maxTokens !== undefined) {
      body.max_tokens = opts.maxTokens;
    }
    if (opts.reasoningEffort !== undefined) {
      body.reasoning_effort = opts.reasoningEffort;
    }
    body.stream = true;
    body.stream_options = { include_usage: true };

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (opts.apiKey) {
      headers.authorization = `Bearer ${opts.apiKey}`;
    }
    Object.assign(headers, opts.headers);

    const response = await doFetch(`${opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: cb.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    if (response.body === null) {
      throw new Error("応答の本文がありません");
    }

    let content = "";
    let reasoning = "";
    let finishReason = "";
    let usage: Usage = { input: 0, cachedInput: 0, output: 0, reasoning: 0 };
    const toolCalls = new Map<number, ToolCallAccumulator>();

    for await (const chunk of readSse(response.body)) {
      const data = asRecord(chunk);
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const choice = asRecord(choices[0]);
      const delta = asRecord(choice.delta);

      if (typeof delta.content === "string") {
        content += delta.content;
        cb.onText?.(delta.content);
      }
      if (typeof delta.reasoning_content === "string") {
        reasoning += delta.reasoning_content;
        cb.onReasoning?.(delta.reasoning_content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const raw of delta.tool_calls) {
          const call = asRecord(raw);
          const index = typeof call.index === "number" ? call.index : 0;
          const acc = toolCalls.get(index) ?? {
            id: "",
            name: "",
            arguments: "",
          };
          if (typeof call.id === "string") {
            acc.id = call.id;
          }
          const fn = asRecord(call.function);
          if (typeof fn.name === "string") {
            acc.name = fn.name;
          }
          if (typeof fn.arguments === "string") {
            acc.arguments += fn.arguments;
          }
          toolCalls.set(index, acc);
        }
      }
      if (typeof choice.finish_reason === "string") {
        finishReason = choice.finish_reason;
      }
      if (data.usage !== null && data.usage !== undefined) {
        usage = parseUsage(data.usage);
      }
    }

    const message: Completion["message"] = { role: "assistant", content };
    if (reasoning !== "") {
      message.reasoning = reasoning;
    }
    if (toolCalls.size > 0) {
      message.toolCalls = [...toolCalls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, acc]) => ({
          id: acc.id,
          name: acc.name,
          arguments: acc.arguments,
        }));
    }

    return { message, usage, finishReason };
  }

  return { complete };
}
