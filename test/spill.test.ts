import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createFileSaver, limitToolResult } from "../src/context/spill.js";
import type { Estimator } from "../src/context/tokens.js";
import { createEstimator } from "../src/context/tokens.js";

const chars: Estimator = (text) => Array.from(text).length;

function numberedLines(count: number, errorAt: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (i === errorAt) {
      lines.push("ERROR: failed to open the file");
    } else {
      lines.push(`line ${i}`);
    }
  }
  return lines.join("\n");
}

describe("limitToolResult", () => {
  it("上限以下ならそのまま返し、save を呼ばない", () => {
    const save = vi.fn(() => "/tmp/full.txt");
    const text = "short result";
    const out = limitToolResult(text, {
      maxTokens: 100,
      estimate: chars,
      save,
    });
    expect(out).toBe(text);
    expect(save).not.toHaveBeenCalled();
  });

  it("上限を超えたら先頭・印・大事な行・末尾の形にする", () => {
    const save = vi.fn(() => "/tmp/full.txt");
    const text = numberedLines(100, 50);
    const out = limitToolResult(text, {
      maxTokens: 500,
      estimate: chars,
      save,
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(text);
    expect(out.startsWith("line 0\n")).toBe(true);
    expect(out.endsWith("line 99")).toBe(true);
    expect(out).toContain(
      "[Full output (100 lines): /tmp/full.txt. Read it with a line range or grep.]",
    );
    expect(out).toContain(
      "lines omitted. Important lines from the omitted part:]",
    );
    expect(out).toContain("ERROR: failed to open the file");
    expect(chars(out)).toBeLessThanOrEqual(500);
  });

  it("大事な行がなければ見出しを出さない", () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    const out = limitToolResult(text, {
      maxTokens: 500,
      estimate: chars,
      save: () => "/tmp/full.txt",
    });

    expect(out).not.toContain("Important lines");
    expect(out).not.toContain("lines omitted");
    expect(chars(out)).toBeLessThanOrEqual(500);
  });

  it("改行のない長い1行でも maxTokens 以下にする", () => {
    const text = JSON.stringify({ data: "x".repeat(10000) });
    const out = limitToolResult(text, {
      maxTokens: 200,
      estimate: chars,
      save: () => "/tmp/full.txt",
    });

    expect(chars(out)).toBeLessThanOrEqual(200);
    expect(out).toContain("…");
    expect(out).toContain("[Full output (1 lines): /tmp/full.txt.");
  });

  it("日本語の行でも maxTokens 以下にする", () => {
    const estimate = createEstimator();
    const text = "日本語の長い結果です。".repeat(100);
    const out = limitToolResult(text, {
      maxTokens: 100,
      estimate,
      save: () => "/tmp/full.txt",
    });

    expect(estimate(out)).toBeLessThanOrEqual(100);
    expect(out).toContain("…");
  });
});

describe("createFileSaver", () => {
  it("save を呼ぶまでフォルダを作らない", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-spill-"));
    const dir = join(root, "out");

    createFileSaver(dir, () => 1234);
    expect(existsSync(dir)).toBe(false);
  });

  it("フォルダを作り、全文を書いて、連番を増やす", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-spill-"));
    const dir = join(root, "out");
    const saver = createFileSaver(dir, () => 1234);

    const first = saver("1つ目\n全文");
    const second = saver("2つ目");

    expect(first).toBe(join(dir, "1234-001.txt"));
    expect(second).toBe(join(dir, "1234-002.txt"));
    expect(readFileSync(first, "utf8")).toBe("1つ目\n全文");
    expect(readFileSync(second, "utf8")).toBe("2つ目");
  });
});
