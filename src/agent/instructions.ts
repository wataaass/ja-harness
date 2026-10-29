import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export type InstructionFile = {
  path: string;
  label: string;
  text: string;
};

export type FindInstructionFilesOptions = {
  cwd: string;
  home: string;
  exists: (path: string) => boolean;
};

export function findInstructionFiles(o: FindInstructionFilesOptions): string[] {
  const files: string[] = [];
  for (const dir of [join(o.home, ".ja-harness"), o.cwd]) {
    const agents = join(dir, "AGENTS.md");
    const claude = join(dir, "CLAUDE.md");
    const harness = join(dir, "JA_HARNESS.md");
    if (o.exists(agents)) {
      files.push(agents);
    } else if (o.exists(claude)) {
      files.push(claude);
    }
    if (o.exists(harness)) {
      files.push(harness);
    }
  }
  return files;
}

export function formatInstructions(
  files: InstructionFile[],
  maxChars = 12000,
): { text: string; truncated: boolean } {
  if (files.length === 0) {
    return { text: "", truncated: false };
  }
  const body = files
    .map((file) => `## ${file.label}\n${file.text}`)
    .join("\n\n");
  const text = `\n\n# User instructions\nFollow these instructions from the user's files.\n\n${body}`;
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, Math.max(0, maxChars))}\n[truncated]`,
    truncated: true,
  };
}

export function loadInstructions(o: { cwd: string; home: string }): {
  text: string;
  labels: string[];
  truncated: boolean;
} {
  const personal = join(o.home, ".ja-harness");
  const files: InstructionFile[] = [];
  for (const path of findInstructionFiles({ ...o, exists: existsSync })) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    text = text.replace(/\r\n/g, "\n").trim();
    if (text === "") {
      continue;
    }
    const label =
      dirname(path) === personal
        ? `~/.ja-harness/${basename(path)}`
        : basename(path);
    files.push({ path, label, text });
  }
  const formatted = formatInstructions(files);
  return {
    text: formatted.text,
    labels: files.map((file) => file.label),
    truncated: formatted.truncated,
  };
}
