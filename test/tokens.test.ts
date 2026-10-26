import { describe, expect, it } from "vitest";
import { createEstimator, estimateMessages } from "../src/context/tokens.js";
import type { Message } from "../src/llm/types.js";

describe("createEstimator", () => {
  it("英字だけなら4文字で1トークン", () => {
    const estimate = createEstimator();
    expect(estimate("abcd")).toBe(1);
    expect(estimate("abcde")).toBe(2);
  });

  it("日本語だけなら1文字0.7トークンで切り上げる", () => {
    const estimate = createEstimator();
    expect(estimate("あ")).toBe(1);
    expect(estimate("日本語")).toBe(3);
  });

  it("英字と日本語が混ざっても足して切り上げる", () => {
    const estimate = createEstimator();
    expect(estimate("ab日本")).toBe(2);
  });

  it("空文字列は0", () => {
    const estimate = createEstimator();
    expect(estimate("")).toBe(0);
  });

  it("非ASCIIの係数を変えられる", () => {
    const estimate = createEstimator(1);
    expect(estimate("日本")).toBe(2);
  });
});

describe("estimateMessages", () => {
  it("役割の分・content・reasoning・toolCallsを足す", () => {
    const estimate = createEstimator();
    const messages: Message[] = [
      { role: "system", content: "abcdefgh" },
      { role: "user", content: "日本語" },
      {
        role: "assistant",
        content: "abcd",
        reasoning: "abcdefgh",
        toolCalls: [
          { id: "1", name: "read", arguments: '{"path":"a"}' },
          { id: "2", name: "grep", arguments: '{"q":1}' },
        ],
      },
    ];

    expect(estimateMessages(messages, estimate)).toBe(27);
  });

  it("contentが空でも役割の4トークンは数える", () => {
    const estimate = createEstimator();
    const messages: Message[] = [
      { role: "tool", toolCallId: "1", content: "" },
    ];
    expect(estimateMessages(messages, estimate)).toBe(4);
  });
});
