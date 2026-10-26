import { readFileSync, statSync } from "node:fs";
import type { Tool } from "../agent/loop.js";
import { displayPath, resolvePath } from "./path.js";

const MAX_LINE_CHARS = 2000;
const BINARY_CHECK_BYTES = 8 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function cutLine(line: string): string {
  const chars = Array.from(line);
  if (chars.length <= MAX_LINE_CHARS) {
    return line;
  }
  return `${chars.slice(0, MAX_LINE_CHARS).join("")} …[cut]`;
}

function numberArg(
  args: Record<string, unknown>,
  name: string,
  fallback: number,
): number {
  const value = args[name];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`read: "${name}" must be an integer of 1 or greater`);
  }
  return value;
}

function readOne(
  cwd: string,
  input: string,
  offset: number,
  limit: number,
): string {
  const abs = resolvePath(cwd, input);
  const path = displayPath(cwd, abs);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(abs);
  } catch {
    return `== ${path}: not found`;
  }

  if (stat.isDirectory()) {
    return `== ${path}: is a directory; use list`;
  }
  if (!stat.isFile()) {
    return `== ${path}: not found`;
  }

  const buffer = readFileSync(abs);
  if (buffer.subarray(0, BINARY_CHECK_BYTES).includes(0)) {
    return `== ${path}: binary file, ${stat.size} bytes`;
  }

  const text = buffer.toString("utf8");
  if (text === "") {
    return `== ${path} (empty)`;
  }

  const lines = toLines(text);
  const total = lines.length;
  if (offset > total) {
    return `== ${path}: offset ${offset} is past the end (${total} lines)`;
  }
  const start = Math.min(offset - 1, total);
  const end = Math.min(total, start + limit);
  const out = [`== ${path} (lines ${start + 1}-${end} of ${total})`];

  for (let i = start; i < end; i += 1) {
    out.push(`${i + 1}\t${cutLine(lines[i])}`);
  }

  if (end < total) {
    out.push(`(${total - end} more lines; use offset=${end + 1})`);
  }

  return out.join("\n");
}

export function createReadTool(cwd: string): Tool {
  return {
    name: "read",
    description:
      "Read files with line numbers. Use offset and limit for large files.",
    parameters: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 10,
          description: "Files to read.",
        },
        offset: {
          type: "integer",
          minimum: 1,
          description: "First line to read (1-based, default 1).",
        },
        limit: {
          type: "integer",
          minimum: 1,
          description: "Maximum lines to read (default 2000).",
        },
      },
      required: ["paths"],
    },
    maxResultTokens: 8000,
    async execute(args: unknown): Promise<string> {
      if (!isRecord(args)) {
        throw new Error("read: arguments must be an object");
      }
      const paths = args.paths;
      if (
        !Array.isArray(paths) ||
        paths.length < 1 ||
        paths.length > 10 ||
        paths.some((path) => typeof path !== "string")
      ) {
        throw new Error('read: "paths" must be an array of 1 to 10 strings');
      }
      const offset = numberArg(args, "offset", 1);
      const limit = numberArg(args, "limit", 2000);

      return paths
        .map((path) => readOne(cwd, path as string, offset, limit))
        .join("\n");
    },
  };
}
