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

  it("起動時の値を使う", () => {
    expect(SYSTEM_PROMPT).toBe(systemPrompt(process.platform));
  });
});
