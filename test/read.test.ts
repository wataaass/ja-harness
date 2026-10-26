import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createReadTool } from "../src/tools/read.js";

function setup(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), "ja-harness-read-"));
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

function read(cwd: string, args: unknown): Promise<string> {
  return createReadTool(cwd).execute(args);
}

describe("read", () => {
  it("行番号とタブを付けて返す", async () => {
    const cwd = setup({ "a.ts": 'import x from "y";\n\nexport {};\n' });
    expect(await read(cwd, { paths: ["a.ts"] })).toBe(
      [
        "== a.ts (lines 1-3 of 3)",
        '1\timport x from "y";',
        "2\t",
        "3\texport {};",
      ].join("\n"),
    );
  });

  it("offset と limit を反映し、残りがあれば案内を出す", async () => {
    const cwd = setup({ "a.txt": "l1\nl2\nl3\nl4\nl5\n" });
    expect(await read(cwd, { paths: ["a.txt"], offset: 2, limit: 2 })).toBe(
      [
        "== a.txt (lines 2-3 of 5)",
        "2\tl2",
        "3\tl3",
        "(2 more lines; use offset=4)",
      ].join("\n"),
    );
  });

  it("offset が行数を超えたら案内を返す", async () => {
    const cwd = setup({ "a.txt": "l1\nl2\n" });
    expect(await read(cwd, { paths: ["a.txt"], offset: 3 })).toBe(
      "== a.txt: offset 3 is past the end (2 lines)",
    );
  });

  it("2000文字を超える行を切る", async () => {
    const cwd = setup({ "long.txt": `${"x".repeat(2500)}\n` });
    const out = await read(cwd, { paths: ["long.txt"] });
    const body = out.split("\n")[1] ?? "";
    expect(body).toBe(`1\t${"x".repeat(2000)} …[cut]`);
  });

  it("見つからない・バイナリ・空ファイルを区別する", async () => {
    const cwd = setup({
      "bin.dat": Buffer.from([0x61, 0x00, 0x62]),
      "empty.txt": "",
    });
    expect(await read(cwd, { paths: ["missing.txt"] })).toBe(
      "== missing.txt: not found",
    );
    expect(await read(cwd, { paths: ["bin.dat"] })).toBe(
      "== bin.dat: binary file, 3 bytes",
    );
    expect(await read(cwd, { paths: ["empty.txt"] })).toBe(
      "== empty.txt (empty)",
    );
  });

  it("ディレクトリなら list を案内する", async () => {
    const cwd = setup({ "dir/a.txt": "a\n" });
    expect(await read(cwd, { paths: ["dir"] })).toBe(
      "== dir: is a directory; use list",
    );
  });

  it("失敗したパスがあっても他のパスは読む", async () => {
    const cwd = setup({ "a.txt": "a\n", "b.txt": "b\n" });
    expect(await read(cwd, { paths: ["a.txt", "nope.txt", "b.txt"] })).toBe(
      [
        "== a.txt (lines 1-1 of 1)",
        "1\ta",
        "== nope.txt: not found",
        "== b.txt (lines 1-1 of 1)",
        "1\tb",
      ].join("\n"),
    );
  });

  it("引数の型が違えば英語のエラーを投げる", async () => {
    const cwd = setup({ "a.txt": "a\n" });
    await expect(read(cwd, { paths: "a.txt" })).rejects.toThrow(
      'read: "paths" must be an array of 1 to 10 strings',
    );
    await expect(read(cwd, { paths: ["a.txt"], offset: 0 })).rejects.toThrow(
      'read: "offset" must be an integer of 1 or greater',
    );
  });
});
