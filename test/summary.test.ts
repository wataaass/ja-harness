import { describe, expect, it } from "vitest";
import type { Complete } from "../src/agent/loop.js";
import {
  applySummary,
  buildSummaryRequest,
  SUMMARY_INSTRUCTION,
  SUMMARY_PREFIX,
  selectRange,
  summarize,
} from "../src/context/summary.js";
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

type Call = {
  messages: Message[];
  tools: ToolSpec[];
  cb: Parameters<Complete>[2];
};

function fakeComplete(content: string): {
  complete: Complete;
  calls: Call[];
} {
  const calls: Call[] = [];
  const complete: Complete = async (messages, receivedTools, cb) => {
    calls.push({ messages, tools: receivedTools, cb });
    return {
      message: { role: "assistant", content },
      usage,
      finishReason: "stop",
    };
  };
  return { complete, calls };
}

describe("selectRange", () => {
  it("system があれば start は 1", () => {
    const messages: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ];
    expect(selectRange(messages, 1, chars)).toEqual({ start: 1, end: 3 });
  });

  it("system がなければ start は 0", () => {
    const messages: Message[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
      { role: "assistant", content: "d" },
    ];
    expect(selectRange(messages, 1, chars)).toEqual({ start: 0, end: 3 });
  });

  it("keepRecentTokens で end が決まる", () => {
    const messages: Message[] = [
      { role: "user", content: "x" },
      { role: "assistant", content: "x" },
      { role: "user", content: "x" },
      { role: "assistant", content: "x" },
      { role: "user", content: "x" },
    ];
    expect(selectRange(messages, 10, chars)).toEqual({ start: 0, end: 3 });
  });

  it("keepRecentTokens が 0 でも末尾は残す", () => {
    const messages: Message[] = [
      { role: "user", content: "x" },
      { role: "assistant", content: "x" },
      { role: "user", content: "x" },
    ];
    expect(selectRange(messages, 0, chars)).toEqual({ start: 0, end: 2 });
  });

  it("end が tool に当たったら前に動かす", () => {
    const messages: Message[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "a" },
      { role: "user", content: "a" },
      { role: "assistant", content: "a" },
      { role: "tool", toolCallId: "1", content: "t" },
      { role: "assistant", content: "a" },
      { role: "tool", toolCallId: "2", content: "t" },
    ];
    expect(selectRange(messages, 12, chars)).toEqual({ start: 0, end: 3 });
  });

  it("短い会話なら null", () => {
    const messages: Message[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ];
    expect(selectRange(messages, 1, chars)).toBeNull();
  });

  it("空の会話なら null", () => {
    expect(selectRange([], 1, chars)).toBeNull();
  });
});

describe("buildSummaryRequest", () => {
  it("先頭は元の配列と同じ参照で、最後は指示", () => {
    const messages: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ];
    const request = buildSummaryRequest(messages, { start: 0, end: 3 });

    expect(request).toHaveLength(4);
    for (let i = 0; i < 3; i += 1) {
      expect(request[i]).toBe(messages[i]);
    }
    expect(request[3]).toEqual({
      role: "user",
      content: SUMMARY_INSTRUCTION,
    });
  });
});

describe("applySummary", () => {
  it("前後を残して checkpoint に置き換え、元の配列を変えない", () => {
    const messages: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
      { role: "assistant", content: "d" },
    ];
    const before = structuredClone(messages);
    const result = applySummary(messages, { start: 1, end: 3 }, "summary");

    expect(result).not.toBe(messages);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe(messages[0]);
    expect(result[1]).toEqual({
      role: "user",
      content: `${SUMMARY_PREFIX}\n\n<checkpoint>\nsummary\n</checkpoint>`,
    });
    expect(result[2]).toBe(messages[3]);
    expect(result[3]).toBe(messages[4]);
    expect(messages).toEqual(before);
  });
});

describe("summarize", () => {
  const messages: Message[] = [
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
    { role: "user", content: "c" },
    { role: "assistant", content: "d" },
    { role: "user", content: "e" },
  ];

  it("先頭を同じ参照で送り、成功時は usage と結果を返す", async () => {
    const before = structuredClone(messages);
    const { complete, calls } = fakeComplete("short");
    const controller = new AbortController();

    const result = await summarize({
      complete,
      messages,
      tools,
      keepRecentTokens: 10,
      estimate: chars,
      signal: controller.signal,
    });

    if (result.messages === null) {
      throw new Error("summary was not returned");
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].tools).toBe(tools);
    expect(calls[0].cb?.signal).toBe(controller.signal);
    for (let i = 0; i < 3; i += 1) {
      expect(calls[0].messages[i]).toBe(messages[i]);
    }
    expect(calls[0].messages[3]).toEqual({
      role: "user",
      content: SUMMARY_INSTRUCTION,
    });
    expect(calls[0].messages).toHaveLength(4);
    expect(messages).toEqual(before);
    expect(result.usage).toBe(usage);
    expect(result.messages).toEqual(
      applySummary(messages, { start: 0, end: 3 }, "short"),
    );
  });

  it("要約が空なら messages は null で usage を返す", async () => {
    const { complete } = fakeComplete("   ");
    expect(
      await summarize({
        complete,
        messages,
        tools,
        keepRecentTokens: 10,
        estimate: chars,
      }),
    ).toEqual({ messages: null, usage });
  });

  it("要約が短くならないなら messages は null で usage を返す", async () => {
    const { complete } = fakeComplete("a".repeat(22));
    expect(
      await summarize({
        complete,
        messages,
        tools,
        keepRecentTokens: 10,
        estimate: chars,
      }),
    ).toEqual({ messages: null, usage });
  });

  it("要約する範囲がなければ complete を呼ばない", async () => {
    const short: Message[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ];
    const { complete, calls } = fakeComplete("short");
    const result = await summarize({
      complete,
      messages: short,
      tools,
      keepRecentTokens: 10,
      estimate: chars,
    });
    expect(result).toEqual({ messages: null });
    expect(calls).toHaveLength(0);
  });
});
