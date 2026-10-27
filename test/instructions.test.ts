import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findInstructionFiles,
  formatInstructions,
  loadInstructions,
} from "../src/agent/instructions.js";

function existsIn(paths: string[]): (path: string) => boolean {
  return (path) => paths.includes(path);
}

describe("findInstructionFiles", () => {
  it("AGENTS.md があれば CLAUDE.md を読まない", () => {
    const cwd = "/work";
    const home = "/home/me";
    const agents = join(cwd, "AGENTS.md");
    const claude = join(cwd, "CLAUDE.md");

    expect(
      findInstructionFiles({
        cwd,
        home,
        exists: existsIn([agents, claude]),
      }),
    ).toEqual([agents]);
  });

  it("AGENTS.md がなければ CLAUDE.md を読む", () => {
    const cwd = "/work";
    const home = "/home/me";
    const claude = join(cwd, "CLAUDE.md");

    expect(
      findInstructionFiles({ cwd, home, exists: existsIn([claude]) }),
    ).toEqual([claude]);
  });

  it("JA_HARNESS.md は別に読む", () => {
    const cwd = "/work";
    const home = "/home/me";
    const agents = join(cwd, "AGENTS.md");
    const harness = join(cwd, "JA_HARNESS.md");

    expect(
      findInstructionFiles({ cwd, home, exists: existsIn([agents, harness]) }),
    ).toEqual([agents, harness]);
  });

  it("個人のフォルダを作業フォルダより先に読む", () => {
    const cwd = "/work";
    const home = "/home/me";
    const personal = join(home, ".ja-harness", "AGENTS.md");
    const project = join(cwd, "CLAUDE.md");

    expect(
      findInstructionFiles({
        cwd,
        home,
        exists: existsIn([personal, project]),
      }),
    ).toEqual([personal, project]);
  });
});

describe("formatInstructions", () => {
  it("ファイルがなければ空文字", () => {
    expect(formatInstructions([])).toEqual({ text: "", truncated: false });
  });

  it("見出しとラベルを付ける", () => {
    const result = formatInstructions([
      {
        path: "/home/me/.ja-harness/AGENTS.md",
        label: "~/.ja-harness/AGENTS.md",
        text: "個人",
      },
      { path: "/work/AGENTS.md", label: "AGENTS.md", text: "作業" },
    ]);

    expect(result.truncated).toBe(false);
    expect(result.text).toBe(
      "\n\n# User instructions\nFollow these instructions from the user's files.\n\n## ~/.ja-harness/AGENTS.md\n個人\n\n## AGENTS.md\n作業",
    );
  });

  it("maxChars を超えると切って truncated にする", () => {
    const result = formatInstructions(
      [{ path: "/work/AGENTS.md", label: "AGENTS.md", text: "a".repeat(100) }],
      40,
    );

    expect(result.truncated).toBe(true);
    expect(result.text.endsWith("\n[truncated]")).toBe(true);
    expect(result.text.length).toBe(40 + "\n[truncated]".length);
  });
});

describe("loadInstructions", () => {
  it("中身を読み、改行と前後の空白をそろえる", () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      mkdirSync(join(home, ".ja-harness"), { recursive: true });
      writeFileSync(
        join(home, ".ja-harness", "AGENTS.md"),
        " 個人\r\nです \r\n",
      );
      writeFileSync(join(cwd, "AGENTS.md"), "作業\nです\n");

      const result = loadInstructions({ cwd, home });

      expect(result.labels).toEqual(["~/.ja-harness/AGENTS.md", "AGENTS.md"]);
      expect(result.truncated).toBe(false);
      expect(result.text).toContain("## ~/.ja-harness/AGENTS.md\n個人\nです");
      expect(result.text).toContain("## AGENTS.md\n作業\nです");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("空のファイルは飛ばす", () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeFileSync(join(cwd, "AGENTS.md"), " \n ");

      expect(loadInstructions({ cwd, home })).toEqual({
        text: "",
        labels: [],
        truncated: false,
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
