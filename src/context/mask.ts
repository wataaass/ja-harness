import type { Message } from "../llm/types.js";
import { SUMMARY_PREFIX } from "./summary.js";
import type { Estimator } from "./tokens.js";

const STUB_PREFIX = "[Hidden to save tokens: ";
const STUB_SUFFIX = ". Call the tool again if you need it.]";
const FALLBACK_CHARS = 80;

type CallInfo = { name: string; args: string };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(raw)) ?? {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function shorten(value: string, limit = FALLBACK_CHARS): string {
  const chars = Array.from(value);
  if (chars.length <= limit) {
    return value;
  }
  return chars.slice(0, limit).join("");
}

function readPaths(args: Record<string, unknown>): string[] {
  const paths = args.paths;
  if (Array.isArray(paths)) {
    return paths.filter((path): path is string => typeof path === "string");
  }
  const path = text(args.path);
  return path === undefined ? [] : [path];
}

function readSummary(args: Record<string, unknown>): string {
  const path = readPaths(args)[0] ?? "?";
  const start = number(args.start) ?? number(args.offset);
  const end =
    number(args.end) ??
    (start !== undefined && number(args.limit) !== undefined
      ? start + (number(args.limit) as number) - 1
      : undefined);
  if (start !== undefined && end !== undefined) {
    return `read ${path} lines ${start}-${end}`;
  }
  if (start !== undefined) {
    return `read ${path} lines ${start}-`;
  }
  if (end !== undefined) {
    return `read ${path} lines -${end}`;
  }
  return `read ${path}`;
}

function summarize(
  toolName: string,
  args: Record<string, unknown>,
  raw: string,
): string {
  switch (toolName) {
    case "read":
      return readSummary(args);
    case "grep": {
      const pattern = text(args.pattern) ?? "";
      const path = text(args.path) ?? ".";
      return `grep "${pattern}" in ${path}`;
    }
    case "list":
      return `list ${text(args.path) ?? "."}`;
    case "shell":
      return `shell: ${shorten(text(args.command) ?? "")}`;
    case "edit":
    case "write":
      return `${toolName} ${text(args.path) ?? "?"}`;
    case "mcp":
      return `mcp ${text(args.name) ?? ""}`;
    default:
      return `${toolName} ${shorten(raw)}`;
  }
}

export function maskStub(
  toolName: string,
  args: string,
  tokens: number,
): string {
  const summary = summarize(toolName, parseArgs(args), args);
  return `${STUB_PREFIX}${summary} (${tokens} tokens)${STUB_SUFFIX}`;
}

export function isMasked(content: string): boolean {
  return content.startsWith(STUB_PREFIX) && content.endsWith(STUB_SUFFIX);
}

function callInfo(messages: Message[]): Map<string, CallInfo> {
  const calls = new Map<string, CallInfo>();
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const call of message.toolCalls ?? []) {
      calls.set(call.id, { name: call.name, args: call.arguments });
    }
  }
  return calls;
}

function toolResults(messages: Message[]): Map<string, string> {
  const results = new Map<string, string>();
  for (const message of messages) {
    if (message.role === "tool") {
      results.set(message.toolCallId, message.content);
    }
  }
  return results;
}

function isStaleRead(
  messages: Message[],
  index: number,
  call: CallInfo,
  results: Map<string, string>,
): boolean {
  if (call.name !== "read") {
    return false;
  }
  const paths = new Set(readPaths(parseArgs(call.args)));
  if (paths.size === 0) {
    return false;
  }

  for (let later = index + 1; later < messages.length; later += 1) {
    const message = messages[later];
    if (message.role !== "assistant") {
      continue;
    }
    for (const next of message.toolCalls ?? []) {
      if (next.name !== "edit" && next.name !== "write") {
        continue;
      }
      const path = text(parseArgs(next.arguments).path);
      if (path === undefined || !paths.has(path)) {
        continue;
      }
      const result = results.get(next.id);
      if (result !== undefined && !result.startsWith("Error")) {
        return true;
      }
    }
  }
  return false;
}

function lastRequestIndex(messages: Message[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message?.role === "user" &&
      !message.content.startsWith(SUMMARY_PREFIX)
    ) {
      return index;
    }
  }
  return -1;
}

function isEligible(
  message: Message | undefined,
  call: CallInfo | undefined,
  o: { minTokens: number; estimate: Estimator },
): message is Extract<Message, { role: "tool" }> {
  if (message === undefined || message.role !== "tool") {
    return false;
  }
  if (isMasked(message.content)) {
    return false;
  }
  if (o.estimate(message.content) < o.minTokens) {
    return false;
  }
  if (call === undefined) {
    return false;
  }
  return call.name !== "skill" && call.name !== "submit_plan";
}

export type MaskCandidate = {
  index: number;
  kind: "stale" | "previous";
};

export type BelowThresholdOptions = {
  minTokens: number;
  estimate: Estimator;
};

export function belowThresholdCandidates(
  messages: Message[],
  o: BelowThresholdOptions,
): MaskCandidate[] {
  const lastRequest = lastRequestIndex(messages);
  const calls = callInfo(messages);
  const results = toolResults(messages);
  const candidates: MaskCandidate[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const call =
      message?.role === "tool" ? calls.get(message.toolCallId) : undefined;
    if (!isEligible(message, call, o) || call === undefined) {
      continue;
    }
    if (isStaleRead(messages, index, call, results)) {
      candidates.push({ index, kind: "stale" });
    } else if (index < lastRequest) {
      candidates.push({ index, kind: "previous" });
    }
  }
  return candidates;
}

export type MaskOptions = {
  window: number;
  minTokens: number;
  estimate: Estimator;
};

export function maskCandidates(messages: Message[], o: MaskOptions): number[] {
  let lastAssistant = -1;
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.role === "assistant") {
      lastAssistant = index;
    }
  }

  const calls = callInfo(messages);
  const results = toolResults(messages);
  const tools: number[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.role === "tool") {
      tools.push(index);
    }
  }
  const kept = new Set(tools.slice(Math.max(0, tools.length - o.window)));

  const positions: number[] = [];
  for (const index of tools) {
    if (index >= lastAssistant) {
      continue;
    }
    const message = messages[index];
    if (message === undefined || message.role !== "tool") {
      continue;
    }
    if (isMasked(message.content)) {
      continue;
    }
    if (o.estimate(message.content) < o.minTokens) {
      continue;
    }
    const call = calls.get(message.toolCallId);
    if (call === undefined) {
      continue;
    }
    if (call.name === "skill" || call.name === "submit_plan") {
      continue;
    }
    const stale = isStaleRead(messages, index, call, results);
    if (kept.has(index) && !stale) {
      continue;
    }
    positions.push(index);
  }
  return positions;
}

export function applyMask(
  messages: Message[],
  positions: number[],
  estimate: Estimator,
): { messages: Message[]; savedTokens: number; firstIndex: number } {
  const targets = new Set(positions);
  const calls = callInfo(messages);
  let savedTokens = 0;
  let firstIndex = -1;

  const next = messages.map((message, index) => {
    if (!targets.has(index) || message.role !== "tool") {
      return message;
    }
    const call = calls.get(message.toolCallId);
    if (call === undefined) {
      return message;
    }
    const before = estimate(message.content);
    const stub = maskStub(call.name, call.args, before);
    savedTokens += Math.max(0, before - estimate(stub));
    if (firstIndex === -1 || index < firstIndex) {
      firstIndex = index;
    }
    return { ...message, content: stub };
  });

  return { messages: next, savedTokens, firstIndex };
}
