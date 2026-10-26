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

describe("limitToolResult の性質", () => {
  it("300 通りの入力で、上限以下・全文のパス・最後の行を必ず保つ", () => {
    const estimate = createEstimator();
    const savedPath = "/tmp/full.txt";
    // 線形合同法 x = (x * 1103515245 + 12345) mod 2^31。Math.imul で桁あふれなく計算する
    let x = 42;
    const next = (): number => {
      x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff;
      return x / 0x80000000;
    };
    const asciiSource = "abcdefghijklmnopqrstuvwxyz 0123456789";
    const japaneseSource = "日本語の行".repeat(200);
    let checked = 0;

    for (let c = 0; c < 300; c += 1) {
      const useJapanese = c % 2 === 0;
      const sourceChars = Array.from(
        useJapanese
          ? japaneseSource
          : Array.from({ length: 900 }, () => {
              const pick = Math.floor(next() * asciiSource.length);
              return asciiSource.charAt(pick);
            }).join(""),
      );

      const lineCount = 1 + Math.floor(next() * 80);
      const lines: string[] = [];
      for (let i = 0; i < lineCount; i += 1) {
        const length = Math.floor(next() * 901);
        const body = sourceChars.slice(0, length).join("");
        const marker = next() < 0.15 ? "error " : "";
        lines.push(`L${i}: ${marker}${body}`);
      }

      const text = lines.join("\n");
      const maxTokens = 150 + Math.floor(next() * 2851);
      if (estimate(text) <= maxTokens) {
        continue;
      }

      checked += 1;
      const out = limitToolResult(text, {
        maxTokens,
        estimate,
        save: () => savedPath,
      });
      const footer = `[Full output (${lineCount} lines): ${savedPath}. Read it with a line range or grep.]`;

      expect(estimate(out)).toBeLessThanOrEqual(maxTokens);
      expect(out).toContain(footer);
      const afterFooter = out.slice(out.indexOf(footer) + footer.length);
      expect(afterFooter).toContain(`L${lineCount - 1}:`);
    }

    expect(checked).toBeGreaterThan(0);
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
