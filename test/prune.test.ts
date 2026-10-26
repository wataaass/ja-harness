import { describe, expect, it } from "vitest";
import type { PruneOptions } from "../src/context/prune.js";
import { pruneText, pruneToolResults } from "../src/context/prune.js";
import type { Estimator } from "../src/context/tokens.js";
import { createEstimator } from "../src/context/tokens.js";
import type { Message } from "../src/llm/types.js";

const chars: Estimator = (text) => Array.from(text).length;

function options(overrides: Partial<PruneOptions> = {}): PruneOptions {
  return {
    maxTokens: 80,
    headTokens: 20,
    tailTokens: 20,
    estimate: chars,
    ...overrides,
  };
}

describe("pruneText", () => {
  it("上限以下なら null", () => {
    expect(pruneText("a".repeat(10), options({ maxTokens: 10 }))).toBeNull();
  });

  it("上限を超えたら先頭・印・末尾の形にする", () => {
    const text = `${"a".repeat(100)}\n${"b".repeat(100)}`;
    expect(pruneText(text, options())).toBe(
      `${"a".repeat(20)}\n[... 2 lines pruned ...]\n${"b".repeat(20)}`,
    );
  });

  it("結果の見積もりは maxTokens 以下", () => {
    const estimate = createEstimator();
    const text = "日本語の長い結果です。".repeat(100);
    const out = pruneText(text, {
      maxTokens: 100,
      headTokens: 30,
      tailTokens: 30,
      estimate,
    });
    expect(out).not.toBeNull();
    const tokens = out === null ? 0 : estimate(out);
    expect(tokens).toBeLessThanOrEqual(100);
  });

  it("省いた行数を数える", () => {
    const text = `head\n${"x\n".repeat(50)}tail`;
    const out = pruneText(
      text,
      options({ maxTokens: 60, headTokens: 5, tailTokens: 5 }),
    );
    expect(out).toContain("[... 50 lines pruned ...]");
  });

  it("サロゲートペアを割らない", () => {
    const text = "😀".repeat(100);
    const out = pruneText(text, options({ headTokens: 10, tailTokens: 10 }));
    expect(out).toBe(
      `${"😀".repeat(10)}\n[... 1 lines pruned ...]\n${"😀".repeat(10)}`,
    );
  });

  it("不正な設定なら Error", () => {
    const text = "a".repeat(100);
    expect(() =>
      pruneText(
        text,
        options({ maxTokens: 40, headTokens: 10, tailTokens: 10 }),
      ),
    ).toThrow();
  });
});

describe("pruneToolResults", () => {
  const big = `${"a".repeat(100)}\n${"b".repeat(100)}`;
  const messages: Message[] = [
    { role: "user", content: "hi" },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "1", name: "read", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "1", content: big },
    { role: "tool", toolCallId: "2", content: big },
    {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "3", name: "read", arguments: "{}" }],
    },
    { role: "tool", toolCallId: "3", content: big },
  ];

  it("最後の assistant より前の tool だけを切る", () => {
    const result = pruneToolResults(messages, options());
    expect(result.pruned).toBe(2);
    expect(result.savedTokens).toBe(270);
    expect(result.messages[2]).not.toBe(messages[2]);
    expect(result.messages[2]).toMatchObject({ toolCallId: "1" });
    expect(result.messages[2].content).toBe(
      `${"a".repeat(20)}\n[... 2 lines pruned ...]\n${"b".repeat(20)}`,
    );
    expect(result.messages[3].content).toBe(result.messages[2].content);
    expect(result.messages[5]).toBe(messages[5]);
  });

  it("元の配列と要素を変えない", () => {
    const before = structuredClone(messages);
    const result = pruneToolResults(messages, options());
    expect(messages).toEqual(before);
    expect(result.messages).not.toBe(messages);
    expect(result.messages[0]).toBe(messages[0]);
  });

  it("2回目は切らない", () => {
    const first = pruneToolResults(messages, options());
    const second = pruneToolResults(first.messages, options());
    expect(second.pruned).toBe(0);
    expect(second.savedTokens).toBe(0);
    expect(second.messages).toEqual(first.messages);
  });

  it("最後の assistant がなければ何も切らない", () => {
    const onlyTools: Message[] = [
      { role: "tool", toolCallId: "1", content: big },
    ];
    const result = pruneToolResults(onlyTools, options());
    expect(result.pruned).toBe(0);
    expect(result.messages).toEqual(onlyTools);
  });
});
