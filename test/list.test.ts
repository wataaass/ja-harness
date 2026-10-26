import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createListTool } from "../src/tools/list.js";

function setup(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "ja-harness-list-"));
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

function list(cwd: string, args: unknown): Promise<string> {
  return createListTool(cwd).execute(args);
}

const TREE = {
  ".git/config": "",
  "a/x.ts": "x\n",
  "node_modules/pkg/index.js": "x\n",
  "b.txt": "b\n",
};

describe("list", () => {
  it("木の形で並べ、ディレクトリを先にする", async () => {
    const cwd = setup(TREE);
    expect(await list(cwd, {})).toBe(
      [
        ".git/ (skipped)",
        "a/",
        "  x.ts",
        "node_modules/ (skipped)",
        "b.txt",
      ].join("\n"),
    );
  });

  it("depth で深さを変える", async () => {
    const cwd = setup(TREE);
    expect(await list(cwd, { depth: 1 })).toBe(
      [".git/ (skipped)", "a/", "node_modules/ (skipped)", "b.txt"].join("\n"),
    );
    expect(await list(cwd, { depth: 3 })).toContain("  x.ts");
  });

  it("ファイルならそのパスだけを返す", async () => {
    const cwd = setup(TREE);
    expect(await list(cwd, { path: "b.txt" })).toBe("b.txt");
  });

  it("無いパスならエラーにする", async () => {
    const cwd = setup(TREE);
    await expect(list(cwd, { path: "nope" })).rejects.toThrow(
      "list: path not found: nope",
    );
  });

  it("500項目を超えたら打ち切る", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 501; i += 1) {
      files[`f${String(i).padStart(3, "0")}.txt`] = "";
    }
    const cwd = setup(files);
    const out = await list(cwd, { depth: 1 });
    const lines = out.split("\n");
    expect(lines).toHaveLength(501);
    expect(lines[0]).toBe("f000.txt");
    expect(lines[499]).toBe("f499.txt");
    expect(lines[500]).toBe("… 1 more entries not shown");
  });

  it("引数の型が違えば英語のエラーを投げる", async () => {
    const cwd = setup(TREE);
    await expect(list(cwd, { depth: 6 })).rejects.toThrow(
      'list: "depth" must be an integer from 1 to 5',
    );
  });
});
