import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Tool } from "../agent/loop.js";
import { type Confirm, toDecision } from "./confirm.js";
import { displayPath, isOutsidePath, resolvePath } from "./path.js";

const DETAIL_LINES = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toLines(text: string): string[] {
  if (text === "") {
    return [];
  }
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function declined(message: string, reason: string | undefined): string {
  const text = reason?.trim() ?? "";
  return text === "" ? message : `${message}\nReason from the user: ${text}`;
}

export function createWriteTool(
  cwd: string,
  confirm: Confirm,
  beforeWrite?: (absPath: string) => void,
): Tool {
  return {
    name: "write",
    description: "Create a new file. Fails if the file already exists.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File to create.",
        },
        content: {
          type: "string",
          description: "Full file content.",
        },
      },
      required: ["path", "content"],
    },
    maxResultTokens: 2000,
    async execute(args: unknown, signal?: AbortSignal): Promise<string> {
      if (!isRecord(args)) {
        throw new Error("write: arguments must be an object");
      }
      if (typeof args.path !== "string" || args.path === "") {
        throw new Error('write: "path" must be a non-empty string');
      }
      if (typeof args.content !== "string") {
        throw new Error('write: "content" must be a string');
      }

      const abs = resolvePath(cwd, args.path);
      const path = displayPath(cwd, abs);
      if (existsSync(abs)) {
        throw new Error("file exists; use edit to change it");
      }

      const lines = toLines(args.content);
      const shown = lines.slice(0, DETAIL_LINES);
      let detail = shown.join("\n");
      if (lines.length > DETAIL_LINES) {
        detail += `\n…${lines.length - DETAIL_LINES} more lines`;
      }

      signal?.throwIfAborted();
      const decision = toDecision(
        await confirm({
          tool: "write",
          title: `Write ${path} (${lines.length} lines)`,
          detail,
          ...(isOutsidePath(cwd, abs) ? { outside: true } : {}),
        }),
      );
      if (!decision.allow) {
        return declined(
          "The user declined this write. Ask what they want instead.",
          decision.reason,
        );
      }

      signal?.throwIfAborted();
      beforeWrite?.(abs);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, args.content, "utf8");
      return `Created ${path} (${lines.length} lines).`;
    },
  };
}
