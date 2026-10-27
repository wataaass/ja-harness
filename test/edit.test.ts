import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Confirm } from "../src/tools/confirm.js";
import { applyEdits, createEditTool } from "../src/tools/edit.js";

function setup(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "ja-harness-edit-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("applyEdits", () => {
  it("1回だけ現れる oldText を置き換える", () => {
    const result = applyEdits("a\nb\nc\n", [{ oldText: "b", newText: "B" }]);
    expect(result.text).toBe("a\nB\nc\n");
    expect(result.changed).toEqual([{ start: 2, end: 3 }]);
  });

  it("0回なら oldText not found を投げる", () => {
    expect(() =>
      applyEdits("a\nb\n", [{ oldText: "zzz", newText: "x" }]),
    ).toThrow("oldText not found");
  });

  it("2回以上なら replaceAll を案内して投げる", () => {
    expect(() =>
      applyEdits("x\nx\n", [{ oldText: "x", newText: "y" }]),
    ).toThrow(
      "oldText found 2 times; add more surrounding lines or set replaceAll",
    );
  });

  it("replaceAll ですべて置き換える", () => {
    const result = applyEdits("x x x", [
      { oldText: "x", newText: "y", replaceAll: true },
    ]);
    expect(result.text).toBe("y y y");
    expect(result.changed).toHaveLength(3);
  });

  it("空の oldText は投げる", () => {
    expect(() => applyEdits("a", [{ oldText: "", newText: "b" }])).toThrow(
      "oldText must not be empty",
    );
  });

  it("字下げの違いを無視して一致させる", () => {
    const before = "function a() {\n  return 1;\n}\n";
    const after = "function a() {\n  return 2;\n}\n";
    const result = applyEdits(before, [
      {
        oldText: "function a() {\nreturn 1;\n}",
        newText: "function a() {\n  return 2;\n}",
      },
    ]);
    expect(result.text).toBe(after);
  });

  it("行末の空白の違いを無視して一致させる", () => {
    const result = applyEdits("a\nb\nc\n", [{ oldText: "b   ", newText: "B" }]);
    expect(result.text).toBe("a\nB\nc\n");
  });

  it("ゆるい一致で改行で終わる oldText を置き換えても改行が増えない", () => {
    const result = applyEdits("a\nb\nc\n", [
      { oldText: "a\nb \n", newText: "A\nB\n" },
    ]);
    expect(result.text).toBe("A\nB\nc\n");
  });

  it("見つからないときは似た行の番号を出す", () => {
    const text = "const a = 1;\nconst b = 2;\nconst a = 1;\n";
    expect(() =>
      applyEdits(text, [
        { oldText: "const a = 1;\nconst c = 3;", newText: "x" },
      ]),
    ).toThrow("similar lines: 1, 3");
  });
});

describe("edit tool", () => {
  it("複数の edits の途中で失敗したらファイルを変えない", async () => {
    const cwd = setup({ "a.txt": "a\nb\n" });
    const confirm = vi.fn<Confirm>(async () => true);

    await expect(
      createEditTool(cwd, confirm).execute({
        path: "a.txt",
        edits: [
          { oldText: "a", newText: "A" },
          { oldText: "zzz", newText: "Z" },
        ],
      }),
    ).rejects.toThrow("oldText not found");
    expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe("a\nb\n");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("CRLF を保ったまま書き戻す", async () => {
    const cwd = setup({ "a.txt": "a\r\nb\r\n" });
    const confirm = vi.fn<Confirm>(async () => true);

    const result = await createEditTool(cwd, confirm).execute({
      path: "a.txt",
      edits: [{ oldText: "b", newText: "B" }],
    });

    expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe("a\r\nB\r\n");
    expect(result).toContain("Edited a.txt: 1 replacement(s).");
    expect(result).toContain("2\tB");
    expect(confirm).toHaveBeenCalledWith({
      tool: "edit",
      title: "a.txt を編集します",
      detail: ["@@ line 1 @@", " a", "-b", "+B"].join("\n"),
    });
  });

  it("断られたらファイルを変えない", async () => {
    const cwd = setup({ "a.txt": "a\nb\n" });
    const confirm = vi.fn<Confirm>(async () => false);

    const result = await createEditTool(cwd, confirm).execute({
      path: "a.txt",
      edits: [{ oldText: "b", newText: "B" }],
    });

    expect(result).toBe(
      "The user declined this edit. Ask what they want instead.",
    );
    expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe("a\nb\n");
  });

  it("結果に変わった部分の前後3行を付ける", async () => {
    const cwd = setup({
      "a.txt": "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\n",
    });
    const confirm = vi.fn<Confirm>(async () => true);

    const result = await createEditTool(cwd, confirm).execute({
      path: "a.txt",
      edits: [{ oldText: "l5", newText: "L5" }],
    });

    expect(result).toBe(
      [
        "Edited a.txt: 1 replacement(s).",
        "2\tl2",
        "3\tl3",
        "4\tl4",
        "5\tL5",
        "6\tl6",
        "7\tl7",
        "8\tl8",
      ].join("\n"),
    );
  });

  it("ファイルが無ければ write を案内する", async () => {
    const cwd = setup({});
    const confirm = vi.fn<Confirm>(async () => true);

    await expect(
      createEditTool(cwd, confirm).execute({
        path: "missing.txt",
        edits: [{ oldText: "a", newText: "b" }],
      }),
    ).rejects.toThrow("file not found; use write to create it");
  });

  it("結果が60行を超えたら省略する", async () => {
    const names = Array.from(
      { length: 100 },
      (_, i) => `line-${String(i + 1).padStart(3, "0")}`,
    );
    const cwd = setup({ "a.txt": names.join("\n") });
    const confirm = vi.fn<Confirm>(async () => true);

    const result = await createEditTool(cwd, confirm).execute({
      path: "a.txt",
      edits: names.map((name) => ({ oldText: name, newText: `${name}!` })),
    });
    const lines = result.split("\n");

    expect(lines).toHaveLength(62);
    expect(lines[lines.length - 1]).toBe("…");
  });
});

describe("edit tool の却下の理由", () => {
  it("理由を結果の末尾に付ける", async () => {
    const cwd = setup({ "a.txt": "a\nb\n" });
    const confirm = vi.fn<Confirm>(async () => ({
      allow: false,
      reason: "別の直し方にして",
    }));

    const result = await createEditTool(cwd, confirm).execute({
      path: "a.txt",
      edits: [{ oldText: "b", newText: "B" }],
    });

    expect(result).toBe(
      "The user declined this edit. Ask what they want instead.\nReason from the user: 別の直し方にして",
    );
    expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe("a\nb\n");
  });
});
