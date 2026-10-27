import { describe, expect, it } from "vitest";
import { summarizeEnd, summarizeStart } from "../src/ui/tool-summary.js";

describe("summarizeStart", () => {
  it("道具ごとの要点を返す", () => {
    expect(summarizeStart("read", { paths: ["a.ts", "b.ts"] })).toBe(
      "a.ts, b.ts",
    );
    expect(summarizeStart("list", {})).toBe(".");
    expect(summarizeStart("list", { path: "src" })).toBe("src");
    expect(summarizeStart("grep", { pattern: "AppError" })).toBe("AppError");
    expect(summarizeStart("grep", { pattern: "AppError", path: "src" })).toBe(
      "AppError src",
    );
    expect(summarizeStart("edit", { path: "a.ts" })).toBe("a.ts");
    expect(summarizeStart("write", { path: "b.ts" })).toBe("b.ts");
    expect(summarizeStart("shell", { command: "npm test\necho done" })).toBe(
      "npm test",
    );
  });
});

describe("summarizeEnd", () => {
  it("read は結果の行数", () => {
    expect(
      summarizeEnd("read", "== src/a.ts (lines 1-20 of 120)\n1\ta", false),
    ).toBe("（120行）");
  });

  it("grep は一致の行数", () => {
    const result = [
      "src/a.ts:1:AppError",
      "src/a.ts-2-context",
      "src/b.ts:9:AppError",
    ].join("\n");
    expect(summarizeEnd("grep", result, false)).toBe("2件");
    expect(summarizeEnd("grep", "No matches.", false)).toBe("0件");
  });

  it("shell は終了コード", () => {
    expect(summarizeEnd("shell", "ok\n[exit code 0]", false)).toBe("終了 0");
  });

  it("edit は置換の数", () => {
    expect(summarizeEnd("edit", "Edited a.ts: 3 replacement(s).", false)).toBe(
      "3 か所",
    );
  });

  it("write は行数", () => {
    expect(summarizeEnd("write", "Created a.ts (45 lines).", false)).toBe(
      "45行",
    );
  });

  it("失敗なら結果の1行目の先頭50字", () => {
    const first = "x".repeat(60);
    expect(summarizeEnd("read", `${first}\nnext`, true)).toBe("x".repeat(50));
  });
});
