import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Skill } from "../src/agent/skills.js";
import { createSkillTool } from "../src/tools/skill.js";

const dirs: string[] = [];

function makeSkill(): { skill: Skill; dir: string } {
  const base = mkdtempSync(join(tmpdir(), "ja-skill-tool-"));
  dirs.push(base);
  const dir = join(base, "demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    "---\nname: demo\ndescription: Demo skill.\n---\n本文\n",
  );
  writeFileSync(join(dir, "reference.md"), "参考\n");
  return {
    dir,
    skill: {
      name: "demo",
      description: "Demo skill.",
      dir,
      source: "project",
    },
  };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("createSkillTool", () => {
  it("知っている名前なら本文を返す", async () => {
    const { skill, dir } = makeSkill();
    const tool = createSkillTool([skill]);

    await expect(tool.execute({ name: "demo" })).resolves.toBe(
      `Skill folder: ${dir}\n本文`,
    );
    await expect(
      tool.execute({ name: "demo", file: "reference.md" }),
    ).resolves.toBe(`Skill folder: ${dir}\n参考\n`);
  });

  it("知らない名前なら使える名前を返す（エラーにしない）", async () => {
    const { skill } = makeSkill();
    const tool = createSkillTool([skill]);

    const result = await tool.execute({ name: "unknown" });
    expect(result).toContain('Unknown skill "unknown"');
    expect(result).toContain("demo");
  });
});
