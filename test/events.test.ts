import { describe, expect, it } from "vitest";
import { formatToolStart } from "../src/cli/events.js";

describe("formatToolStart", () => {
  it("道具ごとの要点を出す", () => {
    expect(formatToolStart("read", { paths: ["a.ts", "b.ts"] })).toBe(
      "▸ read a.ts, b.ts",
    );
    expect(formatToolStart("list", { path: "src" })).toBe("▸ list src");
    expect(formatToolStart("list", {})).toBe("▸ list .");
    expect(formatToolStart("grep", { pattern: "TODO", path: "src" })).toBe(
      "▸ grep TODO src",
    );
    expect(formatToolStart("grep", { pattern: "TODO" })).toBe("▸ grep TODO");
    expect(formatToolStart("edit", { path: "a.ts" })).toBe("▸ edit a.ts");
    expect(formatToolStart("write", { path: "b.ts" })).toBe("▸ write b.ts");
    expect(formatToolStart("shell", { command: "npm test\nrm -rf x" })).toBe(
      "▸ shell npm test",
    );
  });

  it("60文字を超えたら59文字と…にする", () => {
    const line = formatToolStart("shell", { command: "x".repeat(70) });

    expect(line).toBe(`▸ shell ${"x".repeat(59)}…`);
    expect(Array.from(line.slice("▸ shell ".length))).toHaveLength(60);
  });

  it("想定外の args なら名前だけ", () => {
    expect(formatToolStart("read", null)).toBe("▸ read");
    expect(formatToolStart("read", { paths: "a.ts" })).toBe("▸ read");
    expect(formatToolStart("read", { paths: [1] })).toBe("▸ read");
    expect(formatToolStart("grep", {})).toBe("▸ grep");
    expect(formatToolStart("edit", { path: 3 })).toBe("▸ edit");
    expect(formatToolStart("shell", { command: 3 })).toBe("▸ shell");
    expect(formatToolStart("unknown", { anything: true })).toBe("▸ unknown");
  });
});
