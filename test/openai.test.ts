import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ClientOptions,
  createClient,
  parseUsage,
  readSse,
  toWire,
} from "../src/llm/openai.js";
import type { Message, ToolSpec } from "../src/llm/types.js";

const encoder = new TextEncoder();

function responseFromChunks(chunks: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  );
}

function responseFromBytes(chunks: Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    }),
  );
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

function mockFetch(response: Response): {
  fetch: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchMock = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ input, init });
    return response;
  }) as unknown as typeof fetch;
  return { fetch: fetchMock, calls };
}

async function collect(body: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const items: unknown[] = [];
  for await (const item of readSse(body)) {
    items.push(item);
  }
  return items;
}

describe("toWire", () => {
  it("system と user を変換する", () => {
    const messages: Message[] = [
      { role: "system", content: "指示" },
      { role: "user", content: "質問" },
    ];
    expect(toWire(messages)).toEqual([
      { role: "system", content: "指示" },
      { role: "user", content: "質問" },
    ]);
  });

  it("assistant を reasoning と toolCalls なしで変換する", () => {
    expect(
      JSON.stringify(toWire([{ role: "assistant", content: "答え" }])),
    ).toBe('[{"role":"assistant","content":"答え"}]');
  });

  it("assistant の reasoning と toolCalls を順番どおりに変換する", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: "",
        reasoning: "考える",
        toolCalls: [{ id: "call_1", name: "read", arguments: '{"path":"a"}' }],
      },
    ];
    expect(JSON.stringify(toWire(messages))).toBe(
      '[{"role":"assistant","content":"","reasoning_content":"考える","tool_calls":[{"id":"call_1","type":"function","function":{"name":"read","arguments":"{\\"path\\":\\"a\\"}"}}]}]',
    );
  });

  it("tool を変換する", () => {
    expect(
      JSON.stringify(
        toWire([{ role: "tool", toolCallId: "call_1", content: "結果" }]),
      ),
    ).toBe('[{"role":"tool","tool_call_id":"call_1","content":"結果"}]');
  });

  it("undefined のキーを入れない", () => {
    const wire = toWire([
      {
        role: "assistant",
        content: "x",
        reasoning: undefined,
        toolCalls: undefined,
      },
    ]);
    expect(JSON.stringify(wire)).toBe('[{"role":"assistant","content":"x"}]');
  });
});

describe("parseUsage", () => {
  it("OpenAI 形式を読む", () => {
    expect(
      parseUsage({
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 40 },
        completion_tokens_details: { reasoning_tokens: 5 },
      }),
    ).toEqual({ input: 100, cachedInput: 40, output: 20, reasoning: 5 });
  });

  it("DeepSeek 形式を読む", () => {
    expect(
      parseUsage({
        prompt_tokens: 50,
        prompt_cache_hit_tokens: 30,
        completion_tokens: 10,
      }),
    ).toEqual({ input: 50, cachedInput: 30, output: 10, reasoning: 0 });
  });

  it("opencode.list_cost を読む", () => {
    expect(
      parseUsage({
        prompt_tokens: 1,
        completion_tokens: 2,
        opencode: { list_cost: 0.0012 },
      }),
    ).toEqual({
      input: 1,
      cachedInput: 0,
      output: 2,
      reasoning: 0,
      cost: 0.0012,
    });
  });

  it("欠けた値や数でない値は 0 にする", () => {
    expect(parseUsage({ prompt_tokens: "100" })).toEqual({
      input: 0,
      cachedInput: 0,
      output: 0,
      reasoning: 0,
    });
    expect(parseUsage(null)).toEqual({
      input: 0,
      cachedInput: 0,
      output: 0,
      reasoning: 0,
    });
  });
});

describe("readSse", () => {
  it("行がチャンクの途中で切れても読む", async () => {
    const response = responseFromChunks([
      'data: {"a"',
      ":1}\n\n",
      ": コメント\n\ndata: ",
      '{"b":2}\n\n',
      "data: [DONE]\n\n",
    ]);
    const body = response.body as ReadableStream<Uint8Array>;
    expect(await collect(body)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("日本語のバイト列がチャンクの途中で切れても壊さない", async () => {
    const bytes = encoder.encode(
      `data: ${JSON.stringify({ text: "こんにちは" })}\n\n`,
    );
    const chunks = Array.from(bytes, (byte) => Uint8Array.of(byte));
    const response = responseFromBytes(chunks);
    const body = response.body as ReadableStream<Uint8Array>;
    expect(await collect(body)).toEqual([{ text: "こんにちは" }]);
  });

  it("[DONE] 以降を読まない", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1;
          if (pulls === 1) {
            controller.enqueue(
              encoder.encode('data: {"a":1}\n\ndata: [DONE]\n\n'),
            );
          } else {
            controller.enqueue(encoder.encode('data: {"b":2}\n\n'));
          }
        },
      },
      { highWaterMark: 0 },
    );
    expect(await collect(body)).toEqual([{ a: 1 }]);
    expect(pulls).toBe(1);
  });
});

