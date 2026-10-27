import { describe, expect, it } from "vitest";
import type { Complete, LoopEvent, Tool } from "../src/agent/loop.js";
import { repairMessages, runTurn } from "../src/agent/loop.js";
import { createRepeatTracker } from "../src/agent/repeat.js";
import type { StepPrep } from "../src/context/manager.js";
import type {
  Completion,
  Message,
  ToolCall,
  ToolSpec,
  Usage,
} from "../src/llm/types.js";

function usage(
  input = 0,
  cachedInput = 0,
  output = 0,
  reasoning = 0,
  cost?: number,
): Usage {
  const result: Usage = { input, cachedInput, output, reasoning };
  if (cost !== undefined) {
    result.cost = cost;
  }
  return result;
}

function assistantMessage(content: string, toolCalls?: ToolCall[]): Message {
  const message: Extract<Message, { role: "assistant" }> = {
    role: "assistant",
    content,
  };
  if (toolCalls !== undefined) {
    message.toolCalls = toolCalls;
  }
  return message;
}

function completion(message: Message, used: Usage): Completion {
  return {
    message: assistantMessage(
      message.content,
      message.role === "assistant" ? message.toolCalls : undefined,
    ),
    usage: used,
    finishReason: "stop",
  };
}

function tool(name: string, execute: Tool["execute"]): Tool {
  return { name, description: `${name} の道具`, parameters: {}, execute };
}

function fakeComplete(completions: Completion[]): {
  complete: Complete;
  calls: { messages: Message[]; tools: ToolSpec[] }[];
} {
  const calls: { messages: Message[]; tools: ToolSpec[] }[] = [];
  const complete: Complete = async (messages, tools) => {
    calls.push({
      messages: structuredClone(messages),
      tools: structuredClone(tools),
    });
    const result = completions[calls.length - 1];
    if (result === undefined) {
      throw new Error("想定より多く complete が呼ばれた");
    }
    return result;
  };
  return { complete, calls };
}

function fakeCompleteSequence(items: (Completion | Error)[]): {
  complete: Complete;
  calls: { messages: Message[] }[];
} {
  const calls: { messages: Message[] }[] = [];
  const complete: Complete = async (messages) => {
    calls.push({ messages: structuredClone(messages) });
    const item = items[calls.length - 1];
    if (item === undefined) {
      throw new Error("想定より多く complete が呼ばれた");
    }
    if (item instanceof Error) {
      throw item;
    }
    return item;
  };
  return { complete, calls };
}

type BeforeCall = { messages: Message[]; reported: number | undefined };

function stubManager(
  beforePreps: StepPrep[] = [],
  overflowPreps: StepPrep[] = [],
): {
  manager: {
    beforeStep: (
      messages: Message[],
      tools: ToolSpec[],
      reportedTokens: number | undefined,
      signal?: AbortSignal,
    ) => Promise<StepPrep>;
    onOverflow: (
      messages: Message[],
      tools: ToolSpec[],
      signal?: AbortSignal,
    ) => Promise<StepPrep>;
  };
  before: BeforeCall[];
  overflowCalls: number;
} {
  const before: BeforeCall[] = [];
  const state = { overflowCalls: 0 };
  return {
    manager: {
      async beforeStep(
        messages: Message[],
        _tools: ToolSpec[],
        reportedTokens: number | undefined,
        _signal?: AbortSignal,
      ): Promise<StepPrep> {
        before.push({
          messages: structuredClone(messages),
          reported: reportedTokens,
        });
        return beforePreps.shift() ?? { actions: [] };
      },
      async onOverflow(
        _messages: Message[],
        _tools: ToolSpec[],
        _signal?: AbortSignal,
      ): Promise<StepPrep> {
        state.overflowCalls += 1;
        return overflowPreps.shift() ?? { actions: [] };
      },
    },
    before,
    get overflowCalls() {
      return state.overflowCalls;
    },
  };
}

