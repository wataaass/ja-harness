import { describe, expect, it } from "vitest";
import {
  applyMask,
  isMasked,
  maskCandidates,
  maskStub,
} from "../src/context/mask.js";
import type { Estimator } from "../src/context/tokens.js";
import type { Message, ToolCall } from "../src/llm/types.js";

const chars: Estimator = (text) => Array.from(text).length;

function call(id: string, name: string, args: unknown): ToolCall {
  return { id, name, arguments: JSON.stringify(args) };
}

function assistant(...calls: ToolCall[]): Message {
  return { role: "assistant", content: "", toolCalls: calls };
}

function tool(id: string, content: string): Message {
  return { role: "tool", toolCallId: id, content };
}

describe("maskStub", () => {
  it("read はパスと行の範囲を出す", () => {
    expect(
      maskStub(
        "read",
        JSON.stringify({ paths: ["src/a.ts"], offset: 10, limit: 20 }),
        123,
      ),
    ).toBe(
      "[Hidden to save tokens: read src/a.ts lines 10-29 (123 tokens). Call the tool again if you need it.]",
    );
    expect(
      maskStub(
        "read",
        JSON.stringify({ paths: ["a.ts"], start: 2, end: 4 }),
        5,
      ),
    ).toContain("read a.ts lines 2-4");
  });

  it("grep はパターンと場所を出す", () => {
    expect(
      maskStub("grep", JSON.stringify({ pattern: "TODO", path: "src" }), 7),
    ).toContain('grep "TODO" in src');
    expect(maskStub("grep", JSON.stringify({ pattern: "TODO" }), 7)).toContain(
      'grep "TODO" in .',
    );
  });

  it("list・shell・edit・write・mcp の形", () => {
    expect(maskStub("list", JSON.stringify({ path: "src" }), 1)).toContain(
      "list src",
    );
    expect(
      maskStub("shell", JSON.stringify({ command: "npm test" }), 1),
    ).toContain("shell: npm test");
    expect(maskStub("edit", JSON.stringify({ path: "src/a.ts" }), 1)).toContain(
      "edit src/a.ts",
    );
    expect(
      maskStub("write", JSON.stringify({ path: "src/b.ts" }), 1),
    ).toContain("write src/b.ts");
    expect(maskStub("mcp", JSON.stringify({ name: "echo" }), 1)).toContain(
      "mcp echo",
    );
  });

  it("shell の命令と知らない道具の引数は 80 字まで", () => {
    const long = "x".repeat(100);
    const shell = maskStub("shell", JSON.stringify({ command: long }), 1);
    expect(shell).toContain(`shell: ${"x".repeat(80)}`);
    expect(shell).not.toContain("x".repeat(81));
    const other = maskStub("custom", JSON.stringify({ value: long }), 1);
    expect(other).toContain(
      `custom ${JSON.stringify({ value: long }).slice(0, 80)}`,
    );
  });

  it("跡かどうかを判定する", () => {
    expect(
      isMasked(maskStub("read", JSON.stringify({ paths: ["a"] }), 1)),
    ).toBe(true);
    expect(isMasked("read a")).toBe(false);
    expect(isMasked("[Hidden to save tokens: x")).toBe(false);
  });
});

describe("maskCandidates", () => {
  function list(): Message[] {
    return [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
      assistant(call("1", "read", { paths: ["a.ts"] })),
      tool("1", "a".repeat(100)),
      assistant(call("2", "read", { paths: ["b.ts"] })),
      tool("2", "b".repeat(100)),
      assistant(call("3", "read", { paths: ["c.ts"] })),
      tool("3", "c".repeat(100)),
      { role: "assistant", content: "done" },
    ];
  }

  it("新しいほうから window 個は残す", () => {
    expect(
      maskCandidates(list(), { window: 1, minTokens: 1, estimate: chars }),
    ).toEqual([3, 5]);
    expect(
      maskCandidates(list(), { window: 5, minTokens: 1, estimate: chars }),
    ).toEqual([]);
  });

  it("最後の assistant より後ろの結果は対象にしない", () => {
    const messages: Message[] = [
      { role: "user", content: "u" },
      assistant(call("1", "read", { paths: ["a.ts"] })),
      tool("1", "a".repeat(100)),
    ];
    expect(
      maskCandidates(messages, { window: 0, minTokens: 1, estimate: chars }),
    ).toEqual([]);
  });

  it("小さい結果と skill は対象にしない", () => {
    const messages: Message[] = [
      { role: "user", content: "u" },
      assistant(call("1", "read", { paths: ["a.ts"] })),
      tool("1", "a".repeat(10)),
      assistant(call("2", "skill", { name: "x" })),
      tool("2", "a".repeat(100)),
      { role: "assistant", content: "done" },
    ];
    expect(
      maskCandidates(messages, { window: 0, minTokens: 20, estimate: chars }),
    ).toEqual([]);
  });

  it("すでに跡のものは対象にしない", () => {
    const messages: Message[] = [
      { role: "user", content: "u" },
      assistant(call("1", "read", { paths: ["a.ts"] })),
      tool("1", maskStub("read", JSON.stringify({ paths: ["a.ts"] }), 10)),
      { role: "assistant", content: "done" },
    ];
    expect(
      maskCandidates(messages, { window: 0, minTokens: 1, estimate: chars }),
    ).toEqual([]);
  });

  it("古くなった読み取りは window の中でも候補にする", () => {
    const messages: Message[] = [
      { role: "user", content: "u" },
      assistant(call("1", "read", { paths: ["a.ts"] })),
      tool("1", "a".repeat(100)),
      assistant(call("2", "edit", { path: "a.ts" })),
      tool("2", "ok"),
      { role: "assistant", content: "done" },
    ];
    expect(
      maskCandidates(messages, { window: 5, minTokens: 1, estimate: chars }),
    ).toEqual([2]);
  });

  it("edit がエラーなら古くならない", () => {
    const messages: Message[] = [
      { role: "user", content: "u" },
      assistant(call("1", "read", { paths: ["a.ts"] })),
      tool("1", "a".repeat(100)),
      assistant(call("2", "edit", { path: "a.ts" })),
      tool("2", "Error: failed"),
      { role: "assistant", content: "done" },
    ];
    expect(
      maskCandidates(messages, { window: 5, minTokens: 1, estimate: chars }),
    ).toEqual([]);
  });
});

describe("applyMask", () => {
  it("元の配列を変えず、節約した分と最初の位置を返す", () => {
    const messages: Message[] = [
      { role: "user", content: "u" },
      assistant(
        call("1", "read", { paths: ["a.ts"] }),
        call("2", "read", { paths: ["b.ts"] }),
      ),
      tool("1", "a".repeat(100)),
      tool("2", "b".repeat(100)),
      { role: "assistant", content: "done" },
    ];
    const first = messages[2];

    const result = applyMask(messages, [2, 3], chars);

    expect(result.messages).not.toBe(messages);
    expect(messages[2]).toBe(first);
    expect(
      (result.messages[2] as Extract<Message, { role: "tool" }>).content,
    ).toContain("[Hidden to save tokens: read a.ts");
    expect(result.savedTokens).toBeGreaterThan(0);
    expect(result.firstIndex).toBe(2);
  });
});
