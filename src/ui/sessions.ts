import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import type { Message, Usage } from "../llm/types.js";
import { getMessages, type Messages } from "./i18n/index.js";

export type SessionMeta = {
  type: "meta";
  id: string;
  cwd: string;
  model: string;
  createdAt: string;
};

export type SessionMetaInput = Omit<SessionMeta, "type"> & {
  type?: "meta";
};

export type SessionEntry =
  | SessionMeta
  | { type: "message"; message: Message }
  | { type: "reset"; messages: Message[] }
  | { type: "usage"; usage: Usage };

export type SessionSummary = {
  id: string;
  path: string;
  createdAt: string;
  firstUser: string;
  cost: number;
  cacheRatio: number;
  turns: number;
  readonly preview?: string;
  readonly firstMessage?: string;
  readonly firstUserMessage?: string;
  readonly count?: number;
  readonly totalCost?: number;
};

export type SessionWriter = {
  path: string;
  append(entry: SessionEntry): string | undefined;
};

export type LoadedSession = {
  meta: SessionMeta;
  messages: Message[];
  usage: Usage;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function zeroUsage(): Usage {
  return { input: 0, cachedInput: 0, output: 0, reasoning: 0 };
}

function addUsage(total: Usage, usage: Usage): Usage {
  const next: Usage = {
    input: total.input + usage.input,
    cachedInput: total.cachedInput + usage.cachedInput,
    output: total.output + usage.output,
    reasoning: total.reasoning + usage.reasoning,
  };
  if (total.cost !== undefined || usage.cost !== undefined) {
    next.cost = (total.cost ?? 0) + (usage.cost ?? 0);
  }
  return next;
}

function stamp(createdAt: string): string {
  const all = createdAt.replace(/[:.]/g, "-");
  return all === "" ? "session" : all;
}

function sessionFileName(meta: SessionMetaInput): string {
  const folder = basename(meta.cwd) || "session";
  return `${stamp(meta.createdAt)}-${folder}.jsonl`;
}

function normalizeMeta(meta: SessionMetaInput): SessionMeta {
  return { type: "meta", ...meta };
}

function availablePath(
  dir: string,
  meta: SessionMeta,
  requested?: string,
): string {
  if (requested !== undefined) {
    return requested;
  }
  const base = join(dir, sessionFileName(meta));
  if (!existsSync(base) || statSync(base).size === 0) {
    return base;
  }
  try {
    const first = readFileSync(base, "utf8").split(/\r?\n/, 1)[0] ?? "";
    const entry: unknown = JSON.parse(first);
    if (isRecord(entry) && entry.id === meta.id) {
      return base;
    }
  } catch {
    return base;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = join(
      dir,
      `${sessionFileName(meta).slice(0, -6)}-${index}.jsonl`,
    );
    if (!existsSync(candidate) || statSync(candidate).size === 0) {
      return candidate;
    }
  }
  return base;
}

export function createSessionWriter(
  dir: string,
  metaInput: SessionMetaInput,
  requestedPath?: string,
  messages: Messages = getMessages(),
): SessionWriter {
  const meta = normalizeMeta(metaInput);
  let path = requestedPath ?? join(dir, sessionFileName(meta));
  try {
    path = availablePath(dir, meta, requestedPath);
  } catch {
    // Keep the requested path and let append report the failure once.
  }
  let ready = false;
  let failure: unknown;
  let warned = false;

  function ensure(): boolean {
    if (ready) {
      return true;
    }
    try {
      mkdirSync(dir, { recursive: true });
      if (!existsSync(path) || statSync(path).size === 0) {
        writeFileSync(path, `${JSON.stringify(meta)}\n`, "utf8");
      }
      ready = true;
      failure = undefined;
      return true;
    } catch (error) {
      failure = error;
      return false;
    }
  }

  function warning(): string | undefined {
    if (warned) {
      return undefined;
    }
    warned = true;
    return messages.session.saveError(errorMessage(failure));
  }

  ensure();

  return {
    path,
    append(entry) {
      if (!ensure()) {
        return warning();
      }
      try {
        appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
        return undefined;
      } catch (error) {
        failure = error;
        ready = false;
        return warning();
      }
    },
  };
}

type ParsedSession = {
  meta: SessionMeta;
  messages: Message[];
  usage: Usage;
  turns: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMessage(value: unknown): value is Message {
  return (
    isRecord(value) &&
    (value.role === "system" ||
      value.role === "user" ||
      value.role === "assistant" ||
      value.role === "tool") &&
    typeof value.content === "string"
  );
}

function isUsage(value: unknown): value is Usage {
  return (
    isRecord(value) &&
    typeof value.input === "number" &&
    typeof value.cachedInput === "number" &&
    typeof value.output === "number"
  );
}

function normalizeUsage(value: Usage): Usage {
  const usage: Usage = {
    input: value.input,
    cachedInput: value.cachedInput,
    output: value.output,
    reasoning: typeof value.reasoning === "number" ? value.reasoning : 0,
  };
  if (typeof value.cost === "number") {
    usage.cost = value.cost;
  }
  return usage;
}

function fallbackMeta(path: string): SessionMeta {
  return {
    type: "meta",
    id: basename(path, ".jsonl"),
    cwd: "",
    model: "",
    createdAt: "",
  };
}

function parseSession(path: string): ParsedSession {
  const text = readFileSync(path, "utf8");
  let meta: SessionMeta | undefined;
  let messages: Message[] = [];
  let usage = zeroUsage();
  let turns = 0;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(entry)) {
      continue;
    }
    if (entry.type === "meta") {
      if (
        meta === undefined &&
        typeof entry.id === "string" &&
        typeof entry.cwd === "string" &&
        typeof entry.model === "string" &&
        typeof entry.createdAt === "string"
      ) {
        meta = {
          type: "meta",
          id: entry.id,
          cwd: entry.cwd,
          model: entry.model,
          createdAt: entry.createdAt,
        };
      }
      continue;
    }
    if (entry.type === "message" && isMessage(entry.message)) {
      messages.push(entry.message);
      continue;
    }
    if (entry.type === "reset" && Array.isArray(entry.messages)) {
      messages = entry.messages.filter(isMessage);
      continue;
    }
    if (entry.type === "usage" && isUsage(entry.usage)) {
      usage = addUsage(usage, normalizeUsage(entry.usage));
      turns += 1;
    }
  }

  return { meta: meta ?? fallbackMeta(path), messages, usage, turns };
}