describe("runTurn", () => {
  it("道具なしで答えて終わる", async () => {
    const initial: Message[] = [{ role: "user", content: "こんにちは" }];
    const messages = [...initial];
    const done = completion(assistantMessage("やあ"), usage(1, 2, 3, 4));
    const { complete, calls } = fakeComplete([done]);
    const events: LoopEvent[] = [];

    const result = await runTurn({
      complete,
      tools: [],
      messages,
      onEvent: (event) => events.push(event),
    });

    expect(result.stop).toBe("done");
    expect(result.steps).toBe(1);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(initial[0]);
    expect(messages[0]).toBe(initial[0]);
    expect(messages[1]).toBe(done.message);
    expect(calls).toHaveLength(1);
    expect(events).toContainEqual({ type: "step-end", usage: done.usage });
  });

  it("2つの道具を呼び、結果を呼び出しの順に足す", async () => {
    const messages: Message[] = [{ role: "user", content: "計算して" }];
    const executed: unknown[] = [];
    const echo = tool("echo", async (args) => {
      executed.push(args);
      return JSON.stringify(args);
    });
    const first = completion(
      assistantMessage("呼びます", [
        { id: "call-1", name: "echo", arguments: '{"x":1}' },
        { id: "call-2", name: "echo", arguments: "" },
      ]),
      usage(),
    );
    const second = completion(assistantMessage("終わり"), usage());
    const { complete, calls } = fakeComplete([first, second]);
    const events: LoopEvent[] = [];

    const result = await runTurn({
      complete,
      tools: [echo],
      messages,
      onEvent: (event) => events.push(event),
    });

    expect(result.stop).toBe("done");
    expect(result.steps).toBe(2);
    expect(executed).toEqual([{ x: 1 }, {}]);
    const toolMessages = messages.filter((message) => message.role === "tool");
    expect(toolMessages).toEqual([
      { role: "tool", toolCallId: "call-1", content: '{"x":1}' },
      { role: "tool", toolCallId: "call-2", content: "{}" },
    ]);
    expect(calls[1]?.messages).toContainEqual({
      role: "tool",
      toolCallId: "call-1",
      content: '{"x":1}',
    });
    expect(calls[1]?.messages.slice(-2)).toEqual(toolMessages);
    const starts = events.filter((event) => event.type === "tool-start");
    expect(starts.map((event) => event.name)).toEqual(["echo", "echo"]);
    const ends = events.filter((event) => event.type === "tool-end");
    expect(ends.map((event) => event.isError)).toEqual([false, false]);
  });

  it("引数の JSON 不正・知らない道具・execute の throw をエラーとして返し続ける", async () => {
    const messages: Message[] = [{ role: "user", content: "テスト" }];
    let addCalls = 0;
    let boomCalls = 0;
    const add = tool("add", async () => {
      addCalls += 1;
      return "ok";
    });
    const boom = tool("boom", async () => {
      boomCalls += 1;
      throw new Error("kaboom");
    });
    const first = completion(
      assistantMessage("呼びます", [
        { id: "bad-json", name: "add", arguments: "{oops" },
        { id: "unknown", name: "nope", arguments: "{}" },
        { id: "throws", name: "boom", arguments: "{}" },
      ]),
      usage(),
    );
    const second = completion(assistantMessage("直しました"), usage());
    const { complete } = fakeComplete([first, second]);
    const events: LoopEvent[] = [];

    const result = await runTurn({
      complete,
      tools: [add, boom],
      messages,
      onEvent: (event) => events.push(event),
    });

    expect(result.stop).toBe("done");
    expect(addCalls).toBe(0);
    expect(boomCalls).toBe(1);
    const toolMessages = messages.filter((message) => message.role === "tool");
    expect(toolMessages).toHaveLength(3);
    expect(toolMessages[0]?.content).toMatch(
      /^Error: invalid JSON arguments: /,
    );
    expect(toolMessages[1]?.content).toBe('Error: unknown tool "nope"');
    expect(toolMessages[2]?.content).toBe("Error: kaboom");
    const ends = events.filter((event) => event.type === "tool-end");
    expect(ends.map((event) => event.isError)).toEqual([true, true, true]);
  });

  it("中断中に execute が throw したらエラーにせず投げ直す", async () => {
    const controller = new AbortController();
    const messages: Message[] = [{ role: "user", content: "中断" }];
    const boom = tool("boom", async () => {
      controller.abort();
      throw new Error("中断しました");
    });
    const { complete } = fakeComplete([
      completion(
        assistantMessage("", [{ id: "call-1", name: "boom", arguments: "{}" }]),
        usage(),
      ),
    ]);

    await expect(
      runTurn({
        complete,
        tools: [boom],
        messages,
        signal: controller.signal,
      }),
    ).rejects.toThrow("中断しました");
  });

  it("maxSteps に達すると max-steps で終わる", async () => {
    const messages: Message[] = [{ role: "user", content: "繰り返して" }];
    const noop = tool("noop", async () => "ok");
    const makeStep = (): Completion =>
      completion(
        assistantMessage("もう一度", [
          { id: `call-${messages.length}`, name: "noop", arguments: "{}" },
        ]),
        usage(),
      );
    const { complete, calls } = fakeComplete([
      makeStep(),
      makeStep(),
      makeStep(),
      makeStep(),
    ]);

    const result = await runTurn({
      complete,
      tools: [noop],
      messages,
      maxSteps: 3,
    });

    expect(result.stop).toBe("max-steps");
    expect(result.steps).toBe(3);
    expect(calls).toHaveLength(3);
    expect(messages.filter((message) => message.role === "tool")).toHaveLength(
      3,
    );
  });

  it("usage を合計し、cost はある回だけ足す", async () => {
    const noop = tool("noop", async () => "ok");
    const call = (id: string): ToolCall => ({
      id,
      name: "noop",
      arguments: "{}",
    });

    {
      const messages: Message[] = [{ role: "user", content: "合計" }];
      const { complete } = fakeComplete([
        completion(assistantMessage("", [call("a")]), usage(1, 2, 3, 4, 0.5)),
        completion(assistantMessage("", [call("b")]), usage(10, 20, 30, 40)),
        completion(assistantMessage("終わり"), usage(100, 200, 300, 400, 0.25)),
      ]);
      const result = await runTurn({ complete, tools: [noop], messages });
      expect(result.usage).toEqual({
        input: 111,
        cachedInput: 222,
        output: 333,
        reasoning: 444,
        cost: 0.75,
      });
    }

    {
      const messages: Message[] = [{ role: "user", content: "cost なし" }];
      const { complete } = fakeComplete([
        completion(assistantMessage("終わり"), usage(1, 2, 3, 4)),
      ]);
      const result = await runTurn({ complete, tools: [noop], messages });
      expect(result.usage).toEqual({
        input: 1,
        cachedInput: 2,
        output: 3,
        reasoning: 4,
      });
      expect("cost" in result.usage).toBe(false);
    }
  });

  it("complete に渡す tools に execute を含めず、順番を変えない", async () => {
    const messages: Message[] = [{ role: "user", content: "道具" }];
    const first: Tool = {
      name: "first",
      description: "1つ目",
      parameters: { type: "object" },
      execute: async () => "1",
    };
    const second: Tool = {
      name: "second",
      description: "2つ目",
      parameters: { type: "object" },
      execute: async () => "2",
    };
    const { complete, calls } = fakeComplete([
      completion(
        assistantMessage("", [
          { id: "call-1", name: "first", arguments: "{}" },
        ]),
        usage(),
      ),
      completion(assistantMessage("終わり"), usage()),
    ]);

    await runTurn({ complete, tools: [first, second], messages });

    const expected: ToolSpec[] = [
      { name: "first", description: "1つ目", parameters: { type: "object" } },
      { name: "second", description: "2つ目", parameters: { type: "object" } },
    ];
    expect(calls[0]?.tools).toEqual(expected);
    expect(calls[0]?.tools[0]).not.toHaveProperty("execute");
    expect(calls[1]?.tools).toEqual(expected);
  });

  it("2回目の messages の先頭は1回目と同じ（append-only）", async () => {
    const messages: Message[] = [
      { role: "system", content: "指示" },
      { role: "user", content: "お願い" },
    ];
    const noop = tool("noop", async () => "ok");
    const { complete, calls } = fakeComplete([
      completion(
        assistantMessage("", [{ id: "call-1", name: "noop", arguments: "{}" }]),
        usage(),
      ),
      completion(assistantMessage("終わり"), usage()),
    ]);

    await runTurn({ complete, tools: [noop], messages });

    const first = calls[0]?.messages ?? [];
    const second = calls[1]?.messages ?? [];
    expect(second.length).toBeGreaterThan(first.length);
    expect(second.slice(0, first.length)).toEqual(first);
    expect(messages.slice(0, first.length)).toEqual(first);
  });

  it("beforeStep を毎回呼び、reportedTokens は直前の usage から来る", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const noop = tool("noop", async () => "ok");
    const stub = stubManager();
    const { complete } = fakeComplete([
      completion(
        assistantMessage("", [{ id: "call-1", name: "noop", arguments: "{}" }]),
        usage(1, 2, 3, 4),
      ),
      completion(assistantMessage("終わり"), usage(10, 20, 30, 40)),
    ]);

    const result = await runTurn({
      complete,
      tools: [noop],
      messages,
      context: { manager: stub.manager, overflowRetries: 1 },
    });

    expect(result.steps).toBe(2);
    expect(stub.before).toHaveLength(2);
    expect(stub.before.map((call) => call.reported)).toEqual([undefined, 4]);
  });

  it("context のイベントを出し、要約の usage を合計に足す", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const stub = stubManager([
      {
        usage: usage(100, 200, 300, 400, 0.5),
        actions: [{ action: "summary", savedTokens: 50 }],
      },
    ]);
    const { complete } = fakeComplete([
      completion(assistantMessage("終わり"), usage(1, 2, 3, 4, 0.25)),
    ]);
    const events: LoopEvent[] = [];

    const result = await runTurn({
      complete,
      tools: [],
      messages,
      context: { manager: stub.manager, overflowRetries: 1 },
      onEvent: (event) => events.push(event),
    });

    expect(events).toContainEqual({
      type: "context",
      action: "summary",
      savedTokens: 50,
    });
    expect(result.usage).toEqual({
      input: 101,
      cachedInput: 202,
      output: 303,
      reasoning: 404,
      cost: 0.75,
    });
  });

  it("あふれのエラーで onOverflow を呼び、1回だけ再送する", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const stub = stubManager(
      [],
      [
        {
          usage: usage(5, 6, 7, 8),
          actions: [{ action: "prune", savedTokens: 10 }],
        },
      ],
    );
    const { complete, calls } = fakeCompleteSequence([
      new Error("maximum context length exceeded"),
      completion(assistantMessage("終わり"), usage(1, 2, 3, 4)),
    ]);
    const events: LoopEvent[] = [];

    const result = await runTurn({
      complete,
      tools: [],
      messages,
      context: { manager: stub.manager, overflowRetries: 1 },
      onEvent: (event) => events.push(event),
    });

    expect(result.stop).toBe("done");
    expect(result.steps).toBe(1);
    expect(calls).toHaveLength(2);
    expect(stub.overflowCalls).toBe(1);
    expect(events).toContainEqual({
      type: "context",
      action: "prune",
      savedTokens: 10,
    });
    expect(result.usage).toEqual({
      input: 6,
      cachedInput: 8,
      output: 10,
      reasoning: 12,
    });
  });

  it("再送してもあふれたら投げる", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const stub = stubManager(
      [],
      [{ actions: [{ action: "prune", savedTokens: 10 }] }],
    );
    const { complete, calls } = fakeCompleteSequence([
      new Error("context_length_exceeded"),
      new Error("prompt is too long"),
    ]);

    await expect(
      runTurn({
        complete,
        tools: [],
        messages,
        context: { manager: stub.manager, overflowRetries: 1 },
      }),
    ).rejects.toThrow("prompt is too long");
    expect(calls).toHaveLength(2);
    expect(stub.overflowCalls).toBe(1);
  });

  it("あふれでないエラーはそのまま投げる", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const stub = stubManager();
    const { complete } = fakeCompleteSequence([new Error("network down")]);

    await expect(
      runTurn({
        complete,
        tools: [],
        messages,
        context: { manager: stub.manager, overflowRetries: 1 },
      }),
    ).rejects.toThrow("network down");
    expect(stub.overflowCalls).toBe(0);
    expect(stub.before).toHaveLength(1);
  });

  it("くり返しの注意が3回目の道具の結果の末尾に付く", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const noop = tool("noop", async () => "ok");
    const call = (id: string): ToolCall => ({
      id,
      name: "noop",
      arguments: '{"a":1}',
    });
    const { complete } = fakeComplete([
      completion(
        assistantMessage("", [call("1"), call("2"), call("3")]),
        usage(),
      ),
      completion(assistantMessage("終わり"), usage()),
    ]);

    await runTurn({
      complete,
      tools: [noop],
      messages,
      repeat: createRepeatTracker(),
    });

    const results = messages
      .filter((message) => message.role === "tool")
      .map((message) => message.content);
    expect(results).toHaveLength(3);
    expect(results[0]).toBe("ok");
    expect(results[1]).toBe("ok");
    expect(results[2]?.startsWith("ok\n\n")).toBe(true);
    expect(results[2]).toContain(
      "you called the same tool with the same arguments again",
    );
  });

  it("runTurn の最初に reset して数え直す", async () => {
    const tracker = createRepeatTracker();
    tracker.record("noop", { a: 1 });
    tracker.record("noop", { a: 1 });
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const noop = tool("noop", async () => "ok");
    const { complete } = fakeComplete([
      completion(
        assistantMessage("", [
          { id: "call-1", name: "noop", arguments: '{"a":1}' },
        ]),
        usage(),
      ),
      completion(assistantMessage("終わり"), usage()),
    ]);

    await runTurn({
      complete,
      tools: [noop],
      messages,
      repeat: tracker,
    });

    const toolMessage = messages.find((message) => message.role === "tool");
    expect(toolMessage?.content).toBe("ok");
  });

  it("limitResult は成功した結果にだけかかり、道具も渡る", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const ok: Tool = {
      ...tool("ok", async () => "success"),
      maxResultTokens: 12,
    };
    const boom = tool("boom", async () => {
      throw new Error("failed");
    });
    const seen: { text: string; tool: Tool | undefined }[] = [];
    const { complete } = fakeComplete([
      completion(
        assistantMessage("", [
          { id: "ok", name: "ok", arguments: "{}" },
          { id: "boom", name: "boom", arguments: "{}" },
          { id: "missing", name: "missing", arguments: "{}" },
          { id: "bad", name: "ok", arguments: "{oops" },
        ]),
        usage(),
      ),
      completion(assistantMessage("終わり"), usage()),
    ]);

    await runTurn({
      complete,
      tools: [ok, boom],
      messages,
      limitResult: (text, used) => {
        seen.push({ text, tool: used });
        return `short(${text})`;
      },
    });

    const results = messages
      .filter((message) => message.role === "tool")
      .map((message) => message.content);
    expect(results[0]).toBe("short(success)");
    expect(results[1]).toBe("Error: failed");
    expect(results[2]).toBe('Error: unknown tool "missing"');
    expect(results[3]).toMatch(/^Error: invalid JSON arguments: /);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.text).toBe("success");
    expect(seen[0]?.tool?.name).toBe("ok");
    expect(seen[0]?.tool?.maxResultTokens).toBe(12);
  });

  it("くり返しの注意は短くしたあとに付く", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const noop = tool("noop", async () => "ok");
    const call = (id: string): ToolCall => ({
      id,
      name: "noop",
      arguments: "{}",
    });
    const { complete } = fakeComplete([
      completion(
        assistantMessage("", [call("1"), call("2"), call("3")]),
        usage(),
      ),
      completion(assistantMessage("終わり"), usage()),
    ]);

    await runTurn({
      complete,
      tools: [noop],
      messages,
      repeat: createRepeatTracker(),
      limitResult: (text) => `[short]${text}`,
    });

    const results = messages
      .filter((message) => message.role === "tool")
      .map((message) => message.content);
    expect(results[2]?.startsWith("[short]ok\n\n")).toBe(true);
    expect(results[2]).toContain(
      "you called the same tool with the same arguments again",
    );
  });

  it("道具の結果を足したあとに drainInput を呼び、返った発言を足す", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const noop = tool("noop", async () => "ok");
    const { complete, calls } = fakeComplete([
      completion(
        assistantMessage("", [{ id: "call-1", name: "noop", arguments: "{}" }]),
        usage(),
      ),
      completion(assistantMessage("終わり"), usage()),
    ]);
    const events: LoopEvent[] = [];
    const delivered: Message[] = [{ role: "user", content: "追加" }];
    let drains = 0;

    const result = await runTurn({
      complete,
      tools: [noop],
      messages,
      drainInput: () => {
        drains += 1;
        return delivered;
      },
      onEvent: (event) => events.push(event),
    });

    expect(result.stop).toBe("done");
    expect(drains).toBe(1);
    expect(events).toContainEqual({ type: "input-delivered", count: 1 });
    expect(messages).toContain(delivered[0]);
    expect(calls[1]?.messages.at(-1)).toEqual({
      role: "user",
      content: "追加",
    });
    expect(calls[1]?.messages.at(-2)).toEqual({
      role: "tool",
      toolCallId: "call-1",
      content: "ok",
    });
  });

  it("道具を呼ばずに終わったら drainInput を呼ばない", async () => {
    const messages: Message[] = [{ role: "user", content: "はじめ" }];
    const { complete } = fakeComplete([
      completion(assistantMessage("終わり"), usage()),
    ]);
    let drains = 0;

    await runTurn({
      complete,
      tools: [],
      messages,
      drainInput: () => {
        drains += 1;
        return [{ role: "user", content: "追加" }];
      },
    });

    expect(drains).toBe(0);
    expect(messages).toHaveLength(2);
  });
});

