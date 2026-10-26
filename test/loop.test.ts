import { describe, expect, it } from "vitest";
import type { Complete, LoopEvent, Tool } from "../src/agent/loop.js";
import { runTurn } from "../src/agent/loop.js";
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
});
