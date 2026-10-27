import { describe, expect, it } from "vitest";
import { applyHunks, computeHunks, formatHunk } from "../src/tools/hunks.js";

describe("computeHunks", () => {
  it("1つの変更を前後の文脈付きで返す", () => {
    expect(computeHunks("a\nb\nc\n", "a\nB\nc\n")).toEqual([
      {
        beforeStart: 1,
        removed: ["b"],
        added: ["B"],
        before: ["a"],
        after: ["c"],
      },
    ]);
  });

  it("離れた2つの変更を別のまとまりにする", () => {
    const hunks = computeHunks(
      "a\nb\nc\nd\ne\nf\ng\nh\ni\n",
      "a\nB\nc\nd\ne\nf\ng\nH\ni\n",
    );

    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.removed).toEqual(["b"]);
    expect(hunks[0]?.beforeStart).toBe(1);
    expect(hunks[1]?.removed).toEqual(["h"]);
    expect(hunks[1]?.beforeStart).toBe(6);
  });

  it("文脈が重なるくらい近い変更は1つにまとめる", () => {
    const hunks = computeHunks(
      "a\nb\nc\nd\ne\nf\ng\nh\n",
      "a\nb\nC\nd\ne\nF\ng\nh\n",
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.removed).toEqual(["c", "d", "e", "f"]);
    expect(hunks[0]?.added).toEqual(["C", "d", "e", "F"]);
    expect(hunks[0]?.before).toEqual(["a", "b"]);
    expect(hunks[0]?.after).toEqual(["g", "h"]);
  });

  it("追加だけの変更を返す", () => {
    const hunks = computeHunks("a\nc\n", "a\nb\nc\n");

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.removed).toEqual([]);
    expect(hunks[0]?.added).toEqual(["b"]);
    expect(applyHunks("a\nc\n", hunks, [true])).toBe("a\nb\nc\n");
  });

  it("削除だけの変更を返す", () => {
    const hunks = computeHunks("a\nb\nc\n", "a\nc\n");

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.removed).toEqual(["b"]);
    expect(hunks[0]?.added).toEqual([]);
    expect(applyHunks("a\nb\nc\n", hunks, [true])).toBe("a\nc\n");
  });

  it("採用したまとまりだけを反映する", () => {
    const before = "a\nb\nc\nd\ne\nf\ng\nh\ni\n";
    const after = "a\nB\nc\nd\ne\nf\ng\nH\ni\n";
    const hunks = computeHunks(before, after);

    expect(applyHunks(before, hunks, [true, false])).toBe(
      "a\nB\nc\nd\ne\nf\ng\nh\ni\n",
    );
    expect(applyHunks(before, hunks, [true, true])).toBe(after);
    expect(applyHunks(before, hunks, [false, false])).toBe(before);
  });

  it("4,000,000 を超える範囲は1つのまとまりにする", () => {
    const size = 2100;
    const before = Array.from({ length: size }, (_, i) => `a${i}`).join("\n");
    const after = Array.from({ length: size }, (_, i) => `b${i}`).join("\n");
    const hunks = computeHunks(before, after);

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.removed).toHaveLength(size);
    expect(hunks[0]?.added).toHaveLength(size);
  });
});

describe("formatHunk", () => {
  it("見出しと記号を付けて返す", () => {
    const hunk = computeHunks("a\nb\nc\n", "a\nB\nc\n")[0];
    if (hunk === undefined) {
      throw new Error("hunk がありません");
    }
    expect(formatHunk("a.txt", hunk, 0, 1)).toEqual([
      "@@ line 1 @@",
      " a",
      "-b",
      "+B",
      " c",
    ]);
  });
});