describe("repairMessages", () => {
  it("結果のない toolCalls に中断の結果を足す", () => {
    const messages: Message[] = [
      { role: "user", content: "はじめ" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "a", name: "read", arguments: "{}" },
          { id: "b", name: "grep", arguments: "{}" },
        ],
      },
    ];
    repairMessages(messages);
    expect(messages.slice(-2)).toEqual([
      { role: "tool", toolCallId: "a", content: "Interrupted by the user." },
      { role: "tool", toolCallId: "b", content: "Interrupted by the user." },
    ]);
  });

  it("結果があるものは足さず、二度呼んでも増やさない", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "a", name: "read", arguments: "{}" },
          { id: "b", name: "read", arguments: "{}" },
        ],
      },
      { role: "tool", toolCallId: "a", content: "ok" },
    ];
    repairMessages(messages);
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({
      role: "tool",
      toolCallId: "b",
      content: "Interrupted by the user.",
    });
    repairMessages(messages);
    expect(messages).toHaveLength(3);
  });

  it("末尾に toolCalls つきの assistant がなければ何もしない", () => {
    const messages: Message[] = [
      { role: "user", content: "はじめ" },
      { role: "assistant", content: "答え" },
    ];
    expect(repairMessages(messages)).toBe(messages);
    expect(messages).toHaveLength(2);
  });
});
