import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type Skill = {
  name: string;
  description: string;
  dir: string;
  source: "builtin" | "personal" | "project";
};

type ParsedSkill = {
  name: string;
  description: string;
  body: string;
};

function splitFrontMatter(
  text: string,
): { front: string[]; body: string } | undefined {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    return undefined;
  }
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      end = index;
      break;
    }
  }
  if (end === -1) {
    return undefined;
  }
  return {
    front: lines.slice(1, end),
    body: lines
      .slice(end + 1)
      .join("\n")
      .trim(),
  };
}

function unquote(value: string): string {
  if (value.length < 2) {
    return value;
  }
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && first === last) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFields(lines: string[]): Map<string, string> {
  const fields = new Map<string, string>();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "" || /^\s/.test(line)) {
      index += 1;
      continue;
    }
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (match === null) {
      index += 1;
      continue;
    }
    const key = match[1] ?? "";
    const inline = (match[2] ?? "").trim();
    const continuation: string[] = [];
    let next = index + 1;
    while (next < lines.length) {
      const following = lines[next] ?? "";
      if (following.trim() === "") {
        continuation.push("");
        next += 1;
        continue;
      }
      if (!/^\s/.test(following)) {
        break;
      }
      continuation.push(following.trim());
      next += 1;
    }
    const multiline =
      inline === "" || inline.startsWith(">") || inline.startsWith("|");
    const extra = continuation.filter((part) => part !== "");
    const value = multiline
      ? extra.join(" ")
      : [inline, ...extra].join(" ").trim();
    fields.set(key, unquote(value.trim()));
    index = next;
  }
  return fields;
}

export function parseSkill(text: string): ParsedSkill | undefined {
  const split = splitFrontMatter(text);
  if (split === undefined) {
    return undefined;
  }
  const fields = parseFields(split.front);
  const name = fields.get("name")?.trim();
  const description = fields.get("description")?.trim();
  if (name === undefined || name === "") {
    return undefined;
  }
  if (description === undefined || description === "") {
    return undefined;
  }
  return { name, description, body: split.body };
}

export function skillDirs(o: {
  cwd: string;
  home: string;
  builtinDir: string;
}): { dir: string; source: Skill["source"] }[] {
  return [
    { dir: o.builtinDir, source: "builtin" },
    { dir: join(o.home, ".ja-harness", "skills"), source: "personal" },
    { dir: join(o.cwd, ".ja-harness", "skills"), source: "project" },
  ];
}

function sortByName(a: Skill, b: Skill): number {
  return a.name.localeCompare(b.name);
}

export function loadSkills(o: {
  cwd: string;
  home: string;
  builtinDir: string;
  disabled: string[];
}): { skills: Skill[]; disabled: Skill[] } {
  const found = new Map<string, Skill>();
  for (const { dir, source } of skillDirs(o)) {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillDir = join(dir, entry.name);
      let text: string;
      try {
        text = readFileSync(join(skillDir, "SKILL.md"), "utf8");
      } catch {
        continue;
      }
      const parsed = parseSkill(text);
      if (parsed === undefined) {
        continue;
      }
      found.set(parsed.name, {
        name: parsed.name,
        description: parsed.description,
        dir: skillDir,
        source,
      });
    }
  }

  const disabledNames = new Set(o.disabled);
  const skills: Skill[] = [];
  const disabled: Skill[] = [];
  for (const skill of found.values()) {
    if (disabledNames.has(skill.name)) {
      disabled.push(skill);
    } else {
      skills.push(skill);
    }
  }
  return {
    skills: skills.sort(sortByName),
    disabled: disabled.sort(sortByName),
  };
}

export function formatSkillList(skills: Skill[]): string {
  if (skills.length === 0) {
    return "";
  }
  const lines = [
    "",
    "",
    "# Skills",
    "Call the skill tool with a name to read its instructions before doing a task it covers.",
    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
  ];
  return lines.join("\n");
}

function isInside(dir: string, abs: string): boolean {
  const rel = relative(dir, abs);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}

export function readSkillFile(skill: Skill, file?: string): string {
  let content: string;
  if (file === undefined) {
    const text = readFileSync(join(skill.dir, "SKILL.md"), "utf8");
    const parsed = parseSkill(text);
    if (parsed === undefined) {
      throw new Error("skill: broken SKILL.md");
    }
    content = parsed.body;
  } else {
    const abs = resolve(skill.dir, file);
    if (!isInside(skill.dir, abs)) {
      throw new Error(`skill: "${file}" is outside the skill folder`);
    }
    content = readFileSync(abs, "utf8");
  }
  return `Skill folder: ${skill.dir}\n${content}`;
}

export function builtinSkillsDir(): string {
  return fileURLToPath(new URL("../../skills", import.meta.url));
}

export type SkillSource =
  | { kind: "github"; repoUrl: string; branch?: string; path?: string }
  | { kind: "local"; path: string };

export function parseSkillSource(source: string): SkillSource {
  const text = source.trim();
  const match =
    /^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/(.*))?$/i.exec(
      text,
    );
  if (match === null) {
    return { kind: "local", path: text };
  }
  const owner = match[1] ?? "";
  const repo = match[2] ?? "";
  const rest = (match[3] ?? "").replace(/\/+$/, "");
  const repoUrl = `https://github.com/${owner}/${repo}`;
  if (rest === "") {
    return { kind: "github", repoUrl };
  }
  const tree = /^tree\/(.+)$/.exec(rest);
  if (tree === null) {
    return { kind: "github", repoUrl };
  }
  const parts = (tree[1] ?? "").split("/");
  const branch = parts[0] ?? "";
  if (branch === "") {
    return { kind: "github", repoUrl };
  }
  const path = parts.slice(1).join("/");
  return {
    kind: "github",
    repoUrl,
    branch,
    ...(path === "" ? {} : { path }),
  };
}

export function findSkillFolders(root: string, maxDepth = 3): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) {
      found.push(dir);
    }
    if (depth >= maxDepth) {
      return;
    }
    const dirs = entries
      .filter((entry) => entry.isDirectory() && entry.name !== ".git")
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of dirs) {
      walk(join(dir, entry.name), depth + 1);
    }
  };
  walk(root, 0);
  return found.sort((a, b) => a.localeCompare(b));
}