export function loadSession(path: string): LoadedSession {
  const parsed = parseSession(path);
  return {
    meta: parsed.meta,
    messages: parsed.messages,
    usage: parsed.usage,
  };
}

function firstUserText(messages: Message[]): string {
  for (const message of messages) {
    if (message.role === "user") {
      return Array.from(message.content.replace(/\s+/gu, " ").trim())
        .slice(0, 40)
        .join("");
    }
  }
  return "";
}

function timeOf(createdAt: string): number {
  const value = Date.parse(createdAt);
  return Number.isNaN(value) ? 0 : value;
}

export function listSessions(dir: string, cwd: string): SessionSummary[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }

  const sessions: SessionSummary[] = [];
  for (const name of names) {
    if (!name.endsWith(".jsonl")) {
      continue;
    }
    const path = join(dir, name);
    let parsed: ParsedSession;
    try {
      parsed = parseSession(path);
    } catch {
      continue;
    }
    if (parsed.meta.cwd !== cwd) {
      continue;
    }
    const firstUser = firstUserText(parsed.messages);
    const summary: SessionSummary = {
      id: parsed.meta.id,
      path,
      createdAt: parsed.meta.createdAt,
      firstUser,
      cost: parsed.usage.cost ?? 0,
      cacheRatio:
        parsed.usage.input === 0
          ? 0
          : parsed.usage.cachedInput / parsed.usage.input,
      turns: parsed.turns,
    };
    Object.defineProperties(summary, {
      preview: { value: firstUser, enumerable: false },
      firstMessage: { value: firstUser, enumerable: false },
      firstUserMessage: { value: firstUser, enumerable: false },
      count: { value: summary.turns, enumerable: false },
      totalCost: { value: summary.cost, enumerable: false },
    });
    sessions.push(summary);
  }

  sessions.sort((a, b) => {
    const difference = timeOf(b.createdAt) - timeOf(a.createdAt);
    return difference !== 0 ? difference : b.path.localeCompare(a.path);
  });
  return sessions;
}