describe("complete", () => {
  const tools: ToolSpec[] = [
    {
      name: "read",
      description: "ファイルを読む",
      parameters: { type: "object", properties: {} },
    },
  ];

  it("content と reasoning_content を集める", async () => {
    const response = responseFromChunks([
      sse({
        choices: [{ delta: { reasoning_content: "考" }, finish_reason: null }],
      }),
      sse({ choices: [{ delta: { reasoning_content: "える" } }] }),
      sse({ choices: [{ delta: { content: "こん" } }] }),
      sse({ choices: [{ delta: { content: "にちは" } }] }),
      sse({ choices: [{ delta: {}, finish_reason: "stop" }] }),
      "data: [DONE]\n\n",
    ]);
    const { fetch, calls } = mockFetch(response);
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch,
    });

    const texts: string[] = [];
    const reasonings: string[] = [];
    const completion = await client.complete([], [], {
      onText: (s) => texts.push(s),
      onReasoning: (s) => reasonings.push(s),
    });

    expect(completion.message).toEqual({
      role: "assistant",
      content: "こんにちは",
      reasoning: "考える",
    });
    expect(texts).toEqual(["こん", "にちは"]);
    expect(reasonings).toEqual(["考", "える"]);
    expect(completion.finishReason).toBe("stop");
    expect(calls).toHaveLength(1);
  });

  it("tool_calls を index ごとに組み立てる", async () => {
    const response = responseFromChunks([
      sse({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  type: "function",
                  function: { name: "read", arguments: '{"pa' },
                },
              ],
            },
          },
        ],
      }),
      sse({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 1,
                  id: "call_2",
                  type: "function",
                  function: { name: "write", arguments: '{"x"' },
                },
              ],
            },
          },
        ],
      }),
      sse({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, function: { arguments: 'th":"a"}' } }],
            },
          },
        ],
      }),
      sse({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 1, function: { arguments: ":1}" } }],
            },
          },
        ],
      }),
      sse({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }),
      "data: [DONE]\n\n",
    ]);
    const { fetch } = mockFetch(response);
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch,
    });

    const completion = await client.complete([], tools);

    expect(completion.message.toolCalls).toEqual([
      { id: "call_1", name: "read", arguments: '{"path":"a"}' },
      { id: "call_2", name: "write", arguments: '{"x":1}' },
    ]);
    expect(completion.finishReason).toBe("tool_calls");
  });

  it("最後のチャンクの usage を読む", async () => {
    const response = responseFromChunks([
      sse({ choices: [{ delta: { content: "ok" } }] }),
      sse({
        choices: [],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 3,
          prompt_tokens_details: { cached_tokens: 7 },
          completion_tokens_details: { reasoning_tokens: 1 },
          opencode: { list_cost: 0.0004 },
        },
      }),
      "data: [DONE]\n\n",
    ]);
    const { fetch } = mockFetch(response);
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch,
    });

    const completion = await client.complete([], []);
    expect(completion.usage).toEqual({
      input: 12,
      cachedInput: 7,
      output: 3,
      reasoning: 1,
      cost: 0.0004,
    });
  });

  it("usage がなければすべて 0 にする", async () => {
    const response = responseFromChunks([
      sse({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }),
      "data: [DONE]\n\n",
    ]);
    const { fetch } = mockFetch(response);
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch,
    });

    expect((await client.complete([], [])).usage).toEqual({
      input: 0,
      cachedInput: 0,
      output: 0,
      reasoning: 0,
    });
  });

  it("本文のキーの順番を守り、tools がなければキーを入れない", async () => {
    const { fetch, calls } = mockFetch(
      responseFromChunks([
        sse({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }),
        "data: [DONE]\n\n",
      ]),
    );
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      maxTokens: 100,
      fetch,
    });

    await client.complete([{ role: "user", content: "hi" }], tools);

    const body = JSON.parse(calls[0].init?.body as string) as Record<
      string,
      unknown
    >;
    expect(Object.keys(body)).toEqual([
      "model",
      "messages",
      "tools",
      "max_tokens",
      "stream",
      "stream_options",
    ]);
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "read",
          description: "ファイルを読む",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
  });

  it("tools も max_tokens もなければキーを入れない", async () => {
    const { fetch, calls } = mockFetch(
      responseFromChunks([
        sse({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        "data: [DONE]\n\n",
      ]),
    );
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch,
    });

    await client.complete([{ role: "user", content: "hi" }], []);

    const body = JSON.parse(calls[0].init?.body as string) as Record<
      string,
      unknown
    >;
    expect(Object.keys(body)).toEqual([
      "model",
      "messages",
      "stream",
      "stream_options",
    ]);
  });

  it("reasoningEffort があれば reasoning_effort を入れる", async () => {
    const { fetch, calls } = mockFetch(
      responseFromChunks([
        sse({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        "data: [DONE]\n\n",
      ]),
    );
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      reasoningEffort: "low",
      fetch,
    });

    await client.complete([{ role: "user", content: "hi" }], []);

    const body = JSON.parse(calls[0].init?.body as string) as Record<
      string,
      unknown
    >;
    expect(body.reasoning_effort).toBe("low");
  });

  it("ヘッダーを送る", async () => {
    const { fetch, calls } = mockFetch(
      responseFromChunks([
        sse({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        "data: [DONE]\n\n",
      ]),
    );
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      apiKey: "secret",
      headers: { "x-test": "1" },
      fetch,
    });

    await client.complete([], []);

    expect(calls[0].input).toBe("https://example.test/v1/chat/completions");
    expect(calls[0].init?.method).toBe("POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.authorization).toBe("Bearer secret");
    expect(headers["x-test"]).toBe("1");
  });

  it("2xx でないときは本文の先頭 500 文字を添えて投げる", async () => {
    const { fetch } = mockFetch(new Response("x".repeat(600), { status: 400 }));
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch,
    });

    await expect(client.complete([], [])).rejects.toMatchObject({
      message: `HTTP 400: ${"x".repeat(500)}`,
    });
  });
});

