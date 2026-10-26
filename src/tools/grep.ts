import { execFile } from "node:child_process";
import { type Dirent, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { Tool } from "../agent/loop.js";
import { displayPath, resolvePath } from "./path.js";

const SKIP_DIRS = new Set([".git", "node_modules", ".ja-harness", "dist"]);
const MAX_OUTPUT_LINES = 200;
const MAX_BUFFER = 10 * 1024 * 1024;
const TRUNCATED = "… more matches not shown; narrow the pattern or path";

export type GrepArgs = {
  pattern: string;
  path?: string;
  glob?: string;
  context?: number;
  ignoreCase?: boolean;
};

let ripgrepCheck: Promise<boolean> | undefined;

function detectRipgrep(): Promise<boolean> {
  ripgrepCheck ??= new Promise<boolean>((resolve) => {
    execFile("rg", ["--version"], (error) => {
      resolve(error === null);
    });
  });
  return ripgrepCheck;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toLines(text: string): string[] {
  if (text === "") {
    return [];
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function globToRegExp(glob: string): RegExp {
  const source = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${source}$`);
}

function readSkipNames(cwd: string): Set<string> {
  const names = new Set<string>();
  let text: string;
  try {
    text = readFileSync(join(cwd, ".gitignore"), "utf8");
  } catch {
    return names;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    if (line.includes("/") || line.includes("*")) {
      continue;
    }
    names.add(line);
  }
  return names;
}

function sortEntries(entries: Dirent[]): Dirent[] {
  return entries.sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
}

function findMatches(
  lines: string[],
  regex: RegExp,
  context: number,
): { groups: { start: number; end: number }[]; matches: Set<number> } {
  const matches = new Set<number>();
  for (let i = 0; i < lines.length; i += 1) {
    if (regex.test(lines[i])) {
      matches.add(i);
    }
  }

  const groups: { start: number; end: number }[] = [];
  for (const match of matches) {
    const start = Math.max(0, match - context);
    const end = Math.min(lines.length - 1, match + context);
    const last = groups[groups.length - 1];
    if (last !== undefined && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
    } else {
      groups.push({ start, end });
    }
  }

  return { groups, matches };
}

function finish(lines: string[], truncated: boolean): string {
  if (lines.length === 0) {
    return "No matches.";
  }
  if (truncated) {
    return `${lines.slice(0, MAX_OUTPUT_LINES).join("\n")}\n${TRUNCATED}`;
  }
  return lines.join("\n");
}

export async function grepInNode(
  cwd: string,
  args: GrepArgs,
  signal?: AbortSignal,
): Promise<string> {
  const context = args.context ?? 2;
  const ignoreCase = args.ignoreCase === true;
  const regex = new RegExp(args.pattern, ignoreCase ? "i" : "");
  const glob = args.glob === undefined ? undefined : globToRegExp(args.glob);
  const target = resolvePath(cwd, args.path ?? ".");
  const skipNames = readSkipNames(cwd);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(target);
  } catch {
    throw new Error(`grep: path not found: ${displayPath(cwd, target)}`);
  }

  const lines: string[] = [];
  let truncated = false;
  let hasOutput = false;

  const add = (line: string): void => {
    lines.push(line);
    if (lines.length > MAX_OUTPUT_LINES) {
      truncated = true;
    }
  };

  const searchFile = (file: string): void => {
    if (truncated) {
      return;
    }
    if (glob !== undefined && !glob.test(basename(file))) {
      return;
    }
    const buffer = readFileSync(file);
    if (buffer.includes(0)) {
      return;
    }
    const fileLines = toLines(buffer.toString("utf8"));
    const { groups, matches } = findMatches(fileLines, regex, context);
    if (groups.length === 0) {
      return;
    }

    const path = displayPath(cwd, file);
    for (const group of groups) {
      if (truncated) {
        return;
      }
      if (hasOutput) {
        add("--");
      }
      hasOutput = true;
      for (let i = group.start; i <= group.end; i += 1) {
        const separator = matches.has(i) ? ":" : "-";
        add(`${path}${separator}${i + 1}${separator}${fileLines[i]}`);
        if (truncated) {
          return;
        }
      }
    }
  };

  const walk = (dir: string): void => {
    if (truncated) {
      return;
    }
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of sortEntries(entries)) {
      if (truncated) {
        return;
      }
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) {
        continue;
      }
      if (skipNames.has(entry.name)) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        searchFile(full);
      }
      signal?.throwIfAborted();
    }
  };

  if (stat.isDirectory()) {
    walk(target);
  } else if (stat.isFile()) {
    searchFile(target);
  } else {
    throw new Error(`grep: path not found: ${displayPath(cwd, target)}`);
  }

  return finish(lines, truncated);
}

function formatRipgrepLine(cwd: string, line: string): string {
  if (line === "--") {
    return line;
  }
  const nul = line.indexOf("\0");
  if (nul === -1) {
    return line;
  }
  const rawPath = line.slice(0, nul);
  const rest = line.slice(nul + 1);
  const match = /^(\d+)([:-])(.*)$/.exec(rest);
  if (match === null) {
    return line;
  }
  const [, number, separator, text] = match;
  const absolute = resolvePath(cwd, rawPath);
  return `${displayPath(cwd, absolute)}${separator}${number}${separator}${text}`;
}

export async function grepWithRipgrep(
  cwd: string,
  args: GrepArgs,
  signal?: AbortSignal,
): Promise<string> {
  const context = args.context ?? 2;
  const target = resolvePath(cwd, args.path ?? ".");
  const rgArgs = [
    "--line-number",
    "--no-heading",
    "--with-filename",
    "--color",
    "never",
    "--null",
    "--sort",
    "path",
    "-C",
    String(context),
    ...(args.ignoreCase === true ? ["-i"] : []),
    ...(args.glob === undefined ? [] : ["-g", args.glob]),
    ...[...SKIP_DIRS].flatMap((name) => ["-g", `!${name}/`]),
    "-e",
    args.pattern,
    "--",
    target,
  ];

  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      "rg",
      rgArgs,
      { cwd, signal, maxBuffer: MAX_BUFFER },
      (error, out, stderr) => {
        if (error !== null) {
          const code = (error as { code?: unknown }).code;
          if (code === 1) {
            resolve(out);
            return;
          }
          const first = stderr.split(/\r?\n/).find((line) => line !== "") ?? "";
          reject(new Error(first === "" ? error.message : first));
          return;
        }
        resolve(out);
      },
    );
  });

  const output = stdout.split(/\r?\n/);
  while (output.length > 0 && output[output.length - 1] === "") {
    output.pop();
  }
  const lines = output.map((line) => formatRipgrepLine(cwd, line));
  return finish(lines, lines.length > MAX_OUTPUT_LINES);
}

function validateArgs(args: unknown): GrepArgs {
  if (!isRecord(args)) {
    throw new Error("grep: arguments must be an object");
  }
  if (typeof args.pattern !== "string") {
    throw new Error('grep: "pattern" must be a string');
  }
  if (args.path !== undefined && typeof args.path !== "string") {
    throw new Error('grep: "path" must be a string');
  }
  if (args.glob !== undefined && typeof args.glob !== "string") {
    throw new Error('grep: "glob" must be a string');
  }
  const context = args.context ?? 2;
  if (
    typeof context !== "number" ||
    !Number.isInteger(context) ||
    context < 0 ||
    context > 5
  ) {
    throw new Error('grep: "context" must be an integer from 0 to 5');
  }
  if (args.ignoreCase !== undefined && typeof args.ignoreCase !== "boolean") {
    throw new Error('grep: "ignoreCase" must be a boolean');
  }
  return {
    pattern: args.pattern,
    path: args.path as string | undefined,
    glob: args.glob as string | undefined,
    context,
    ignoreCase: args.ignoreCase as boolean | undefined,
  };
}

export function createGrepTool(
  cwd: string,
  opts?: { useRipgrep?: boolean },
): Tool {
  return {
    name: "grep",
    description:
      "Search file contents with a regular expression. Returns matching lines with context.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regular expression to search for.",
        },
        path: {
          type: "string",
          description: 'File or directory to search (default ".").',
        },
        glob: {
          type: "string",
          description: "Only search file names matching this glob.",
        },
        context: {
          type: "integer",
          minimum: 0,
          maximum: 5,
          description:
            "Lines of context before and after each match (default 2).",
        },
        ignoreCase: {
          type: "boolean",
          description: "Ignore case when matching.",
        },
      },
      required: ["pattern"],
    },
    async execute(args: unknown, signal?: AbortSignal): Promise<string> {
      const parsed = validateArgs(args);
      const useRipgrep = opts?.useRipgrep ?? (await detectRipgrep());
      return useRipgrep
        ? grepWithRipgrep(cwd, parsed, signal)
        : grepInNode(cwd, parsed, signal);
    },
  };
}
