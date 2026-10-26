import { describe, expect, it } from "vitest";
import {
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
    const { fetch } = mockFetch(new Response("x".repeat(600), { status: 500 }));
    const client = createClient({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch,
    });

    await expect(client.complete([], [])).rejects.toMatchObject({
      message: `HTTP 500: ${"x".repeat(500)}`,
    });
  });
});
