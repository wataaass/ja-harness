import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Confirm } from "../src/tools/confirm.js";
import { createWriteTool } from "../src/tools/write.js";

function setup(): string {
  return mkdtempSync(join(tmpdir(), "ja-harness-write-"));
}

describe("write", () => {
  it("新しいファイルを作る", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);
    const result = await createWriteTool(cwd, confirm).execute({
      path: "a.txt",
      content: "one\ntwo\n",
    });

    expect(result).toBe("Created a.txt (2 lines).");
    expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe("one\ntwo\n");
    expect(confirm).toHaveBeenCalledWith({
      tool: "write",
      title: "Write a.txt (2 lines)",
      detail: "one\ntwo",
    });
  });

  it("親のフォルダが無ければ作る", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);
    await createWriteTool(cwd, confirm).execute({
      path: "dir/sub/a.txt",
      content: "a\n",
    });

    expect(readFileSync(join(cwd, "dir/sub/a.txt"), "utf8")).toBe("a\n");
  });

  it("既にあるファイルでは失敗する", async () => {
    const cwd = setup();
    writeFileSync(join(cwd, "a.txt"), "old\n");
    const confirm = vi.fn<Confirm>(async () => true);

    await expect(
      createWriteTool(cwd, confirm).execute({ path: "a.txt", content: "x" }),
    ).rejects.toThrow("file exists; use edit to change it");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("断られたら作らない", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => false);
    const result = await createWriteTool(cwd, confirm).execute({
      path: "a.txt",
      content: "x\n",
    });

    expect(result).toBe(
      "The user declined this write. Ask what they want instead.",
    );
    expect(existsSync(join(cwd, "a.txt"))).toBe(false);
  });

  it("40行を超える内容は途中まで見せる", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);
    const content = Array.from({ length: 45 }, (_, i) => `l${i + 1}`).join(
      "\n",
    );

    await createWriteTool(cwd, confirm).execute({ path: "a.txt", content });

    const request = confirm.mock.calls[0]?.[0];
    expect(request?.title).toBe("Write a.txt (45 lines)");
    expect(request?.detail).toContain("l40");
    expect(request?.detail).not.toContain("l41");
    expect(request?.detail).toContain("…5 more lines");
  });
});

describe("write の却下の理由", () => {
  it("理由を結果の末尾に付ける", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => ({
      allow: false,
      reason: "名前を変えて",
    }));

    const result = await createWriteTool(cwd, confirm).execute({
      path: "a.txt",
      content: "x\n",
    });

    expect(result).toBe(
      "The user declined this write. Ask what they want instead.\nReason from the user: 名前を変えて",
    );
    expect(existsSync(join(cwd, "a.txt"))).toBe(false);
  });
});

describe("write tool の beforeWrite", () => {
  it("書く直前に呼ばれ、そのときファイルはまだ無い", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-write-"));
    const seen: boolean[] = [];
    const confirm = vi.fn<Confirm>(async () => true);

    await createWriteTool(cwd, confirm, (abs) => {
      seen.push(existsSync(abs));
    }).execute({ path: "a.txt", content: "hi\n" });

    expect(seen).toEqual([false]);
    expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe("hi\n");
  });
});
