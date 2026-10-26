import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export type TaskKind = "fix" | "generate";

export type BenchTask = {
  id: string;
  kind: TaskKind;
  prompt: string;
  dir: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireDirectory(path: string, label: string, id: string): void {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`課題 ${id} に ${label}/ がありません`);
  }
}

function parseTaskJson(path: string, id: string): Omit<BenchTask, "dir"> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`課題 ${id} に task.json がありません`);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`課題 ${id} の task.json が壊れています: ${message}`);
  }

  const task = asRecord(value);
  if (typeof task.id !== "string" || task.id === "") {
    throw new Error(`課題 ${id} の task.json に id がありません`);
  }
  if (task.kind !== "fix" && task.kind !== "generate") {
    throw new Error(`課題 ${id} の kind は fix か generate です`);
  }
  if (typeof task.prompt !== "string" || task.prompt === "") {
    throw new Error(`課題 ${id} の task.json に prompt がありません`);
  }

  return { id: task.id, kind: task.kind, prompt: task.prompt };
}

function loadOne(root: string, name: string): BenchTask {
  const dir = join(root, name);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`課題のフォルダがありません: ${name}`);
  }

  requireDirectory(join(dir, "files"), "files", name);
  requireDirectory(join(dir, "grade"), "grade", name);
  requireDirectory(join(dir, "solution"), "solution", name);

  const task = parseTaskJson(join(dir, "task.json"), name);
  return { ...task, dir };
}

export function loadTasks(dir: string, ids?: string[]): BenchTask[] {
  const root = resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`課題のフォルダがありません: ${dir}`);
  }

  const names =
    ids ??
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

  return names.map((name) => loadOne(root, name));
}
