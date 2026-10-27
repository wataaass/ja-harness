import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatSkillList,
  loadSkills,
  parseSkill,
  readSkillFile,
  type Skill,
} from "../src/agent/skills.js";

const dirs: string[] = [];

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function writeSkill(base: string, folder: string, text: string): string {
  const dir = join(base, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), text);
  return dir;
}

function skillText(name: string, description: string, body = "本文"): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n${body}\n`;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseSkill", () => {
  it("front matter から名前と説明と本文を読む", () => {
    expect(
      parseSkill(
        "---\nname: commit-message\ndescription: Write a commit message.\n---\n本文\n二行目\n",
      ),
    ).toEqual({
      name: "commit-message",
      description: "Write a commit message.",
      body: "本文\n二行目",
    });
  });

  it("囲む引用符を外す", () => {
    expect(
      parseSkill(
        `---\nname: "quoted"\ndescription: 'Quoted description.'\n---\nbody\n`,
      ),
    ).toEqual({
      name: "quoted",
      description: "Quoted description.",
      body: "body",
    });
  });

  it("複数行の説明を空白1つでつなぐ", () => {
    expect(
      parseSkill(
        "---\nname: folded\ndescription: >\n  First line\n  second line\n---\nbody\n",
      )?.description,
    ).toBe("First line second line");
    expect(
      parseSkill(
        "---\nname: literal\ndescription: |\n  First line\n  second line\n---\nbody\n",
      )?.description,
    ).toBe("First line second line");
    expect(
      parseSkill(
        "---\nname: plain\ndescription: First line\n  second line\n---\nbody\n",
      )?.description,
    ).toBe("First line second line");
  });

  it("front matter がないものや名前・説明がないものは undefined", () => {
    expect(parseSkill("本文だけ\n")).toBeUndefined();
    expect(parseSkill("---\nname: only\n---\nbody\n")).toBeUndefined();
    expect(parseSkill("---\ndescription: only\n---\nbody\n")).toBeUndefined();
  });
});

describe("loadSkills", () => {
  it("同じ名前は後のフォルダ（project）が勝ち、名前順に並べる", () => {
    const cwd = makeDir("ja-skills-cwd-");
    const home = makeDir("ja-skills-home-");
    const builtinDir = makeDir("ja-skills-builtin-");

    writeSkill(builtinDir, "same", skillText("same", "builtin"));
    writeSkill(builtinDir, "alpha", skillText("alpha", "Alpha."));
    writeSkill(
      join(home, ".ja-harness", "skills"),
      "same",
      skillText("same", "personal"),
    );
    writeSkill(
      join(cwd, ".ja-harness", "skills"),
      "same",
      skillText("same", "project"),
    );

    const result = loadSkills({
      cwd,
      home,
      builtinDir,
      disabled: [],
    });

    expect(result.skills.map((skill) => skill.name)).toEqual(["alpha", "same"]);
    expect(result.skills[1]).toMatchObject({
      description: "project",
      source: "project",
    });
    expect(result.disabled).toEqual([]);
  });

  it("disabled の名前は disabled に入れる", () => {
    const cwd = makeDir("ja-skills-cwd-");
    const home = makeDir("ja-skills-home-");
    const builtinDir = makeDir("ja-skills-builtin-");

    writeSkill(builtinDir, "on", skillText("on", "On."));
    writeSkill(builtinDir, "off", skillText("off", "Off."));

    const result = loadSkills({
      cwd,
      home,
      builtinDir,
      disabled: ["off"],
    });

    expect(result.skills.map((skill) => skill.name)).toEqual(["on"]);
    expect(result.disabled.map((skill) => skill.name)).toEqual(["off"]);
  });

  it("壊れた SKILL.md は飛ばす", () => {
    const cwd = makeDir("ja-skills-cwd-");
    const home = makeDir("ja-skills-home-");
    const builtinDir = makeDir("ja-skills-builtin-");

    writeSkill(builtinDir, "good", skillText("good", "Good."));
    writeSkill(builtinDir, "broken", "本文だけ\n");
    writeSkill(builtinDir, "missing", "---\nname: missing\n---\nbody\n");
    mkdirSync(join(builtinDir, "empty"), { recursive: true });

    const result = loadSkills({
      cwd,
      home,
      builtinDir,
      disabled: [],
    });

    expect(result.skills.map((skill) => skill.name)).toEqual(["good"]);
  });
});

describe("formatSkillList", () => {
  it("スキルがなければ空文字", () => {
    expect(formatSkillList([])).toBe("");
  });

  it("見出しと名前と説明を並べる", () => {
    const skills: Skill[] = [
      {
        name: "commit-message",
        description: "Write a commit message.",
        dir: "/skills/commit-message",
        source: "builtin",
      },
    ];

    expect(formatSkillList(skills)).toBe(
      "\n\n# Skills\nCall the skill tool with a name to read its instructions before doing a task it covers.\n- commit-message: Write a commit message.",
    );
  });
});

describe("readSkillFile", () => {
  it("SKILL.md の本文を返し、先頭にフォルダを付ける", () => {
    const dir = writeSkill(
      makeDir("ja-skills-read-"),
      "demo",
      skillText("demo", "Demo.", "本文\n二行目"),
    );
    const skill: Skill = {
      name: "demo",
      description: "Demo.",
      dir,
      source: "project",
    };

    expect(readSkillFile(skill)).toBe(`Skill folder: ${dir}\n本文\n二行目`);
  });

  it("スキルのフォルダのほかのファイルを読む", () => {
    const dir = writeSkill(
      makeDir("ja-skills-read-"),
      "demo",
      skillText("demo", "Demo."),
    );
    writeFileSync(join(dir, "reference.md"), "参考\n");
    const skill: Skill = {
      name: "demo",
      description: "Demo.",
      dir,
      source: "project",
    };

    expect(readSkillFile(skill, "reference.md")).toBe(
      `Skill folder: ${dir}\n参考\n`,
    );
  });

  it("フォルダの外のファイルは拒否する", () => {
    const base = makeDir("ja-skills-read-");
    writeFileSync(join(base, "secret.md"), "秘密\n");
    const dir = writeSkill(base, "demo", skillText("demo", "Demo."));
    const skill: Skill = {
      name: "demo",
      description: "Demo.",
      dir,
      source: "project",
    };

    expect(() => readSkillFile(skill, "../secret.md")).toThrow();
    expect(() => readSkillFile(skill, join(base, "secret.md"))).toThrow();
  });
});
