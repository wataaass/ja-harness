import { describe, expect, it } from "vitest";
import {
  blockedToolMessage,
  modeAllowsTool,
  modeLabel,
  modeNotice,
  nextMode,
  parseMode,
} from "../src/ui/modes.js";

describe("modes", () => {
  it("Shift+Tab の順に回る", () => {
    expect(nextMode("run")).toBe("plan");
    expect(nextMode("plan")).toBe("ask");
    expect(nextMode("ask")).toBe("run");
  });

  it("表示名と直接の指定を読む", () => {
    expect(modeLabel("run")).toBe("Agent");
    expect(modeLabel("plan")).toBe("Plan");
    expect(modeLabel("ask")).toBe("Ask");
    expect(parseMode("Plan")).toBe("plan");
    expect(parseMode("ask")).toBe("ask");
    expect(parseMode("Agent")).toBe("run");
    expect(parseMode("その他")).toBeUndefined();
  });

  it("モードごとの英語の notice を返す", () => {
    expect(modeNotice("run")).toContain("Run mode");
    expect(modeNotice("plan")).toContain("submit_plan");
    expect(modeNotice("ask")).toContain("Ask mode");
  });

  it("Plan と Ask では編集・作成・シェルを断る", () => {
    expect(modeAllowsTool("run", "edit")).toBe(true);
    expect(modeAllowsTool("plan", "edit")).toBe(false);
    expect(modeAllowsTool("plan", "write")).toBe(false);
    expect(modeAllowsTool("plan", "shell")).toBe(false);
    expect(modeAllowsTool("plan", "read")).toBe(true);
    expect(modeAllowsTool("ask", "shell")).toBe(false);
    expect(blockedToolMessage("plan")).toBe(
      "Not allowed in plan mode. Only read, list and grep are allowed.",
    );
  });
});
