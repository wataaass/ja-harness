import { type Dirent, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Tool } from "../agent/loop.js";
import { displayPath, resolvePath } from "./path.js";

const SKIP_DIRS = new Set([".git", "node_modules", ".ja-harness", "dist"]);
const MAX_ENTRIES = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortEntries(entries: Dirent[]): Dirent[] {
  return entries.sort((a, b) => {
    const aDir = a.isDirectory();
    const bDir = b.isDirectory();
    if (aDir !== bDir) {
      return aDir ? -1 : 1;
    }
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

function buildTree(abs: string, depth: number): string {
  const lines: string[] = [];
  let hidden = 0;

  const walk = (dir: string, level: number): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of sortEntries(entries)) {
      const isDir = entry.isDirectory();
      const skipped = isDir && SKIP_DIRS.has(entry.name);
      const suffix = isDir ? (skipped ? "/ (skipped)" : "/") : "";
      const text = `${"  ".repeat(level - 1)}${entry.name}${suffix}`;

      if (lines.length < MAX_ENTRIES) {
        lines.push(text);
      } else {
        hidden += 1;
      }

      if (isDir && !skipped && level < depth) {
        walk(join(dir, entry.name), level + 1);
      }
    }
  };

  walk(abs, 1);

  if (hidden > 0) {
    lines.push(`… ${hidden} more entries not shown`);
  }
  return lines.join("\n");
}

export function createListTool(cwd: string): Tool {
  return {
    name: "list",
    description: "List a directory tree. Directories end with /.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'Directory or file to list (default ".").',
        },
        depth: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Directory depth (default 2).",
        },
      },
    },
    async execute(args: unknown): Promise<string> {
      if (!isRecord(args)) {
        throw new Error("list: arguments must be an object");
      }
      const input = args.path ?? ".";
      if (typeof input !== "string") {
        throw new Error('list: "path" must be a string');
      }
      const depth = args.depth ?? 2;
      if (
        typeof depth !== "number" ||
        !Number.isInteger(depth) ||
        depth < 1 ||
        depth > 5
      ) {
        throw new Error('list: "depth" must be an integer from 1 to 5');
      }

      const abs = resolvePath(cwd, input);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(abs);
      } catch {
        throw new Error(`list: path not found: ${displayPath(cwd, abs)}`);
      }

      if (stat.isFile()) {
        return displayPath(cwd, abs);
      }
      if (!stat.isDirectory()) {
        throw new Error(`list: path not found: ${displayPath(cwd, abs)}`);
      }

      return buildTree(abs, depth);
    },
  };
}
