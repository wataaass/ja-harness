import { describe, expect, it } from "vitest";
import type { Complete } from "../src/agent/loop.js";
import type { ContextConfig } from "../src/context/manager.js";
import {
  createContextManager,
  DEFAULT_CONTEXT,
  summaryThreshold,
} from "../src/context/manager.js";
import type { Estimator } from "../src/context/tokens.js";
import { estimateMessages } from "../src/context/tokens.js";
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
    targetRatio: 1,
    keepRecentTokens: 10,
    prune: { maxTokens: 80, headTokens: 20, tailTokens: 20 },
    mask: { window: 5, minTokens: 300, maxCallsAhead: Infinity, margin: 1 },
    cacheTtlSeconds: 300,
    overflowRetries: 1,
    mode: "price",
    minCallsAhead: 3,
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

function fakeCompleteSequence(contents: string[]): {
  complete: Complete;
  calls: number;
} {
  const state = { calls: 0 };
  const complete: Complete = async () => {
    const content = contents[state.calls] ?? "   ";
    state.calls += 1;
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

  it("しきい値を超えたら隠して下回り、要約を呼ばない", async () => {
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
    expect(prep.actions[0]?.action).toBe("mask");
    expect(prep.actions[0]?.savedTokens).toBeGreaterThan(0);
    expect(list[0]).toBe(first);
    expect(list[3]).toMatchObject({ role: "tool" });
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
  });

  it("targetRatio 0.5 では切り詰めでしきい値を下回っても target を超えたら要約する", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({ targetRatio: 0.5 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(fake.calls).toBe(1);
    expect(prep.actions.map((action) => action.action)).toContain("summary");
  });

  it("targetRatio 0.5 では要約に渡す keepRecentTokens を target / 2 以下にする", async () => {
    const tenths: Estimator = (text) => Math.ceil(Array.from(text).length / 10);
    const fake = fakeComplete("x");
    const manager = createContextManager({
      config: config({ targetRatio: 0.5, keepRecentTokens: 1000 }),
      complete: fake.complete,
      estimate: tenths,
    });
    const list: Message[] = [{ role: "system", content: "s" }];
    for (let i = 0; i < 25; i += 1) {
      list.push({ role: "user", content: "u".repeat(100) });
    }

    const prep = await manager.beforeStep(list, tools, undefined);

    const target = Math.floor(
      summaryThreshold(config({ targetRatio: 0.5 })) * 0.5,
    );
    expect(fake.calls).toBe(1);
    expect(prep.actions.map((action) => action.action)).toEqual(["summary"]);
    expect(estimateMessages(list, tenths)).toBeLessThanOrEqual(target);
  });

  it("隠しても超えたら、隠したあとの会話で要約し、usage と差を返す", async () => {
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
    expect((sent[4] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
    expect(prep.usage).toBe(usage);
    expect(prep.actions.map((action) => action.action)).toContain("summary");
    const summary = prep.actions.find((action) => action.action === "summary");
    expect(summary?.savedTokens).toBeGreaterThan(0);
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
      "mask",
      "summary",
      "prune",
    ]);
    expect(prep.actions[2]?.savedTokens).toBeGreaterThan(0);
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
    expect(prep.actions.map((action) => action.action)).toEqual([
      "mask",
      "prune",
    ]);
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "lines pruned",
    );
  });

  it("要約に失敗したあと、文脈が十分に増えるまで要約を呼ばない", async () => {
    const fake = fakeComplete("   ");
    const manager = createContextManager({
      config: config({ contextWindow: 100 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    await manager.beforeStep(list, tools, undefined);
    expect(fake.calls).toBe(1);

    list.push({ role: "user", content: "x".repeat(100) });
    await manager.beforeStep(list, tools, undefined);
    expect(fake.calls).toBe(1);

    list.push({ role: "user", content: "y".repeat(5000) });
    await manager.beforeStep(list, tools, undefined);
    expect(fake.calls).toBe(2);
  });

  it("要約に成功したら、次は少し増えても要約を呼ぶ", async () => {
    const fake = fakeCompleteSequence(["   ", "short", "   "]);
    const manager = createContextManager({
      config: config({ contextWindow: 100 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    await manager.beforeStep(list, tools, undefined);
    expect(fake.calls).toBe(1);

    list.push({ role: "user", content: "y".repeat(5000) });
    await manager.beforeStep(list, tools, undefined);
    expect(fake.calls).toBe(2);

    list.push({ role: "user", content: "z".repeat(100) });
    await manager.beforeStep(list, tools, undefined);
    expect(fake.calls).toBe(3);
  });

  it("onOverflow と compactNow は失敗のあとでも要約を試す", async () => {
    const fake = fakeComplete("   ");
    const manager = createContextManager({
      config: config({ contextWindow: 100 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    await manager.beforeStep(list, tools, undefined);
    expect(fake.calls).toBe(1);

    await manager.onOverflow(list, tools);
    expect(fake.calls).toBe(2);

    await manager.compactNow(list, tools);
    expect(fake.calls).toBe(3);
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

  it("しきい値以下で得が損より小さければ書き換えない", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 10000,
        mask: { window: 0, minTokens: 1 },
        prices: { input: 0.3, cachedInput: 0.006 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();
    const firstTool = list[3];

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(prep).toEqual({ actions: [] });
    expect(list[3]).toBe(firstTool);
    expect(fake.calls).toBe(0);
  });

  it("呼び出しが増えると料金の得が損を上回り書き換える", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 10000,
        mask: { window: 0, minTokens: 1 },
        prices: { input: 0.3, cachedInput: 0.006 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    for (let i = 0; i < 100; i += 1) {
      await manager.beforeStep(list, tools, undefined);
    }

    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
    expect(fake.calls).toBe(0);
  });

  it("値段の差が小さければしきい値以下でも書き換える", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 10000,
        mask: { window: 0, minTokens: 1 },
        prices: { input: 3, cachedInput: 0.3 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    for (let i = 0; i < 20; i += 1) {
      await manager.beforeStep(list, tools, undefined);
    }

    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
    expect(fake.calls).toBe(0);
  });

  it("prices がなければしきい値以下では書き換えない", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({ contextWindow: 10000 }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();
    const firstTool = list[3];

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(prep).toEqual({ actions: [] });
    expect(list[3]).toBe(firstTool);
  });

  it("しきい値を超えたら料金を見ずに隠す", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 400,
        prices: { input: 0.3, cachedInput: 0.006 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(fake.calls).toBe(0);
    expect(prep.actions.map((action) => action.action)).toEqual(["mask"]);
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
  });

  it("キャッシュが冷えていれば料金を見ずに隠す", async () => {
    const fake = fakeComplete("short");
    let clock = 1_000;
    const manager = createContextManager({
      config: config({
        contextWindow: 10000,
        mask: { window: 0, minTokens: 1 },
      }),
      complete: fake.complete,
      estimate: chars,
      now: () => clock,
    });
    const list = messages();

    const warm = await manager.beforeStep(list, tools, undefined);
    expect(warm.actions).toEqual([]);
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toBe(big);

    clock += 300_001;
    const cold = await manager.beforeStep(list, tools, undefined);
    expect(cold.actions.map((action) => action.action)).toEqual(["mask"]);
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
  });

  it("キャッシュが温かく prices がなければ隠さない", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 10000,
        mask: { window: 0, minTokens: 1 },
      }),
      complete: fake.complete,
      estimate: chars,
      now: () => 1_000,
    });
    const list = messages();

    for (let i = 0; i < 5; i += 1) {
      const prep = await manager.beforeStep(list, tools, undefined);
      expect(prep.actions).toEqual([]);
    }
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toBe(big);
  });

  it("しきい値を超えたら料金を見ずに先に隠す", async () => {
    const fake = fakeComplete("   ");
    const manager = createContextManager({
      config: config({
        contextWindow: 100,
        mask: { window: 0, minTokens: 1 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(prep.actions[0]?.action).toBe("mask");
  });

  it("既定では targetRatio 0.7 と mask の上限・margin を持つ", () => {
    expect(DEFAULT_CONTEXT.targetRatio).toBe(0.7);
    expect(DEFAULT_CONTEXT.mask).toEqual({
      window: 5,
      minTokens: 300,
      maxCallsAhead: Infinity,
      margin: 1,
    });
  });

  it("maxCallsAhead を超えて先の往復を見込まない", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 10000,
        mask: { window: 0, minTokens: 1, maxCallsAhead: 3, margin: 1 },
        prices: { input: 0.3, cachedInput: 0.006 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    for (let i = 0; i < 100; i += 1) {
      const prep = await manager.beforeStep(list, tools, undefined);
      expect(prep.actions).toEqual([]);
    }
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toBe(big);
  });

  it("margin 倍の得がなければ隠さない", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 10000,
        mask: { window: 0, minTokens: 1, maxCallsAhead: Infinity, margin: 100 },
        prices: { input: 3, cachedInput: 0.3 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list = messages();

    for (let i = 0; i < 20; i += 1) {
      const prep = await manager.beforeStep(list, tools, undefined);
      expect(prep.actions).toEqual([]);
    }
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toBe(big);
  });

  it("しきい値を超えたら window の中も古い順に target まで隠す", async () => {
    const fake = fakeComplete("short");
    const manager = createContextManager({
      config: config({
        contextWindow: 1200,
        targetRatio: 1,
        mask: { window: 2, minTokens: 300, maxCallsAhead: Infinity, margin: 1 },
      }),
      complete: fake.complete,
      estimate: chars,
    });
    const list: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "1", name: "read", arguments: '{"paths":["a.ts"]}' }],
      },
      { role: "tool", toolCallId: "1", content: "a".repeat(600) },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "2", name: "read", arguments: '{"paths":["b.ts"]}' }],
      },
      { role: "tool", toolCallId: "2", content: "b".repeat(320) },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "3", name: "read", arguments: '{"paths":["c.ts"]}' }],
      },
      { role: "tool", toolCallId: "3", content: "c".repeat(320) },
      { role: "assistant", content: "done" },
    ];

    const prep = await manager.beforeStep(list, tools, undefined);

    expect(fake.calls).toBe(0);
    expect(prep.actions.map((action) => action.action)).toEqual([
      "mask",
      "mask",
    ]);
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
    expect((list[5] as Extract<Message, { role: "tool" }>).content).toContain(
      "[Hidden to save tokens:",
    );
    expect((list[7] as Extract<Message, { role: "tool" }>).content).toBe(
      "c".repeat(320),
    );
  });
});
