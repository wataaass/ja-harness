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

export const MAX_RETRIES = 4;
const MAX_WAIT_MS = 60_000;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const NETWORK_ERROR_PATTERN =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|EAI_AGAIN|UND_ERR_|socket hang up|fetch failed|timeout|timed out/i;
const BODY_WAIT_PATTERN = /after\s*(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?\b/i;

export type OnRetry = (attempt: number, waitMs: number, reason: string) => void;

type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export type ClientOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  sleep?: Sleep;
  onRetry?: OnRetry;
  maxTokens?: number;
  reasoningEffort?: string;
};

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

type Failure = {
  error: unknown;
  status?: number;
  retryAfter: string | null;
  body: string;
};

type Attempt = { response: Response } | { failure: Failure };

async function attemptFetch(
  doFetch: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Attempt> {
  let response: Response;
  let text: string;
  try {
    response = await doFetch(url, init);
    if (response.ok) {
      return { response };
    }
    text = await response.text();
  } catch (error) {
    return { failure: { error, retryAfter: null, body: "" } };
  }
  return {
    failure: {
      error: new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`),
      status: response.status,
      retryAfter: response.headers.get("retry-after"),
      body: text,
    },
  };
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error && error.name === "TimeoutError") {
    return true;
  }
  const record = asRecord(error);
  const cause = asRecord(record.cause);
  const text = [record.message, record.code, cause.message, cause.code]
    .filter((item) => typeof item === "string")
    .join(" ");
  return NETWORK_ERROR_PATTERN.test(text);
}

function isRetryable(failure: Failure): boolean {
  return failure.status === undefined
    ? isNetworkError(failure.error)
    : RETRY_STATUSES.has(failure.status);
}

function retryAfterMs(value: string | null, now: number): number | undefined {
  if (value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function bodyWaitMs(text: string): number | undefined {
  const match = BODY_WAIT_PATTERN.exec(text);
  return match?.[1] === undefined ? undefined : Number(match[1]) * 1000;
}

function retryWaitMs(failure: Failure, retries: number): number {
  const fromHeader = retryAfterMs(failure.retryAfter, Date.now());
  const fromBody = bodyWaitMs(failure.body);
  const backoff = 2 ** (retries + 1) * 1000;
  return Math.min(fromHeader ?? fromBody ?? backoff, MAX_WAIT_MS);
}

function failureReason(failure: Failure): string {
  if (failure.status !== undefined) {
    return `HTTP ${failure.status}`;
  }
  return failure.error instanceof Error
    ? failure.error.message
    : String(failure.error);
}

type FetchWithRetry = {
  doFetch: typeof fetch;
  url: string;
  init: RequestInit;
  signal?: AbortSignal;
  sleep: Sleep;
  onRetry?: OnRetry;
};

// レスポンスの本文を読み始める前の失敗だけを送り直す。
async function fetchWithRetry(o: FetchWithRetry): Promise<Response> {
  for (let retries = 0; ; retries += 1) {
    const attempt = await attemptFetch(o.doFetch, o.url, o.init);
    if ("response" in attempt) {
      return attempt.response;
    }
    const { failure } = attempt;
    if (
      retries >= MAX_RETRIES ||
      o.signal?.aborted === true ||
      !isRetryable(failure)
    ) {
      throw failure.error;
    }
    const waitMs = retryWaitMs(failure, retries);
    o.onRetry?.(retries + 1, waitMs, failureReason(failure));
    await o.sleep(waitMs, o.signal);
    o.signal?.throwIfAborted();
  }
}

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
  const sleep = opts.sleep ?? defaultSleep;

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

    const response = await fetchWithRetry({
      doFetch,
      url: `${opts.baseUrl}/chat/completions`,
      init: {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: cb.signal,
      },
      signal: cb.signal,
      sleep,
      ...(opts.onRetry === undefined ? {} : { onRetry: opts.onRetry }),
    });

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
