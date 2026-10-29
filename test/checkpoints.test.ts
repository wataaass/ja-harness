import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCheckpoints } from "../src/ui/checkpoints.js";

function setup(): string {
  return mkdtempSync(join(tmpdir(), "ja-harness-checkpoints-"));
}

describe("createCheckpoints", () => {
  it("元のあるファイルを戻す", () => {
    const cwd = setup();
    const path = join(cwd, "a.txt");
    writeFileSync(path, "old\n");
    const checkpoints = createCheckpoints();

    checkpoints.beginTurn();
    checkpoints.recordBefore(path);
    writeFileSync(path, "new\n");

    expect(checkpoints.changedFiles()).toEqual([{ path, before: "old\n" }]);
    expect(checkpoints.undo()).toEqual({
      restored: [path],
      deleted: [],
    });
    expect(readFileSync(path, "utf8")).toBe("old\n");
  });

  it("元がなかったファイルは消す", () => {
    const cwd = setup();
    const path = join(cwd, "b.txt");
    const checkpoints = createCheckpoints();

    checkpoints.beginTurn();
    checkpoints.recordBefore(path);
    writeFileSync(path, "new\n");

    expect(checkpoints.changedFiles()).toEqual([{ path, before: null }]);
    expect(checkpoints.undo()).toEqual({
      restored: [],
      deleted: [path],
    });
    expect(existsSync(path)).toBe(false);
  });

  it("2つのやりとりを新しい順に戻す", () => {
    const cwd = setup();
    const a = join(cwd, "a.txt");
    const b = join(cwd, "b.txt");
    writeFileSync(a, "a1\n");
    writeFileSync(b, "b1\n");
    const checkpoints = createCheckpoints();

    checkpoints.beginTurn();
    checkpoints.recordBefore(a);
    writeFileSync(a, "a2\n");

    checkpoints.beginTurn();
    checkpoints.recordBefore(b);
    writeFileSync(b, "b2\n");

    expect(checkpoints.turns()).toBe(2);
    expect(checkpoints.changedFiles(1)).toEqual([{ path: a, before: "a1\n" }]);
    const result = checkpoints.undo(2);

    expect([...result.restored].sort()).toEqual([a, b].sort());
    expect(checkpoints.turns()).toBe(0);
    expect(readFileSync(a, "utf8")).toBe("a1\n");
    expect(readFileSync(b, "utf8")).toBe("b1\n");
  });

  it("同じやりとりの中では最初の状態だけを覚える", () => {
    const cwd = setup();
    const path = join(cwd, "a.txt");
    writeFileSync(path, "first\n");
    const checkpoints = createCheckpoints();

    checkpoints.beginTurn();
    checkpoints.recordBefore(path);
    writeFileSync(path, "second\n");
    checkpoints.recordBefore(path);
    writeFileSync(path, "third\n");

    expect(checkpoints.changedFiles()).toEqual([{ path, before: "first\n" }]);
  });
});
