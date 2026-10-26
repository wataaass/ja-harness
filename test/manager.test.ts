import { describe, expect, it } from "vitest";
import type { Complete } from "../src/agent/loop.js";
import type { ContextConfig } from "../src/context/manager.js";
import {
  createContextManager,
  summaryThreshold,
} from "../src/context/manager.js";
import type { Estimator } from "../src/context/tokens.js";
import type { Message, ToolSpec, Usage } from "../src/llm/types.js";

const chars: Estimator = (text) => Array.from(text).length;

const usage: Usage = {
  input: 10,
  cachedInput: 5,
  output: 3,
  reasoning: 0,
  cost: 0.01,
};

const tools: ToolSpec[] = [
  { name: "read", description: "read a file", parameters: { type: "object" } },
];

function config(overrides: Partial<ContextConfig> = {}): ContextConfig {
  return {
    contextWindow: 400,
    summaryMaxTokens: 64000,
    summaryMaxRatio: 0.5,
    keepRecentTokens: 10,
    prune: { maxTokens: 80, headTokens: 20, tailTokens: 20 },
    overflowRetries: 1,
    ...overrides,
  };
}

const big = `${"a".repeat(100)}\n${"b".repeat(100)}`;

function messages(): Message[] {
  return [
    { role: "system", content: "s" },
    { role: "user", content: "u" },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "1", name: "read", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "1", content: big },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "2", name: "read", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "2", content: "ok" },
  ];
}

function fakeComplete(content: string): {
  complete: Complete;
  calls: number;
  received: Message[][];
} {
  const state = { calls: 0, received: [] as Message[][] };
  const complete: Complete = async (messages) => {
    state.calls += 1;
    state.received.push(messages);
    return {
      message: { role: "assistant", content },
      usage,
      finishReason: "stop",
    };
  };
  return {
    complete,
    get calls() {
      return state.calls;
    },
    get received() {
      return state.received;
    },
  };
}

function messagesWithOldTools(): Message[] {
  return [
    { role: "system", content: "s" },
    { role: "user", content: "u" },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "1", name: "read", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "1", content: big },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "2", name: "read", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "2", content: big },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "3", name: "read", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "3", content: "ok" },
  ];
}

describe("summaryThreshold", () => {
  it("summaryMaxTokens と contextWindow * summaryMaxRatio の小さい方", () => {
    expect(
      summaryThreshold(
        config({
          contextWindow: 100000,
          summaryMaxTokens: 64000,
          summaryMaxRatio: 0.5,
        }),
      ),
    ).toBe(50000);
    expect(
      summaryThreshold(
        config({
          contextWindow: 1000000,
          summaryMaxTokens: 1000,
          summaryMaxRatio: 0.5,
        }),
      ),
    ).toBe(1000);
  });

  it("端数は切り捨てる", () => {
    expect(
      summaryThreshold(
        config({
          contextWindow: 101,
          summaryMaxTokens: 64000,
          summaryMaxRatio: 0.5,
        }),
      ),
    ).toBe(50);
  });
});

describe("createContextManager", () => {
  it("しきい値以下なら何もしない", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config(),
      complete: fake.complete,
      estimate: chars,
    });
    const list: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
    ];

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(prep).toEqual({ actions: [] });
    expect(fake.calls).toBe(0);
  });

  it("切り詰めだけで下回ったら要約を呼ばない", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config(),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();
    const first = list[0];

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(fake.calls).toBe(0);
    expect(prep.actions).toHaveLength(1);
    expect(prep.actions[0]?.action).toBe("prune");
    expect(prep.actions[0]?.savedTokens).toBeGreaterThan(0);
    expect(list[0]).toBe(first);
    expect(list[3]).toMatchObject({ role: "tool" });
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "lines pruned",
    );
  });

  it("切り詰めても超えたら、切り詰める前の会話で要約し、usage と差を返す", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({ contextWindow: 100 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();
    list.splice(1, 0, { role: "user", content: "u".repeat(1000) });
    const first = list[0];

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(fake.calls).toBe(1);
    expect(fake.received).toHaveLength(1);
    const sent = fake.received[0] as Message[];
    expect((sent[4] as Extract<Message, { role: "tool" }>).content).toBe(big);
    expect(prep.usage).toBe(usage);
    expect(prep.actions.map((action) => action.action)).toEqual(["summary"]);
    expect(prep.actions[0]?.savedTokens).toBeGreaterThan(0);
    expect(list[0]).toBe(first);
    expect(list[1]).toMatchObject({ role: "user" });
    expect((list[1] as Extract<Message, { role: "user" }>).content).toContain(
      "<checkpoint>",
    );
    expect(list).toHaveLength(4);
  });

  it("要約のあとに残った古い道具の結果も切り詰める", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({ contextWindow: 100, keepRecentTokens: 225 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messagesWithOldTools();

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(fake.calls).toBe(1);
    expect(prep.actions.map((action) => action.action)).toEqual([
      "summary",
      "prune",
    ]);
    expect(prep.actions[1]?.savedTokens).toBeGreaterThan(0);
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "lines pruned",
    );
    expect((list[5] as Extract<Message, { role: "tool" }>).content).toBe("ok");
  });

  it("要約が使えなくても usage を返し、切り詰めだけを反映する", async () => {
    const fake = fakeComplete("   ");
    const manager = createContextManager({
      config: config({ contextWindow: 100 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(fake.calls).toBe(1);
    expect(prep.usage).toBe(usage);
    expect(prep.actions.map((action) => action.action)).toEqual(["prune"]);
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "lines pruned",
    );
  });

  it("onOverflow はしきい値以下でも切り詰める", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({ contextWindow: 10000 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();
    const first = list[0];

    const prep = await manager.onOverflow(list, tools);

    expect(prep.actions[0]?.action).toBe("prune");
    expect(prep.actions[0]?.savedTokens).toBeGreaterThan(0);
    expect(list[0]).toBe(first);
  });
});