describe("再試行", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function okResponse(): Response {
    return responseFromChunks([
      sse({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }),
      "data: [DONE]\n\n",
    ]);
  }

  function status(
    code: number,
    body = "",
    headers: Record<string, string> = {},
  ): Response {
    return new Response(body, { status: code, headers });
  }

  function fetchSteps(steps: (Response | Error)[]): {
    fetch: typeof fetch;
    calls: FetchCall[];
  } {
    const calls: FetchCall[] = [];
    const fetchMock = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ input, init });
      const step = steps[calls.length - 1];
      if (step === undefined) {
        throw new Error("想定より多く送っています");
      }
      if (step instanceof Error) {
        throw step;
      }
      return step;
    }) as unknown as typeof fetch;
    return { fetch: fetchMock, calls };
  }

  function recordSleep(): {
    sleep: (ms: number) => Promise<void>;
    waits: number[];
  } {
    const waits: number[] = [];
    return {
      sleep: async (ms: number) => {
        waits.push(ms);
      },
      waits,
    };
  }

  function makeClient(
    options: Pick<ClientOptions, "fetch" | "sleep" | "onRetry">,
  ) {
    return createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      ...options,
    });
  }

  it("Retry-After の秒数を待ってから送り直す", async () => {
    const { fetch, calls } = fetchSteps([
      status(429, "", { "retry-after": "7" }),
      okResponse(),
    ]);
    const { sleep, waits } = recordSleep();

    const completion = await makeClient({ fetch, sleep }).complete([], []);

    expect(completion.message.content).toBe("ok");
    expect(waits).toEqual([7000]);
    expect(calls).toHaveLength(2);
  });

  it("Retry-After の日付を待つ", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T00:00:00Z"));
    const date = new Date("2026-10-29T00:00:20Z").toUTCString();
    const { fetch } = fetchSteps([
      status(503, "", { "retry-after": date }),
      okResponse(),
    ]);
    const { sleep, waits } = recordSleep();

    await makeClient({ fetch, sleep }).complete([], []);

    expect(waits).toEqual([20000]);
  });

  it("本文の「after N s」「after Ns」を待つ", async () => {
    const { fetch, calls } = fetchSteps([
      status(
        429,
        JSON.stringify({
          error: { message: "混んでいます。retry shortly (after 24 s)" },
        }),
      ),
      status(429, "rate limited, after 9s"),
      okResponse(),
    ]);
    const { sleep, waits } = recordSleep();

    await makeClient({ fetch, sleep }).complete([], []);

    expect(waits).toEqual([24000, 9000]);
    expect(calls).toHaveLength(3);
  });

  it("ヘッダーも本文の指定もなければ 2, 4, 8, 16 秒待つ", async () => {
    const { fetch, calls } = fetchSteps([
      status(500),
      status(502),
      status(503),
      status(504),
      okResponse(),
    ]);
    const { sleep, waits } = recordSleep();

    await makeClient({ fetch, sleep }).complete([], []);

    expect(waits).toEqual([2000, 4000, 8000, 16000]);
    expect(calls).toHaveLength(5);
  });

  it("待ち時間は 60 秒で打ち切る", async () => {
    const { fetch } = fetchSteps([
      status(429, "", { "retry-after": "300" }),
      status(429, "after 120 s"),
      okResponse(),
    ]);
    const { sleep, waits } = recordSleep();

    await makeClient({ fetch, sleep }).complete([], []);

    expect(waits).toEqual([60000, 60000]);
  });

  it("4 回送り直しても駄目なら最後のエラーを投げる", async () => {
    const { fetch, calls } = fetchSteps(
      Array.from({ length: 5 }, () => status(503, "混んでいます")),
    );
    const { sleep, waits } = recordSleep();
    const onRetry = vi.fn();

    await expect(
      makeClient({ fetch, sleep, onRetry }).complete([], []),
    ).rejects.toMatchObject({ message: "HTTP 503: 混んでいます" });

    expect(calls).toHaveLength(5);
    expect(waits).toHaveLength(4);
    expect(onRetry).toHaveBeenCalledTimes(4);
  });

  it("送り直す前の待ちは中断されたらすぐ投げる", async () => {
    const controller = new AbortController();
    const { fetch, calls } = fetchSteps([
      status(429, "", { "retry-after": "10" }),
      okResponse(),
    ]);
    const client = makeClient({
      fetch,
      sleep: async () => {
        controller.abort();
      },
    });

    const error = await client
      .complete([], [], { signal: controller.signal })
      .catch((e: unknown) => e);

    expect((error as Error).name).toBe("AbortError");
    expect(calls).toHaveLength(1);
  });

  it("標準の待ちも中断されたらすぐ止まる", async () => {
    const controller = new AbortController();
    const { fetch, calls } = fetchSteps([
      status(429, "", { "retry-after": "60" }),
      okResponse(),
    ]);
    const client = makeClient({
      fetch,
      onRetry: () => controller.abort(),
    });

    const error = await client
      .complete([], [], { signal: controller.signal })
      .catch((e: unknown) => e);

    expect((error as Error).name).toBe("AbortError");
    expect(calls).toHaveLength(1);
  });

  it("400 は送り直さずそのまま投げる", async () => {
    const { fetch, calls } = fetchSteps([status(400, "bad request")]);
    const { sleep, waits } = recordSleep();
    const onRetry = vi.fn();

    await expect(
      makeClient({ fetch, sleep, onRetry }).complete([], []),
    ).rejects.toMatchObject({ message: "HTTP 400: bad request" });

    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("通信エラーは送り直す", async () => {
    const { fetch, calls } = fetchSteps([
      new TypeError("fetch failed"),
      okResponse(),
    ]);
    const { sleep, waits } = recordSleep();

    const completion = await makeClient({ fetch, sleep }).complete([], []);

    expect(completion.message.content).toBe("ok");
    expect(waits).toEqual([2000]);
    expect(calls).toHaveLength(2);
  });

  it("本文を読み始めたあとは送り直さない", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1;
          if (pulls === 1) {
            controller.enqueue(
              encoder.encode(
                sse({ choices: [{ delta: { content: "こん" } }] }),
              ),
            );
          } else {
            controller.error(new TypeError("fetch failed"));
          }
        },
      },
      { highWaterMark: 0 },
    );
    const { fetch, calls } = fetchSteps([new Response(body)]);
    const { sleep, waits } = recordSleep();
    const onText = vi.fn();

    await expect(
      makeClient({ fetch, sleep }).complete([], [], { onText }),
    ).rejects.toMatchObject({ message: "fetch failed" });

    expect(onText).toHaveBeenCalledWith("こん");
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it("onRetry に回数・待ち時間・理由を渡す", async () => {
    const { fetch } = fetchSteps([
      status(429, "", { "retry-after": "3" }),
      status(502),
      okResponse(),
    ]);
    const { sleep } = recordSleep();
    const onRetry = vi.fn();

    await makeClient({ fetch, sleep, onRetry }).complete([], []);

    expect(onRetry.mock.calls).toEqual([
      [1, 3000, "HTTP 429"],
      [2, 4000, "HTTP 502"],
    ]);
  });
});
