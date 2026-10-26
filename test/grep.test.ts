import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrepTool,
  grepInNode,
  grepWithRipgrep,
} from "../src/tools/grep.js";

function hasRipgrep(): boolean {
  try {
    execFileSync("rg", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const RG = hasRipgrep();

function setup(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "ja-harness-grep-"));
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

const CONTEXT_FILE = "l1\nmatch\nl3\nl4\nl5\nl6\nmatch\nl8\n";

const CONTEXT_OUTPUT = [
  "a.txt-1-l1",
  "a.txt:2:match",
  "a.txt-3-l3",
  "--",
  "a.txt-6-l6",
  "a.txt:7:match",
  "a.txt-8-l8",
].join("\n");

const engines = [
  { name: "grepInNode", run: grepInNode, skip: false },
  { name: "grepWithRipgrep", run: grepWithRipgrep, skip: !RG },
];

describe.each(engines)("$name", ({ run, skip }) => {
  it.skipIf(skip)("一致した行と前後の行を -- で区切って返す", async () => {
    const cwd = setup({ "a.txt": CONTEXT_FILE });
    expect(
      await run(cwd, { pattern: "match", path: "a.txt", context: 1 }),
    ).toBe(CONTEXT_OUTPUT);
  });

  it.skipIf(skip)("glob でファイル名を絞る", async () => {
    const cwd = setup({
      "a.ts": "target\n",
      "b.js": "target\n",
    });
    expect(await run(cwd, { pattern: "target", glob: "*.ts" })).toBe(
      "a.ts:1:target",
    );
  });

  it.skipIf(skip)("ignoreCase を反映する", async () => {
    const cwd = setup({ "a.txt": "Hello\n" });
    expect(
      await run(cwd, {
        pattern: "hello",
        path: "a.txt",
        context: 0,
        ignoreCase: true,
      }),
    ).toBe("a.txt:1:Hello");
    expect(
      await run(cwd, { pattern: "hello", path: "a.txt", context: 0 }),
    ).toBe("No matches.");
  });

  it.skipIf(skip)("名前に -数字- を含むファイルでも壊れない", async () => {
    const cwd = setup({ "a-2-b.txt": "match\n" });
    expect(
      await run(cwd, { pattern: "match", path: "a-2-b.txt", context: 0 }),
    ).toBe("a-2-b.txt:1:match");
  });

  it.skipIf(skip)(".ja-harness と dist の中を探さない", async () => {
    const cwd = setup({
      ".ja-harness/a.txt": "target\n",
      "dist/b.txt": "target\n",
      "keep.txt": "target\n",
    });
    expect(await run(cwd, { pattern: "target", context: 0 })).toBe(
      "keep.txt:1:target",
    );
  });

  it.skipIf(skip)("一致がなければ No matches. を返す", async () => {
    const cwd = setup({ "a.txt": "alpha\nbeta\n" });
    expect(await run(cwd, { pattern: "gamma" })).toBe("No matches.");
  });

  it.skipIf(skip)("200行を超えたら打ち切る", async () => {
    const lines = Array.from({ length: 250 }, (_, i) => `hit ${i + 1}`);
    const cwd = setup({ "a.txt": `${lines.join("\n")}\n` });
    const out = await run(cwd, {
      pattern: "hit",
      path: "a.txt",
      context: 0,
    });
    const output = out.split("\n");
    expect(output).toHaveLength(201);
    expect(output[0]).toBe("a.txt:1:hit 1");
    expect(output[199]).toBe("a.txt:200:hit 200");
    expect(output[200]).toBe(
      "… more matches not shown; narrow the pattern or path",
    );
  });

  it.skipIf(skip)("不正な正規表現ならエラーにする", async () => {
    const cwd = setup({ "a.txt": "alpha\n" });
    await expect(run(cwd, { pattern: "(" })).rejects.toThrow();
  });
});

describe("grepInNode", () => {
  it("ルートの .gitignore にある単純な名前を飛ばす", async () => {
    const cwd = setup({
      ".gitignore": "ignored.txt\nbuild\n*.log\n",
      "ignored.txt": "target\n",
      "build/a.txt": "target\n",
      "keep.txt": "target\n",
    });
    expect(await grepInNode(cwd, { pattern: "target" })).toBe(
      "keep.txt:1:target",
    );
  });
});

describe("2つの検索の一致", () => {
  it.skipIf(!RG)("同じファイルでは同じ出力になる", async () => {
    const cwd = setup({ "a.txt": CONTEXT_FILE });
    const args = { pattern: "match", path: "a.txt", context: 1 };
    expect(await grepInNode(cwd, args)).toBe(await grepWithRipgrep(cwd, args));
  });
});

describe("createGrepTool", () => {
  it("useRipgrep: false なら Node の検索を使う", async () => {
    const cwd = setup({ "a.txt": "match\n" });
    const tool = createGrepTool(cwd, { useRipgrep: false });
    expect(tool.name).toBe("grep");
    expect(await tool.execute({ pattern: "match" })).toBe("a.txt:1:match");
  });

  it("引数の型が違えば英語のエラーを投げる", async () => {
    const cwd = setup({ "a.txt": "match\n" });
    const tool = createGrepTool(cwd, { useRipgrep: false });
    await expect(tool.execute({ pattern: 1 })).rejects.toThrow(
      'grep: "pattern" must be a string',
    );
  });
});
