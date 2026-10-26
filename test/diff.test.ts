import { describe, expect, it } from "vitest";
import { formatDiff } from "../src/tools/diff.js";

describe("formatDiff", () => {
  it("1行の変更を前後の文脈付きで出す", () => {
    expect(formatDiff("a.txt", "a\nb\nc\n", "a\nB\nc\n")).toBe(
      ["@@ line 1 @@", " a", "-b", "+B", " c"].join("\n"),
    );
  });

  it("行の追加を出す", () => {
    expect(formatDiff("a.txt", "a\nc\n", "a\nb\nc\n")).toBe(
      ["@@ line 1 @@", " a", "+b", " c"].join("\n"),
    );
  });

  it("行の削除を出す", () => {
    expect(formatDiff("a.txt", "a\nb\nc\n", "a\nc\n")).toBe(
      ["@@ line 1 @@", " a", "-b", " c"].join("\n"),
    );
  });

  it("先頭と末尾の共通部分は省略する", () => {
    const before = "1\n2\n3\n4\n5\n6\n7\n8\n9\n";
    const after = "1\n2\n3\n4\nX\n6\n7\n8\n9\n";
    expect(formatDiff("a.txt", before, after)).toBe(
      ["@@ line 3 @@", " 3", " 4", "-5", "+X", " 6", " 7"].join("\n"),
    );
  });

  it("変わらなければ空文字を返す", () => {
    expect(formatDiff("a.txt", "a\nb\n", "a\nb\n")).toBe("");
  });
});
