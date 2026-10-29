import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, systemPrompt } from "../src/agent/prompt.js";

describe("systemPrompt", () => {
  it("win32 では PowerShell を伝える", () => {
    const prompt = systemPrompt("win32");

    expect(prompt).toContain(
      "The shell tool runs Windows PowerShell; write PowerShell commands (no &&, /dev/null, head, grep).",
    );
  });

  it("linux では sh を伝える", () => {
    const prompt = systemPrompt("linux");

    expect(prompt).toContain("The shell tool runs Linux sh.");
  });

  it("darwin では macOS を伝える", () => {
    const prompt = systemPrompt("darwin");

    expect(prompt).toContain("The shell tool runs macOS sh.");
  });

  it("独立した道具の呼び出しを1回の応答にまとめるよう伝える", () => {
    const prompt = systemPrompt("linux");
    const sentence =
      "When tool calls do not depend on each other, make them all in one response.";

    expect(prompt).toContain(sentence);
    expect(prompt.indexOf(sentence)).toBeLessThan(
      prompt.indexOf("Read only the lines you need,"),
    );
  });

  it("起動時の値を使う", () => {
    expect(SYSTEM_PROMPT).toBe(systemPrompt(process.platform));
  });
});
