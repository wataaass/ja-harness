import { readFileSync, writeFileSync } from "node:fs";
import type { Tool } from "../agent/loop.js";
import { type Confirm, toDecision } from "./confirm.js";
import { formatDiff } from "./diff.js";
import { displayPath, isOutsidePath, resolvePath } from "./path.js";

export type Edit = {
  oldText: string;
  newText: string;
  replaceAll?: boolean;
};

export type ChangedRange = {
  start: number;
  end: number;
};

type Operation = {
  start: number;
  oldLength: number;
  newText: string;
};

const CONTEXT_LINES = 3;
const MAX_RESULT_LINES = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function isSameIgnoringWhitespace(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function findExact(text: string, target: string): number[] {
  const found: number[] = [];
  let position = 0;
  while (position <= text.length - target.length) {
    const index = text.indexOf(target, position);
    if (index === -1) {
      break;
    }
    found.push(index);
    position = index + target.length;
  }
  return found;
}

function analyzeLines(text: string): {
  lines: string[];
  starts: number[];
  ends: number[];
} {
  const lines = text.split("\n");
  const starts: number[] = [];
  const ends: number[] = [];
  let position = 0;
  for (const line of lines) {
    starts.push(position);
    ends.push(position + line.length);
    position += line.length + 1;
  }
  return { lines, starts, ends };
}

function findLoose(
  text: string,
  target: string,
): Array<{ start: number; end: number }> {
  const { lines, starts, ends } = analyzeLines(text);
  const targetLines = toLines(target);
  const includeTrailingNewline = target.endsWith("\n");
  const found: Array<{ start: number; end: number }> = [];

  for (let i = 0; i + targetLines.length <= lines.length; i += 1) {
    let matches = true;
    for (let j = 0; j < targetLines.length; j += 1) {
      if (!isSameIgnoringWhitespace(lines[i + j], targetLines[j])) {
        matches = false;
        break;
      }
    }
    if (matches) {
      const last = i + targetLines.length - 1;
      let end = ends[last];
      if (includeTrailingNewline && end < text.length) {
        end += 1;
      }
      found.push({ start: starts[i], end });
    }
  }

  return found;
}

function similarLines(text: string, target: string): number[] {
  const first = toLines(target)
    .map((line) => line.trim())
    .find((line) => line !== "");
  if (first === undefined) {
    return [];
  }

  const found: number[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length && found.length < 3; i += 1) {
    if (lines[i].trim().includes(first)) {
      found.push(i + 1);
    }
  }
  return found;
}

function notFoundError(text: string, target: string): Error {
  let message = "oldText not found";
  const similar = similarLines(text, target);
  if (similar.length > 0) {
    message += `; similar lines: ${similar.join(", ")}`;
  }
  return new Error(message);
}

function operations(text: string, edit: Edit): Operation[] {
  if (edit.oldText === "") {
    throw new Error("oldText must not be empty");
  }

  const exact = findExact(text, edit.oldText);
  if (exact.length > 0) {
    if (!edit.replaceAll && exact.length !== 1) {
      throw new Error(
        `oldText found ${exact.length} times; add more surrounding lines or set replaceAll`,
      );
    }
    return exact.map((start) => ({
      start,
      oldLength: edit.oldText.length,
      newText: edit.newText,
    }));
  }

  const loose = findLoose(text, edit.oldText);
  if (loose.length === 0) {
    throw notFoundError(text, edit.oldText);
  }
  if (loose.length > 1) {
    throw new Error(
      `oldText found ${loose.length} times; add more surrounding lines or set replaceAll`,
    );
  }

  return [
    {
      start: loose[0].start,
      oldLength: loose[0].end - loose[0].start,
      newText: edit.newText,
    },
  ];
}

function shiftRange(
  range: ChangedRange,
  start: number,
  oldLength: number,
  newLength: number,
): ChangedRange {
  const oldEnd = start + oldLength;
  const delta = newLength - oldLength;

  if (range.end <= start) {
    return range;
  }
  if (range.start >= oldEnd) {
    return { start: range.start + delta, end: range.end + delta };
  }

  return {
    start: Math.min(range.start, start),
    end: start + newLength + Math.max(0, range.end - oldEnd),
  };
}

export function applyEdits(
  text: string,
  edits: Edit[],
): { text: string; changed: ChangedRange[] } {
  let current = text;
  let changed: ChangedRange[] = [];

  for (const edit of edits) {
    const ops = operations(current, edit);
    let delta = 0;
    for (const op of ops) {
      const start = op.start + delta;
      const newLength = op.newText.length;
      changed = changed.map((range) =>
        shiftRange(range, start, op.oldLength, newLength),
      );
      changed.push({ start, end: start + newLength });
      current =
        current.slice(0, start) +
        op.newText +
        current.slice(start + op.oldLength);
      delta += newLength - op.oldLength;
    }
  }

  return { text: current, changed };
}

function lineIndexAt(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

function formatResult(
  path: string,
  text: string,
  changed: ChangedRange[],
): string {
  const { lines, starts } = analyzeLines(text);
  const expanded = changed
    .map((range) => {
      const first = lineIndexAt(starts, range.start);
      const last =
        range.end > range.start
          ? lineIndexAt(starts, range.end - 1)
          : lineIndexAt(starts, range.start);
      return {
        start: Math.max(0, first - CONTEXT_LINES),
        end: Math.min(lines.length - 1, last + CONTEXT_LINES),
      };
    })
    .sort((a, b) => a.start - b.start);

  const hunks: Array<{ start: number; end: number }> = [];
  for (const range of expanded) {
    const previous = hunks[hunks.length - 1];
    if (previous !== undefined && range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      hunks.push(range);
    }
  }

  const out = [`Edited ${path}: ${changed.length} replacement(s).`];
  let count = 0;
  for (const hunk of hunks) {
    if (hunks[0] !== hunk) {
      out.push("--");
    }
    for (let i = hunk.start; i <= hunk.end; i += 1) {
      if (count >= MAX_RESULT_LINES) {
        out.push("…");
        return out.join("\n");
      }
      out.push(`${i + 1}\t${lines[i] ?? ""}`);
      count += 1;
    }
  }
  return out.join("\n");
}

function parseEdit(value: unknown, index: number): Edit {
  if (!isRecord(value)) {
    throw new Error(`edit: edits[${index}] must be an object`);
  }
  if (typeof value.oldText !== "string") {
    throw new Error(`edit: edits[${index}].oldText must be a string`);
  }
  if (typeof value.newText !== "string") {
    throw new Error(`edit: edits[${index}].newText must be a string`);
  }
  if (value.replaceAll !== undefined && typeof value.replaceAll !== "boolean") {
    throw new Error(`edit: edits[${index}].replaceAll must be a boolean`);
  }
  return {
    oldText: value.oldText,
    newText: value.newText,
    replaceAll: value.replaceAll as boolean | undefined,
  };
}

function declined(message: string, reason: string | undefined): string {
  const text = reason?.trim() ?? "";
  return text === "" ? message : `${message}\nReason from the user: ${text}`;
}

export function createEditTool(cwd: string, confirm: Confirm): Tool {
  return {
    name: "edit",
    description:
      "Replace text in an existing file. Fails if oldText is missing or appears more than once.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File to edit.",
        },
        edits: {
          type: "array",
          minItems: 1,
          description: "Replacements applied in order.",
          items: {
            type: "object",
            properties: {
              oldText: {
                type: "string",
                description:
                  "Text to replace. Include enough context to be unique.",
              },
              newText: {
                type: "string",
                description: "Replacement text.",
              },
              replaceAll: {
                type: "boolean",
                description: "Replace every occurrence.",
              },
            },
            required: ["oldText", "newText"],
          },
        },
      },
      required: ["path", "edits"],
    },
    maxResultTokens: 4000,
    async execute(args: unknown, signal?: AbortSignal): Promise<string> {
      if (!isRecord(args)) {
        throw new Error("edit: arguments must be an object");
      }
      if (typeof args.path !== "string" || args.path === "") {
        throw new Error('edit: "path" must be a non-empty string');
      }
      if (!Array.isArray(args.edits) || args.edits.length === 0) {
        throw new Error('edit: "edits" must be a non-empty array');
      }

      const edits = args.edits.map((value, index) => parseEdit(value, index));
      const abs = resolvePath(cwd, args.path);
      const path = displayPath(cwd, abs);

      let original: string;
      try {
        original = readFileSync(abs, "utf8");
      } catch {
        throw new Error("file not found; use write to create it");
      }

      const crlf = original.includes("\r\n");
      const normalized = crlf ? original.replace(/\r\n/g, "\n") : original;
      const { text: updated, changed } = applyEdits(normalized, edits);

      signal?.throwIfAborted();
      const decision = toDecision(
        await confirm({
          tool: "edit",
          title: `${path} を編集します`,
          detail: formatDiff(path, normalized, updated),
          ...(isOutsidePath(cwd, abs) ? { outside: true } : {}),
        }),
      );
      if (!decision.allow) {
        return declined(
          "The user declined this edit. Ask what they want instead.",
          decision.reason,
        );
      }

      signal?.throwIfAborted();
      const output = crlf ? updated.replace(/\n/g, "\r\n") : updated;
      writeFileSync(abs, output, "utf8");
      return formatResult(path, updated, changed);
    },
  };
}
