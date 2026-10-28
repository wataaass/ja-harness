import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cpSync,
  type Dirent,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { loadInstructions } from "../agent/instructions.js";
import {
  type Complete,
  type LoopEvent,
  repairMessages,
  runTurn,
  type Tool,
} from "../agent/loop.js";
import { notice } from "../agent/notice.js";
import { SYSTEM_PROMPT } from "../agent/prompt.js";
import { createRepeatTracker } from "../agent/repeat.js";
import {
  builtinSkillsDir,
  findSkillFolders,
  formatSkillList,
  loadSkills,
  parseSkill,
  parseSkillSource,
  readSkillFile,
  type Skill,
} from "../agent/skills.js";
import {
  loadSettings,
  readDisabledSkills,
  updateDisabledSkills,
} from "../cli/settings.js";
import { createContextManager, DEFAULT_CONTEXT } from "../context/manager.js";
import { createFileSaver, limitToolResult } from "../context/spill.js";
import { createEstimator, estimateMessages } from "../context/tokens.js";
import { findModel, MODELS, type ModelInfo } from "../llm/models.js";
import type { Message, ToolSpec, Usage } from "../llm/types.js";
import { connectMcp, type McpHub } from "../mcp/hub.js";
import { type ResolvedServer, resolveServers } from "../mcp/servers.js";
import type { Confirm, ConfirmRequest, Decision } from "../tools/confirm.js";
import { computeHunks, formatHunk } from "../tools/hunks.js";
import { createTools, type PlanHandler } from "../tools/index.js";
import { formatMcpList } from "../tools/mcp.js";
import { renderCard } from "./card.js";
import { type CheckpointFile, createCheckpoints } from "./checkpoints.js";
import { applyKey, type EditorState, renderEditor } from "./editor.js";
import { formatCost, formatTokens, formatTurnSummary } from "./format.js";
import { renderGreeting } from "./greeting.js";
import { createHistory } from "./history.js";
import { getMessages, type Messages } from "./i18n/index.js";
import {
  type DecoderState,
  decodeKeys,
  emptyDecoderState,
  flushEscape,
  type Key,
} from "./keys.js";
import {
  blockedToolMessage,
  MODES,
  type Mode,
  modeAllowsTool,
  modeLabel,
  modeNotice,
  nextMode,
  parseMode,
} from "./modes.js";
import {
  needsConfirm,
  PERMISSIONS,
  type Permission,
  parsePermission,
  permissionLabel,
} from "./permissions.js";
import { createScreen } from "./screen.js";
import {
  createSessionWriter,
  listSessions,
  loadSession,
  type SessionEntry,
  type SessionSummary,
  type SessionWriter,
} from "./sessions.js";
import { renderStatus } from "./status.js";
import { createTheme } from "./theme.js";
import { formatToolLine, toolMark } from "./tool-line.js";
import { summarizeEnd, summarizeStart } from "./tool-summary.js";
import { truncate, wrap } from "./width.js";

export type AppInput = {
  on(event: "data", listener: (chunk: string | Buffer) => void): unknown;
  off?(event: "data", listener: (chunk: string | Buffer) => void): unknown;
  setRawMode?(mode: boolean): void;
  isTTY?: boolean;
};

export type AppOutput = {
  write(s: string): void;
  columns?: number;
  isTTY?: boolean;
  on?(event: "resize", listener: () => void): unknown;
  off?(event: "resize", listener: () => void): unknown;
};

export type AppOptions = {
  input: AppInput;
  output: AppOutput;
  env: NodeJS.ProcessEnv;
  cwd: string;
  home?: string;
  makeComplete: (model: string, effort?: string) => Complete;
  createTools?: (confirm: Confirm, plan?: PlanHandler) => Tool[];
  connectMcp?: typeof connectMcp;
  contextWindow: number;
  model: string;
  effort?: string;
  version: string;
  resume?: string;
  continueLatest?: boolean;
  prices?: { input: number; cachedInput: number; cacheWrite?: number };
  lang?: string;
  timing?: {
    escape?: number;
    doubleEscape?: number;
    exit?: number;
  };
};

type PendingConfirm = {
  request: ConfirmRequest;
  resolve: (decision: Decision) => void;
  phase: "card" | "hunk" | "reason";
  reason: EditorState;
  hunkIndex?: number;
  hunkAccepted?: boolean[];
};

type Review = {
  files: CheckpointFile[];
  index: number;
  scroll: number;
  phase: "card" | "input";
  input: EditorState;
};

type PendingPlan = {
  path: string;
  markdown: string;
  resolve: (result: string) => void;
  phase: "card" | "reason";
  reason: EditorState;
};

type SkillPickerItem = {
  skill: Skill;
  enabled: boolean;
  locked: boolean;
};

type Picker =
  | { kind: "mode"; index: number }
  | { kind: "permission"; index: number }
  | { kind: "model"; modelIndex: number; effortIndex: number }
  | { kind: "session"; sessions: SessionSummary[]; index: number }
  | { kind: "skills"; items: SkillPickerItem[]; index: number };

type Warning = {
  text: string;
  onYes: () => void;
  onNo?: () => void;
  title?: string;
  footer?: string;
  lines?: string[];
};

type QueuedInput = { text: string; content?: string; notice?: string };

type Command = { name: string };

const DEFAULT_TIMING = {
  escape: 30,
  doubleEscape: 500,
  exit: 2000,
};

function commands(): Command[] {
  return [
    { name: "/help" },
    { name: "/mode" },
    { name: "/permission" },
    { name: "/model" },
    { name: "/details" },
    { name: "/undo" },
    { name: "/resume" },
    { name: "/skills" },
    { name: "/clear" },
    { name: "/compact" },
    { name: "/summarize" },
    { name: "/context" },
  ];
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
  const cost = (total.cost ?? 0) + (usage.cost ?? 0);
  if (total.cost !== undefined || usage.cost !== undefined) {
    next.cost = cost;
  }
  return next;
}

function confirmKey(request: ConfirmRequest): string {
  return request.key ?? `${request.tool}\u0000${request.detail}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function priceText(value: number): string {
  return String(value);
}

function modelRow(info: ModelInfo, messages: Messages): string {
  return messages.app.modelRow(
    info.label,
    priceText(info.prices.input),
    priceText(info.prices.cachedInput),
    priceText(info.prices.output),
  );
}

function sessionDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt.slice(0, 16).replace("T", " ");
  }
  const month = date.getMonth() + 1;
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function sessionRow(session: SessionSummary, messages: Messages): string {
  const text =
    session.firstUser === "" ? messages.session.empty : session.firstUser;
  return messages.session.row(
    sessionDate(session.createdAt),
    text,
    formatCost(session.cost, messages),
    session.turns,
  );
}

export async function runApp(o: AppOptions): Promise<number> {
  const timing = { ...DEFAULT_TIMING, ...o.timing };
  const screen = createScreen(o.output);
  let booting = true;
  const earlyChunks: (string | Buffer)[] = [];
  const onEarlyData = (chunk: string | Buffer): void => {
    if (booting) {
      earlyChunks.push(chunk);
    }
  };
  o.input.on("data", onEarlyData);
  const home = o.home ?? o.cwd;
  const { settings, warnings } = loadSettings({
    cwd: o.cwd,
    home,
    env: o.env,
  });
  const instructions = loadInstructions({ cwd: o.cwd, home });
  const loadSkillState = () =>
    loadSkills({
      cwd: o.cwd,
      home,
      builtinDir: builtinSkillsDir(),
      disabled:
        loadSettings({ cwd: o.cwd, home, env: o.env }).settings.skills
          ?.disabled ?? [],
    });
  let skillState = loadSkillState();
  let mcpServers = resolveServers(settings.mcp, {
    onWarning: (warning) => warnings.push(warning),
  });
  let hub: McpHub = mcpServers.some((server) => server.enabled)
    ? await (o.connectMcp ?? connectMcp)(mcpServers, { cwd: o.cwd })
    : {
        tools: [],
        warnings: [],
        async call() {
          throw new Error("MCP is not connected.");
        },
        async close() {},
      };
  warnings.push(...hub.warnings);
  let systemContent =
    SYSTEM_PROMPT +
    instructions.text +
    formatSkillList(skillState.skills) +
    formatMcpList(hub.tools);
  const theme = createTheme({
    env: o.env,
    isTTY: o.output.isTTY ?? o.input.isTTY ?? false,
    ...(settings.ui?.theme === "dark" ? { dark: true } : {}),
    ...(settings.ui?.theme === "light" ? { dark: false } : {}),
  });
  const messages = getMessages(o.lang ?? settings.language?.ui);
  const commandList = commands();
  const history = createHistory();
  const estimate = createEstimator();
  const saver = createFileSaver(join(o.cwd, ".ja-harness", "out"));
  const save = (text: string) => relative(o.cwd, saver(text));

  let mode: Mode = settings.mode ?? "run";
  let permission: Permission = settings.permission ?? "ask";
  let model = settings.model ?? o.model;
  let effort =
    o.effort ?? settings.effort ?? findModel(model)?.defaultEffort ?? "high";

  const currentComplete = (): Complete => o.makeComplete(model, effort);

  const manager = createContextManager({
    config: {
      ...DEFAULT_CONTEXT,
      contextWindow: o.contextWindow,
      ...(o.prices === undefined ? {} : { prices: o.prices }),
    },
    complete: (messages, tools, cb) =>
      currentComplete()(messages, tools, {
        onText: () => {},
        onReasoning: () => {},
        ...(cb ?? {}),
      }),
    estimate,
  });

  const conversation: Message[] = [{ role: "system", content: systemContent }];
  const queue: QueuedInput[] = [];
  const alwaysAllowed = new Set<string>();

  const checkpoints = createCheckpoints();
  let editor: EditorState = { text: "", cursor: 0 };
  let pending: PendingConfirm | undefined;
  let review: Review | undefined;
  let plan: PendingPlan | undefined;
  let picker: Picker | undefined;
  let contextView: string[] | undefined;
  let warning: Warning | undefined;
  let pendingNotice: string | undefined;
  let activeTool: { name: string; summary: string } | undefined;
  let decoder: DecoderState = emptyDecoderState();
  const utf8Decoder = new StringDecoder("utf8");
  let escapeTimer: ReturnType<typeof setTimeout> | undefined;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let exitAskedAt: number | undefined;
  let lastEscapeAt: number | undefined;
  let lastSubmitted: string | undefined;
  let live = "";
  let thinking = false;
  let busy = false;
  let closed = false;
  let abort: AbortController | undefined;
  let stopShown = false;
  let turnSaved = false;
  let details = settings.ui?.details === "verbose";
  let reasoningBuffer = "";
  let reasoningShown = false;
  let slashIndex = 0;
  let workspaceFilesCache: string[] | undefined;

  let sessionUsage = zeroUsage();
  let turnUsage = zeroUsage();
  let lastStepInput = 0;
  const tierWarned = new Set<string>();

  const sessionsDir = join(o.home ?? o.cwd, ".ja-harness", "sessions");
  let sessionWriter: SessionWriter | undefined;
  let sessionId = "";
  let recordedMessages = 0;
  let savedByContext = 0;
  let booted = false;
  const startupLines: string[] = [];

  let resolveRun: (code: number) => void = () => {};
  const finished = new Promise<number>((resolve) => {
    resolveRun = resolve;
  });

  function width(): number {
    const value = o.output.columns;
    if (value === undefined || !Number.isFinite(value)) {
      return 80;
    }
    return Math.max(1, Math.floor(value));
  }

  function totalUsage(): Usage {
    return addUsage(sessionUsage, turnUsage);
  }

  function writeSession(entry: SessionEntry): void {
    if (sessionWriter === undefined) {
      return;
    }
    const text = sessionWriter.append(entry);
    if (text !== undefined) {
      if (booted) {
        emit([` ${text}`]);
      } else {
        startupLines.push(` ${text}`);
      }
    }
  }

  function recordMessages(): void {
    for (
      let index = recordedMessages;
      index < conversation.length;
      index += 1
    ) {
      const message = conversation[index];
      if (message !== undefined) {
        writeSession({ type: "message", message });
      }
    }
    recordedMessages = conversation.length;
  }

  function recordReset(): void {
    writeSession({ type: "reset", messages: [...conversation] });
    recordedMessages = conversation.length;
  }

  function newSession(): void {
    const createdAt = new Date().toISOString();
    const meta = {
      type: "meta" as const,
      id: randomUUID(),
      cwd: o.cwd,
      model,
      createdAt,
    };
    sessionId = meta.id;
    sessionWriter = createSessionWriter(sessionsDir, meta, undefined, messages);
    recordedMessages = 0;
    recordMessages();
  }

  function applyLoadedSession(summary: SessionSummary): boolean {
    try {
      const loaded = loadSession(summary.path);
      conversation.splice(0, conversation.length, ...loaded.messages);
      if (conversation.length === 0 || conversation[0]?.role !== "system") {
        conversation.unshift({ role: "system", content: systemContent });
      }
      sessionId = loaded.meta.id === "" ? summary.id : loaded.meta.id;
      sessionWriter = createSessionWriter(
        sessionsDir,
        loaded.meta,
        summary.path,
        messages,
      );
      recordedMessages = conversation.length;
      sessionUsage = loaded.usage;
      turnUsage = zeroUsage();
      lastStepInput = 0;
      savedByContext = 0;
      return true;
    } catch {
      return false;
    }
  }

  function findSessionIn(
    sessions: SessionSummary[],
    key: string,
  ): SessionSummary | undefined {
    return (
      sessions.find((session) => session.id === key) ??
      sessions.find((session) => session.path === key) ??
      sessions.find((session) => basename(session.path) === key) ??
      sessions.find((session) => basename(session.path, ".jsonl") === key)
    );
  }

  function makeTools(): Tool[] {
    return (
      o.createTools ??
      ((fn, planFn) =>
        createTools(o.cwd, fn, {
          plan: planFn,
          beforeWrite: (abs) => checkpoints.recordBefore(abs),
          skills: skillState.skills,
          mcp: hub,
        }))
    )(confirmWithPermission, planHandler);
  }

  function enabledServersKey(servers: ResolvedServer[]): string {
    return JSON.stringify(
      servers
        .filter((server) => server.enabled)
        .map((server) => [server.name, server.config])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  }

  function rebuildSystemContent(): void {
    systemContent =
      SYSTEM_PROMPT +
      loadInstructions({ cwd: o.cwd, home }).text +
      formatSkillList(skillState.skills) +
      formatMcpList(hub.tools);
  }

  function resetConversation(): void {
    conversation.splice(0, conversation.length, {
      role: "system",
      content: systemContent,
    });
    sessionUsage = zeroUsage();
    turnUsage = zeroUsage();
    lastStepInput = 0;
    newSession();
    emit([messages.app.cleared]);
  }

  async function reconnectMcp(
    nextServers: ResolvedServer[],
    nextWarnings: string[],
  ): Promise<void> {
    busy = true;
    render();
    try {
      await hub.close();
      hub = await (o.connectMcp ?? connectMcp)(nextServers, { cwd: o.cwd });
      mcpServers = nextServers;
      for (const text of [...nextWarnings, ...hub.warnings]) {
        emit([theme.warn(` ${text}`)]);
      }
      rebuildSystemContent();
      resetConversation();
    } catch (error) {
      if (!closed) {
        emit([
          theme.error(` ✕ ${errorMessage(error).split(/\r?\n/)[0] ?? ""}`),
        ]);
      }
    } finally {
      if (!closed) {
        busy = false;
        render();
      }
    }
  }

  function toolSpecs(): ToolSpec[] {
    return makeTools().map(({ name, description, parameters }) => ({
      name,
      description,
      parameters,
    }));
  }

  function tierWarning(): boolean {
    const tier = findModel(model)?.tier;
    return tier !== undefined && lastStepInput > tier.above * 0.9;
  }

  function maybeWarnTier(input: number): void {
    const info = findModel(model);
    const tier = info?.tier;
    if (info === undefined || tier === undefined) {
      return;
    }
    const threshold = tier.above * 0.9;
    if (input <= threshold || tierWarned.has(info.id)) {
      return;
    }
    tierWarned.add(info.id);
    const factor =
      info.prices.input === 0 ? 1 : tier.prices.input / info.prices.input;
    const factorText = String(Number(factor.toFixed(2)));
    emit([
      messages.app.tierWarning(
        formatTokens(threshold),
        formatTokens(tier.above),
        factorText,
      ),
    ]);
  }

  function statusLine(maxWidth: number): string {
    if (exitAskedAt !== undefined) {
      return truncate(theme.dim(messages.app.exitAgain), maxWidth);
    }
    const total = totalUsage();
    const contextRatio =
      o.contextWindow > 0 ? lastStepInput / o.contextWindow : 0;
    return renderStatus({
      mode: modeLabel(mode, messages),
      permission: permissionLabel(permission, messages),
      model,
      effort,
      contextRatio,
      cost: total.cost ?? 0,
      cacheRatio: total.input === 0 ? 0 : total.cachedInput / total.input,
      queued: queue.length,
      warn: contextRatio >= 0.85 || tierWarning(),
      theme,
      width: maxWidth,
      messages,
    });
  }

  function editorWidth(maxWidth: number): number {
    const inner = maxWidth >= 60 ? maxWidth - 4 : maxWidth - 2;
    return Math.max(1, inner - 2);
  }

  function bodyLines(lines: string[]): string[] {
    return lines.map((line, index) => `${index === 0 ? "› " : "  "}${line}`);
  }

  function modalBody(lines: string[]): string[] {
    return lines;
  }

  function renderPicker(maxWidth: number): string[] {
    const current = picker;
    if (current === undefined) {
      return [];
    }
    if (current.kind === "mode") {
      const body = MODES.map((item, index) => {
        const text = ` ${index === current.index ? "●" : " "} ${modeLabel(item, messages)}`;
        return index === current.index ? theme.accent(text) : text;
      });
      return renderCard({
        title: messages.app.picker.modeTitle,
        body,
        footer: messages.app.picker.decideFooter,
        width: maxWidth,
        theme,
      });
    }
    if (current.kind === "permission") {
      const body = PERMISSIONS.map((item, index) => {
        const text = ` ${index === current.index ? "●" : " "} ${permissionLabel(item, messages)}`;
        return index === current.index ? theme.accent(text) : text;
      });
      return renderCard({
        title: messages.app.picker.permissionTitle,
        body,
        footer: messages.app.picker.decideFooter,
        width: maxWidth,
        theme,
      });
    }
    if (current.kind === "session") {
      const body = current.sessions.map((session, index) => {
        const text = ` ${index === current.index ? "●" : " "} ${sessionRow(session, messages)}`;
        return index === current.index ? theme.accent(text) : text;
      });
      return renderCard({
        title: messages.app.picker.sessionTitle,
        body,
        footer: messages.app.picker.sessionFooter,
        width: maxWidth,
        theme,
      });
    }
    if (current.kind === "skills") {
      const body = current.items.map((item, index) => {
        const mark = item.locked ? "[-]" : item.enabled ? "[x]" : "[ ]";
        const line = `- ${item.skill.name}: ${item.skill.description}`;
        const text = messages.app.picker.skillsRow(
          mark,
          item.skill.name,
          item.skill.source,
          String(estimate(line)),
        );
        return index === current.index ? theme.accent(text) : text;
      });
      return renderCard({
        title: messages.app.picker.skillsTitle,
        body,
        footer: messages.app.picker.skillsFooter,
        width: maxWidth,
        theme,
      });
    }
    const info = MODELS[current.modelIndex] ?? MODELS[0];
    if (info === undefined) {
      return [];
    }
    const efforts = info.efforts.map((item, index) => {
      const text =
        index === Math.min(current.effortIndex, info.efforts.length - 1)
          ? `[${item}]`
          : ` ${item} `;
      return index === current.effortIndex ? theme.accent(text) : text;
    });
    const body: string[] = [
      ` ${messages.app.picker.effortLabel}  ${efforts.join("  ")}`,
    ];
    for (let index = 0; index < MODELS.length; index += 1) {
      const item = MODELS[index];
      if (item === undefined) {
        continue;
      }
      const active = index === current.modelIndex;
      const marker = model === item.id ? "●" : " ";
      const text = `${marker} ${modelRow(item, messages)}`;
      body.push(active ? theme.accent(text) : text);
    }
    return renderCard({
      title: messages.app.picker.modelTitle,
      body,
      footer: messages.app.picker.modelFooter,
      width: maxWidth,
      theme,
    });
  }

  function renderPlan(maxWidth: number): string[] {
    if (plan === undefined) {
      return [];
    }
    if (plan.phase === "reason") {
      const rendered = renderEditor(plan.reason, editorWidth(maxWidth));
      return renderCard({
        title: messages.app.plan.reasonTitle,
        body: bodyLines(rendered.lines),
        footer: messages.app.plan.reasonFooter,
        width: maxWidth,
        theme,
      });
    }
    const lines = plan.markdown.split(/\r?\n/);
    const body = lines.slice(0, 30);
    if (lines.length > 30) {
      body.push(messages.app.moreLines(lines.length - 30));
    }
    return renderCard({
      title: messages.app.plan.title(plan.path),
      body,
      footer: messages.app.plan.footer,
      width: maxWidth,
      theme,
    });
  }

  function editPath(title: string): string {
    const prefix = messages.app.editPathPrefix;
    return title.startsWith(prefix) ? title.slice(prefix.length) : title;
  }

  function reviewDiff(file: CheckpointFile): string[] {
    const before = file.before ?? "";
    let after = "";
    if (existsSync(file.path)) {
      try {
        after = readFileSync(file.path, "utf8");
      } catch {
        after = "";
      }
    }
    const hunks = computeHunks(before, after);
    return hunks.flatMap((hunk, index) =>
      formatHunk(file.path, hunk, index, hunks.length),
    );
  }

  function reviewView(maxWidth: number): {
    lines: string[];
    cursor?: { row: number; col: number };
  } {
    const current = review;
    if (current === undefined) {
      return { lines: [] };
    }
    const file = current.files[current.index];
    if (file === undefined) {
      return { lines: [] };
    }
    const path = relative(o.cwd, file.path) || file.path;

    if (current.phase === "input") {
      const rendered = renderEditor(current.input, editorWidth(maxWidth));
      return {
        lines: renderCard({
          title: messages.app.review.inputTitle,
          body: bodyLines(rendered.lines),
          footer: messages.app.review.inputFooter,
          width: maxWidth,
          theme,
        }),
        cursor: { row: 1 + rendered.cursorRow, col: 4 + rendered.cursorCol },
      };
    }

    const diff = reviewDiff(file);
    const body = diff.slice(current.scroll, current.scroll + 20);
    if (body.length === 0) {
      body.push(messages.app.review.noChanges);
    }
    return {
      lines: renderCard({
        title: messages.app.review.title(
          path,
          current.index + 1,
          current.files.length,
        ),
        body,
        footer: messages.app.review.footer,
        width: maxWidth,
        theme,
      }),
    };
  }

  function render(): void {
    if (closed) {
      return;
    }
    const maxWidth = width();
    const lines: string[] = [];
    let cursor: { row: number; col: number } | undefined;

    if (pending !== undefined) {
      if (pending.phase === "reason") {
        const rendered = renderEditor(pending.reason, editorWidth(maxWidth));
        const top = lines.length;
        lines.push(
          ...renderCard({
            title: messages.app.rejectReason.title,
            body: bodyLines(rendered.lines),
            footer: messages.app.rejectReason.footer,
            width: maxWidth,
            theme,
          }),
        );
        cursor = {
          row: top + 1 + rendered.cursorRow,
          col: 4 + rendered.cursorCol,
        };
      } else if (
        pending.phase === "hunk" &&
        pending.request.hunks !== undefined
      ) {
        const hunks = pending.request.hunks;
        const index = pending.hunkIndex ?? 0;
        lines.push(
          ...renderCard({
            title: messages.app.hunk.title(
              editPath(pending.request.title),
              index + 1,
              hunks.length,
            ),
            body: hunks[index] ?? [],
            footer: messages.app.hunk.footer,
            width: maxWidth,
            theme,
          }),
        );
      } else {
        const detail = pending.request.detail.split(/\r?\n/);
        const body = pending.request.detail === "" ? [] : detail.slice(0, 20);
        if (detail.length > 20) {
          body.push(messages.app.moreLines(detail.length - 20));
        }
        lines.push(
          ...renderCard({
            title: pending.request.title,
            body,
            footer: messages.app.confirmFooter,
            width: maxWidth,
            theme,
          }),
        );
      }
    } else if (review !== undefined) {
      const top = lines.length;
      const view = reviewView(maxWidth);
      lines.push(...view.lines);
      if (view.cursor !== undefined) {
        cursor = {
          row: top + view.cursor.row,
          col: view.cursor.col,
        };
      }
    } else if (plan !== undefined) {
      const top = lines.length;
      lines.push(...renderPlan(maxWidth));
      if (plan.phase === "reason") {
        const rendered = renderEditor(plan.reason, editorWidth(maxWidth));
        cursor = {
          row: top + 1 + rendered.cursorRow,
          col: 4 + rendered.cursorCol,
        };
      }
    } else if (contextView !== undefined) {
      lines.push(
        ...renderCard({
          title: messages.app.contextTitle,
          body: contextView,
          footer: messages.app.contextFooter,
          width: maxWidth,
          theme,
        }),
      );
    } else if (warning !== undefined) {
      lines.push(
        ...renderCard({
          title: warning.title ?? messages.app.permissionTitle,
          body: warning.lines ?? modalBody([warning.text]),
          footer: warning.footer ?? messages.app.warningFooter,
          width: maxWidth,
          theme,
        }),
      );
    } else if (picker !== undefined) {
      lines.push(...renderPicker(maxWidth));
    } else {
      if (thinking) {
        lines.push(theme.dim(` ${messages.app.thinking}`));
      }
      if (live !== "") {
        lines.push(truncate(`  ${live}`, maxWidth));
      }
      if (activeTool !== undefined) {
        lines.push(
          truncate(
            ` ${toolMark(activeTool.name, messages)}  ${activeTool.summary} …`,
            maxWidth,
          ),
        );
      }
      const slash = slashCandidates();
      if (slash.length > 0) {
        for (let index = 0; index < slash.length; index += 1) {
          const item = slash[index];
          if (item === undefined) {
            continue;
          }
          const text = ` ${item.name}`;
          lines.push(
            truncate(
              index === slashIndex ? theme.accent(` ›${text}`) : `  ${text}`,
              maxWidth,
            ),
          );
        }
      } else {
        for (const path of atCandidates()) {
          lines.push(truncate(theme.dim(`  @${path}`), maxWidth));
        }
      }
      const rendered = renderEditor(editor, editorWidth(maxWidth));
      const top = lines.length;
      lines.push(
        ...renderCard({
          title: "",
          body: bodyLines(rendered.lines),
          width: maxWidth,
          theme,
        }),
      );
      cursor = {
        row: top + 1 + rendered.cursorRow,
        col: 4 + rendered.cursorCol,
      };
    }

    lines.push(statusLine(maxWidth));
    screen.setBottom(lines, cursor);
  }

  function emit(lines: string[]): void {
    if (closed) {
      return;
    }
    screen.print(lines);
    render();
  }

  function answerLines(text: string): string[] {
    return text.split(/\r?\n/).flatMap((line) => {
      if (line === "") {
        return ["  "];
      }
      return wrap(line, width() - 2).map((part) => `  ${part}`);
    });
  }

  function printUser(text: string, duringWork: boolean): void {
    const parts = text.split(/\r?\n/);
    const limit = Math.max(1, width() - 3);
    const lines: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i] ?? "";
      const wrapped = part === "" ? [""] : wrap(part, limit);
      for (let j = 0; j < wrapped.length; j += 1) {
        const prefix = i === 0 && j === 0 ? " › " : "   ";
        lines.push(`${prefix}${wrapped[j] ?? ""}`);
      }
    }
    if (lines.length === 0) {
      lines.push(" › ");
    }
    if (duringWork) {
      lines[lines.length - 1] += messages.app.duringWork;
    }
    emit(lines);
  }

  function flushLive(): void {
    if (live !== "") {
      const text = live;
      live = "";
      emit(answerLines(text));
    }
  }

  function resolvePending(decision: Decision): void {
    const current = pending;
    pending = undefined;
    current?.resolve(decision);
    render();
  }

  function setMode(next: Mode, withNotice = true): void {
    const changed = next !== mode;
    mode = next;
    if (changed && withNotice) {
      pendingNotice = modeNotice(next);
    }
    render();
  }

  function toggleDetails(): void {
    details = !details;
    emit([
      messages.app.details.changed(
        details ? messages.app.details.on : messages.app.details.off,
      ),
    ]);
  }

  function printReasoning(): void {
    if (!details || reasoningShown || reasoningBuffer === "") {
      return;
    }
    reasoningShown = true;
    const lines = reasoningBuffer
      .replace(/\r\n/g, "\n")
      .split("\n")
      .slice(0, 3);
    emit(lines.map((line) => theme.dim(`  ${truncate(line, width() - 2)}`)));
  }

  function workspaceFiles(): string[] {
    if (workspaceFilesCache !== undefined) {
      return workspaceFilesCache;
    }
    const files: string[] = [];
    const skip = new Set([".git", "node_modules", ".ja-harness", "dist"]);
    const walk = (dir: string, prefix: string): void => {
      if (files.length >= 2000) {
        return;
      }
      let entries: Dirent[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (files.length >= 2000) {
          return;
        }
        const next = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!skip.has(entry.name)) {
            walk(join(dir, entry.name), next);
          }
        } else if (entry.isFile()) {
          files.push(next);
        }
      }
    };
    walk(o.cwd, "");
    workspaceFilesCache = files;
    return files;
  }

  function slashCandidates(): Command[] {
    if (!/^\/\S*$/.test(editor.text)) {
      return [];
    }
    const known = new Set(commandList.map((command) => command.name));
    const items = [
      ...commandList,
      ...skillState.skills
        .map((skill) => ({ name: `/${skill.name}` }))
        .filter((command) => !known.has(command.name)),
    ];
    return items
      .filter((command) => command.name.startsWith(editor.text))
      .slice(0, 8);
  }

  function atWord(): { start: number; end: number; query: string } | undefined {
    const chars = [...editor.text];
    const cursor = Math.min(Math.max(editor.cursor, 0), chars.length);
    let start = cursor;
    while (start > 0 && !/\s/u.test(chars[start - 1] ?? "")) {
      start -= 1;
    }
    const word = chars.slice(start, cursor).join("");
    if (!word.startsWith("@")) {
      return undefined;
    }
    return { start, end: cursor, query: word.slice(1) };
  }

  function atCandidates(): string[] {
    const word = atWord();
    if (word === undefined) {
      return [];
    }
    return workspaceFiles()
      .filter((path) => path.includes(word.query))
      .sort((a, b) => a.length - b.length || a.localeCompare(b))
      .slice(0, 8);
  }

  function applyAtCompletion(path: string): void {
    const word = atWord();
    if (word === undefined) {
      return;
    }
    const chars = [...editor.text];
    const insert = [...`@${path} `];
    chars.splice(word.start, word.end - word.start, ...insert);
    editor = {
      text: chars.join(""),
      cursor: word.start + insert.length,
    };
  }

  function requestPlan(markdown: string): Promise<string> {
    const dir = join(o.cwd, ".ja-harness", "plans");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const abs = join(dir, `${stamp}.md`);
    writeFileSync(abs, markdown, "utf8");
    const path = relative(o.cwd, abs) || abs;
    return new Promise<string>((resolve) => {
      plan = {
        path,
        markdown,
        resolve,
        phase: "card",
        reason: { text: "", cursor: 0 },
      };
      render();
    });
  }

  const planHandler: PlanHandler = async (markdown) => {
    if (mode !== "plan") {
      return "submit_plan is only available in plan mode.";
    }
    return requestPlan(markdown);
  };

  const confirm: Confirm = (request) => {
    if (closed) {
      return Promise.resolve({ allow: false });
    }
    if (alwaysAllowed.has(confirmKey(request))) {
      return Promise.resolve({ allow: true });
    }
    return new Promise<Decision>((resolve) => {
      const hunks = request.hunks;
      const withHunks = hunks !== undefined && hunks.length > 0;
      pending = {
        request,
        resolve,
        phase: withHunks ? "hunk" : "card",
        reason: { text: "", cursor: 0 },
        ...(withHunks ? { hunkIndex: 0, hunkAccepted: [] } : {}),
      };
      render();
    });
  };

  const confirmWithPermission: Confirm = (request) => {
    if (!needsConfirm(permission, request)) {
      return Promise.resolve(true);
    }
    return confirm(request);
  };

  let terminalRestored = false;

  function restoreTerminal(): void {
    if (terminalRestored) {
      return;
    }
    terminalRestored = true;
    o.input.setRawMode?.(false);
    o.output.write("\x1b[?2004l\x1b[>4;0m");
  }

  function finish(code: number): void {
    if (closed) {
      return;
    }
    closed = true;
    if (escapeTimer !== undefined) {
      clearTimeout(escapeTimer);
      escapeTimer = undefined;
    }
    if (exitTimer !== undefined) {
      clearTimeout(exitTimer);
      exitTimer = undefined;
    }
    if (pending !== undefined) {
      const current = pending;
      pending = undefined;
      current.resolve({ allow: false });
    }
    if (plan !== undefined) {
      const current = plan;
      plan = undefined;
      current.resolve(
        "The user rejected the plan. Stop and ask what they want instead.",
      );
    }
    abort?.abort();
    void hub.close();
    o.input.off?.("data", onData);
    o.output.off?.("resize", onResize);
    process.off("exit", restoreTerminal);
    restoreTerminal();
    screen.close();
    resolveRun(code);
  }

  function handleEscapeIdle(): void {
    const now = Date.now();
    if (
      lastEscapeAt !== undefined &&
      now - lastEscapeAt <= timing.doubleEscape &&
      lastSubmitted !== undefined
    ) {
      editor = {
        text: lastSubmitted,
        cursor: [...lastSubmitted].length,
      };
      lastEscapeAt = undefined;
      render();
      return;
    }
    lastEscapeAt = now;
    render();
  }

  function handleExitRequest(): void {
    const now = Date.now();
    if (exitAskedAt !== undefined && now - exitAskedAt <= timing.exit) {
      if (exitTimer !== undefined) {
        clearTimeout(exitTimer);
        exitTimer = undefined;
      }
      exitAskedAt = undefined;
      finish(0);
      return;
    }
    if (exitTimer !== undefined) {
      clearTimeout(exitTimer);
    }
    exitAskedAt = now;
    exitTimer = setTimeout(() => {
      exitTimer = undefined;
      exitAskedAt = undefined;
      render();
    }, timing.exit);
    render();
  }

  function handleConfirmKey(key: Key): void {
    if (pending === undefined) {
      return;
    }
    const hunks = pending.request.hunks;
    const hasHunks = hunks !== undefined && hunks.length > 0;

    if (key.type === "ctrl" && key.key === "d") {
      if (hunks !== undefined && hunks.length > 0) {
        resolvePending({
          allow: false,
          acceptedHunks: hunks.map(() => false),
        });
      } else {
        resolvePending({ allow: false });
      }
      return;
    }

    if (pending.phase === "reason") {
      if (key.type === "escape") {
        pending.phase = hasHunks ? "hunk" : "card";
        render();
        return;
      }
      if (key.type === "enter") {
        const reason = pending.reason.text.trim();
        const accepted = pending.hunkAccepted;
        resolvePending({
          allow: accepted?.some(Boolean) ?? false,
          ...(accepted === undefined ? {} : { acceptedHunks: accepted }),
          ...(reason === "" ? {} : { reason }),
        });
        return;
      }
      const result = applyKey(pending.reason, key);
      pending.reason = result.state;
      render();
      return;
    }

    if (pending.phase === "hunk" && hunks !== undefined && hunks.length > 0) {
      const active = pending;
      const index = active.hunkIndex ?? 0;
      const accepted = [...(active.hunkAccepted ?? [])];
      const finish = (): void => {
        resolvePending({
          allow: accepted.some(Boolean),
          acceptedHunks: accepted,
        });
      };
      const step = (accept: boolean): void => {
        accepted[index] = accept;
        if (index + 1 < hunks.length) {
          active.hunkIndex = index + 1;
          active.hunkAccepted = accepted;
          render();
        } else {
          finish();
        }
      };

      if (key.type === "enter") {
        step(true);
        return;
      }
      if (key.type === "escape") {
        step(false);
        return;
      }
      if (key.type === "char") {
        const text = key.text.toLowerCase();
        if (text.includes("a")) {
          for (let i = index; i < hunks.length; i += 1) {
            accepted[i] = true;
          }
          finish();
          return;
        }
        if (text.includes("e")) {
          for (let i = index; i < hunks.length; i += 1) {
            accepted[i] = false;
          }
          active.hunkAccepted = accepted;
          active.phase = "reason";
          active.reason = { text: "", cursor: 0 };
          render();
        }
      }
      return;
    }

    if (key.type === "enter") {
      resolvePending({ allow: true });
      return;
    }
    if (key.type === "escape") {
      resolvePending({ allow: false });
      return;
    }
    if (key.type === "char") {
      const text = key.text.toLowerCase();
      if (text.includes("a")) {
        alwaysAllowed.add(confirmKey(pending.request));
        resolvePending({ allow: true, always: true });
        return;
      }
      if (text.includes("e")) {
        pending.phase = "reason";
        pending.reason = { text: "", cursor: 0 };
        render();
      }
    }
  }

  function resolvePlan(result: string): void {
    const current = plan;
    plan = undefined;
    current?.resolve(result);
    render();
  }

  function handlePlanKey(key: Key): void {
    if (plan === undefined) {
      return;
    }
    if (key.type === "ctrl" && key.key === "d") {
      resolvePlan(
        "The user rejected the plan. Stop and ask what they want instead.",
      );
      return;
    }
    if (plan.phase === "reason") {
      if (key.type === "escape") {
        plan.phase = "card";
        render();
        return;
      }
      if (key.type === "enter") {
        const reason = plan.reason.text.trim();
        resolvePlan(
          `The user asked for changes: ${reason}. Revise the plan and call submit_plan again.`,
        );
        return;
      }
      const result = applyKey(plan.reason, key);
      plan.reason = result.state;
      render();
      return;
    }

    if (key.type === "enter") {
      setMode("run", false);
      resolvePlan(
        "The user approved the plan. Switch to implementing it now; editing and commands are allowed.",
      );
      return;
    }
    if (key.type === "escape") {
      resolvePlan(
        "The user rejected the plan. Stop and ask what they want instead.",
      );
      return;
    }
    if (key.type === "char" && key.text.toLowerCase().includes("e")) {
      plan.phase = "reason";
      plan.reason = { text: "", cursor: 0 };
      render();
    }
  }

  function handleWarningKey(key: Key): void {
    if (warning === undefined) {
      return;
    }
    if (key.type === "enter") {
      const current = warning;
      warning = undefined;
      current.onYes();
      render();
      return;
    }
    if (key.type === "escape" || (key.type === "ctrl" && key.key === "d")) {
      const current = warning;
      warning = undefined;
      current.onNo?.();
      render();
    }
  }

  function openReview(): void {
    const files = checkpoints.changedFiles(0);
    if (files.length === 0) {
      emit([messages.app.reviewEmpty]);
      return;
    }
    review = {
      files,
      index: 0,
      scroll: 0,
      phase: "card",
      input: { text: "", cursor: 0 },
    };
    render();
  }

  function handleReviewKey(key: Key): void {
    const current = review;
    if (current === undefined) {
      return;
    }

    if (current.phase === "input") {
      if (key.type === "escape") {
        current.phase = "card";
        render();
        return;
      }
      if (key.type === "ctrl" && key.key === "d") {
        review = undefined;
        render();
        return;
      }
      if (key.type === "enter") {
        const text = current.input.text.trim();
        if (text === "") {
          return;
        }
        review = undefined;
        submit(text);
        return;
      }
      const result = applyKey(current.input, key);
      current.input = result.state;
      render();
      return;
    }

    if (key.type === "escape" || (key.type === "ctrl" && key.key === "d")) {
      review = undefined;
      render();
      return;
    }
    if (key.type === "left" || key.type === "right") {
      const length = current.files.length;
      current.index =
        key.type === "left"
          ? (current.index - 1 + length) % length
          : (current.index + 1) % length;
      current.scroll = 0;
      render();
      return;
    }
    if (key.type === "up" || key.type === "down") {
      const file = current.files[current.index];
      const length = file === undefined ? 0 : reviewDiff(file).length;
      const max = Math.max(0, length - 1);
      current.scroll =
        key.type === "up"
          ? Math.max(0, current.scroll - 1)
          : Math.min(max, current.scroll + 1);
      render();
      return;
    }
    if (key.type === "char" && key.text.toLowerCase().includes("i")) {
      current.phase = "input";
      current.input = { text: "", cursor: 0 };
      render();
    }
  }

  function handlePickerKey(key: Key): void {
    if (picker === undefined) {
      return;
    }
    if (key.type === "escape" || (key.type === "ctrl" && key.key === "d")) {
      picker = undefined;
      render();
      return;
    }

    if (picker.kind === "session") {
      const length = picker.sessions.length;
      if (length === 0) {
        picker = undefined;
        render();
        return;
      }
      if (key.type === "up") {
        picker.index = (picker.index - 1 + length) % length;
        render();
        return;
      }
      if (key.type === "down") {
        picker.index = (picker.index + 1) % length;
        render();
        return;
      }
      if (key.type === "enter") {
        const chosen = picker.sessions[picker.index];
        picker = undefined;
        if (chosen === undefined) {
          render();
          return;
        }
        if (!applyLoadedSession(chosen)) {
          emit([messages.app.sessionLoadError]);
          return;
        }
        emit([messages.app.sessionContinue(chosen.turns)]);
      }
      return;
    }

    if (picker.kind === "skills") {
      const length = picker.items.length;
      if (length === 0) {
        if (key.type === "enter") {
          picker = undefined;
          saveSkillSettings([]);
        }
        return;
      }
      if (key.type === "up") {
        picker.index = (picker.index - 1 + length) % length;
        render();
        return;
      }
      if (key.type === "down") {
        picker.index = (picker.index + 1) % length;
        render();
        return;
      }
      if (key.type === "char" && key.text.includes(" ")) {
        const item = picker.items[picker.index];
        if (item !== undefined && !item.locked) {
          item.enabled = !item.enabled;
        }
        render();
        return;
      }
      if (key.type === "enter") {
        const disabled = picker.items
          .filter((item) => !item.locked && !item.enabled)
          .map((item) => item.skill.name);
        picker = undefined;
        saveSkillSettings(disabled);
      }
      return;
    }

    if (picker.kind === "mode" || picker.kind === "permission") {
      const length = picker.kind === "mode" ? MODES.length : PERMISSIONS.length;
      if (key.type === "up") {
        picker.index = (picker.index - 1 + length) % length;
        render();
        return;
      }
      if (key.type === "down") {
        picker.index = (picker.index + 1) % length;
        render();
        return;
      }
      if (key.type === "enter") {
        if (picker.kind === "mode") {
          const chosen = MODES[picker.index] ?? "run";
          picker = undefined;
          setMode(chosen);
        } else {
          const chosen = PERMISSIONS[picker.index] ?? "ask";
          picker = undefined;
          applyPermission(chosen);
        }
      }
      return;
    }

    const info = MODELS[picker.modelIndex] ?? MODELS[0];
    if (info === undefined) {
      return;
    }
    if (key.type === "up") {
      picker.modelIndex =
        (picker.modelIndex - 1 + MODELS.length) % MODELS.length;
      picker.effortIndex = Math.min(
        picker.effortIndex,
        (MODELS[picker.modelIndex]?.efforts.length ?? 1) - 1,
      );
      render();
      return;
    }
    if (key.type === "down") {
      picker.modelIndex = (picker.modelIndex + 1) % MODELS.length;
      picker.effortIndex = Math.min(
        picker.effortIndex,
        (MODELS[picker.modelIndex]?.efforts.length ?? 1) - 1,
      );
      render();
      return;
    }
    if (key.type === "left") {
      picker.effortIndex =
        (picker.effortIndex - 1 + info.efforts.length) % info.efforts.length;
      render();
      return;
    }
    if (key.type === "right") {
      picker.effortIndex = (picker.effortIndex + 1) % info.efforts.length;
      render();
      return;
    }
    if (key.type === "enter") {
      const chosen = MODELS[picker.modelIndex] ?? MODELS[0];
      if (chosen === undefined) {
        return;
      }
      const nextEffort =
        chosen.efforts[picker.effortIndex] ?? chosen.defaultEffort;
      const changed = chosen.id !== model;
      model = chosen.id;
      effort = nextEffort;
      picker = undefined;
      if (changed) {
        emit([messages.app.modelChanged]);
      } else {
        render();
      }
    }
  }

  function applyPermission(next: Permission): void {
    if (next === "auto-all") {
      warning = {
        text: messages.app.autoAllWarning,
        onYes: () => {
          permission = "auto-all";
        },
      };
      render();
      return;
    }
    permission = next;
    render();
  }

  function compactConversation(): void {
    busy = true;
    thinking = true;
    render();
    void (async () => {
      try {
        const before = estimateMessages(conversation, estimate);
        const prep = await manager.compactNow(
          conversation,
          toolSpecs(),
          undefined,
        );
        const after = estimateMessages(conversation, estimate);
        if (prep.usage !== undefined) {
          sessionUsage = addUsage(sessionUsage, prep.usage);
          writeSession({ type: "usage", usage: prep.usage });
        }
        recordReset();
        savedByContext += prep.actions.reduce(
          (total, action) => total + action.savedTokens,
          0,
        );
        if (prep.actions.some((action) => action.action === "summary")) {
          emit([
            messages.app.compact.done(
              formatTokens(before),
              formatTokens(after),
            ),
          ]);
        } else {
          emit([messages.app.compact.notNeeded]);
        }
      } catch (error) {
        if (!closed) {
          emit([
            theme.error(` ✕ ${errorMessage(error).split(/\r?\n/)[0] ?? ""}`),
          ]);
        }
      } finally {
        if (!closed) {
          busy = false;
          thinking = false;
          render();
        }
      }
    })();
  }

  function showContext(): void {
    const specs = toolSpecs();
    const toolTokens = estimate(JSON.stringify(specs));
    let instructions = 0;
    let conversationTokens = 0;
    let results = 0;
    for (const message of conversation) {
      let tokens = 4 + estimate(message.content);
      if (message.role === "assistant") {
        tokens += estimate(message.reasoning ?? "");
        for (const call of message.toolCalls ?? []) {
          tokens += estimate(call.name) + estimate(call.arguments);
        }
      }
      if (message.role === "system") {
        instructions += tokens;
      } else if (message.role === "tool") {
        results += tokens;
      } else {
        conversationTokens += tokens;
      }
    }
    const total = instructions + toolTokens + conversationTokens + results;
    const ratio = o.contextWindow > 0 ? total / o.contextWindow : 0;

    const used = totalUsage();
    const info = findModel(model);
    const inputPrice = info?.prices.input ?? o.prices?.input ?? 0;
    const cachedPrice = info?.prices.cachedInput ?? o.prices?.cachedInput ?? 0;
    const outputPrice = info?.prices.output ?? 0;
    const cached = used.cachedInput;
    const uncached = Math.max(0, used.input - used.cachedInput);
    const output = used.output;
    const cachedCost = (cached * cachedPrice) / 1_000_000;
    const uncachedCost = (uncached * inputPrice) / 1_000_000;
    const outputCost = (output * outputPrice) / 1_000_000;

    contextView = [
      messages.app.contextView.instructions(formatTokens(instructions)),
      messages.app.contextView.tools(formatTokens(toolTokens)),
      messages.app.contextView.conversation(formatTokens(conversationTokens)),
      messages.app.contextView.results(formatTokens(results)),
      messages.app.contextView.total(
        formatTokens(total),
        Math.round(ratio * 100),
      ),
      messages.app.contextView.saved(formatTokens(savedByContext)),
      messages.app.contextView.pricing,
      messages.app.contextView.cachedInput(
        formatTokens(cached),
        formatCost(cachedCost, messages),
      ),
      messages.app.contextView.uncachedInput(
        formatTokens(uncached),
        formatCost(uncachedCost, messages),
      ),
      messages.app.contextView.output(
        formatTokens(output),
        formatCost(outputCost, messages),
      ),
    ];
    render();
  }

  function skillInvocation(text: string): string | undefined {
    if (!text.startsWith("/")) {
      return undefined;
    }
    const body = text.slice(1).trim();
    const [name = "", ...rest] = body.split(/\s+/);
    if (
      name === "" ||
      commandList.some((command) => command.name === `/${name}`)
    ) {
      return undefined;
    }
    const skill = skillState.skills.find(
      (candidate) => candidate.name === name,
    );
    if (skill === undefined) {
      return undefined;
    }
    const request = rest.join(" ").trim();
    return `Follow the skill "${skill.name}" below.\n\n${readSkillFile(skill)}\n\nUser request: ${request === "" ? "(none)" : request}`;
  }

  function openSkillsPicker(): void {
    const locked = new Set(
      readDisabledSkills(join(o.cwd, ".ja-harness", "config.json")),
    );
    const disabled = new Set(skillState.disabled.map((skill) => skill.name));
    const items = [...skillState.skills, ...skillState.disabled]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((skill) => ({
        skill,
        enabled: !disabled.has(skill.name),
        locked: locked.has(skill.name),
      }));
    picker = { kind: "skills", items, index: 0 };
    render();
  }

  function saveSkillSettings(disabled: string[]): void {
    const path = join(home, ".ja-harness", "config.json");
    let text: string | undefined;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        emit([theme.error(` ✕ ${messages.settings.unreadable(path)}`)]);
        return;
      }
    }
    try {
      const next = updateDisabledSkills(text, disabled);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, next, "utf8");
      emit([messages.app.picker.skillsSaved]);
    } catch (error) {
      emit([theme.warn(` ${errorMessage(error)}`)]);
    }
  }

  function personalSkillNames(): Set<string> {
    const names = new Set<string>();
    const dir = join(home, ".ja-harness", "skills");
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return names;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      names.add(entry.name);
      try {
        const parsed = parseSkill(
          readFileSync(join(dir, entry.name, "SKILL.md"), "utf8"),
        );
        if (parsed !== undefined) {
          names.add(parsed.name);
        }
      } catch {}
    }
    return names;
  }

  function gitClone(args: string[]): Promise<string | undefined> {
    return new Promise((settle) => {
      let done = false;
      let stderr = "";
      const finish = (message?: string): void => {
        if (done) {
          return;
        }
        done = true;
        settle(message);
      };
      const child = spawn("git", args, {
        stdio: ["ignore", "ignore", "pipe"],
      });
      child.stderr?.on("data", (chunk: string | Buffer) => {
        stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      });
      child.on("error", (error: NodeJS.ErrnoException) => {
        finish(
          error.code === "ENOENT"
            ? messages.app.skillsInstall.noGit
            : messages.app.skillsInstall.cloneFailed(error.message),
        );
      });
      child.on("close", (code) => {
        if (code === 0) {
          finish(undefined);
          return;
        }
        const line =
          stderr
            .replace(/\r\n/g, "\n")
            .split("\n")
            .map((part) => part.trim())
            .find((part) => part !== "") ?? `exit ${code}`;
        finish(messages.app.skillsInstall.cloneFailed(line));
      });
    });
  }

  async function installSkills(source: string): Promise<void> {
    if (source.trim() === "") {
      emit([messages.app.skillsInstall.noSource]);
      return;
    }
    const parsed = parseSkillSource(source);
    let temp: string | undefined;
    busy = true;
    render();
    try {
      let root: string;
      if (parsed.kind === "github") {
        temp = mkdtempSync(join(tmpdir(), "ja-harness-skill-"));
        const args = ["clone", "--depth", "1"];
        if (parsed.branch !== undefined) {
          args.push("--branch", parsed.branch);
        }
        args.push(`${parsed.repoUrl}.git`, temp);
        const failure = await gitClone(args);
        if (failure !== undefined) {
          emit([theme.warn(` ${failure}`)]);
          return;
        }
        root = parsed.path === undefined ? temp : join(temp, parsed.path);
      } else {
        root = resolve(o.cwd, parsed.path);
      }

      const byName = new Map<
        string,
        { name: string; description: string; dir: string }
      >();
      for (const dir of findSkillFolders(root)) {
        let text: string;
        try {
          text = readFileSync(join(dir, "SKILL.md"), "utf8");
        } catch {
          continue;
        }
        const skill = parseSkill(text);
        if (skill === undefined) {
          continue;
        }
        byName.set(skill.name, {
          name: skill.name,
          description: skill.description,
          dir,
        });
      }
      const found = [...byName.values()];
      if (found.length === 0) {
        emit([messages.app.skillsInstall.notFound]);
        return;
      }

      const existing = personalSkillNames();
      const rows = found.map((skill) =>
        messages.app.skillsInstall.row(
          skill.name,
          skill.description,
          existing.has(skill.name),
        ),
      );
      await new Promise<void>((settle) => {
        warning = {
          text: "",
          lines: rows,
          title: messages.app.skillsInstall.title,
          footer: messages.app.skillsInstall.footer,
          onYes: () => {
            try {
              const personalDir = join(home, ".ja-harness", "skills");
              mkdirSync(personalDir, { recursive: true });
              for (const skill of found) {
                const dest = join(personalDir, skill.name);
                rmSync(dest, { recursive: true, force: true });
                cpSync(skill.dir, dest, {
                  recursive: true,
                  filter: (from) => basename(from) !== ".git",
                });
              }
              emit([
                messages.app.skillsInstall.installed(
                  found.map((skill) => skill.name).join(", "),
                ),
              ]);
            } catch (error) {
              emit([
                theme.error(
                  ` ✕ ${messages.app.skillsInstall.copyFailed(
                    errorMessage(error).split(/\r?\n/)[0] ?? "",
                  )}`,
                ),
              ]);
            }
            settle();
          },
          onNo: () => {
            settle();
          },
        };
        render();
      });
    } finally {
      if (temp !== undefined) {
        rmSync(temp, { recursive: true, force: true });
      }
      busy = false;
      render();
    }
  }

  function handleCommand(text: string): boolean {
    if (!text.startsWith("/")) {
      return false;
    }
    const body = text.slice(1).trim();
    const [name = "", ...rest] = body.split(/\s+/);
    const command = `/${name}`;
    const arg = rest.join(" ").trim();

    if (busy && command !== "/details" && command !== "/help") {
      emit([messages.app.busy]);
      return true;
    }

    switch (command) {
      case "/help":
        emit(messages.helpLines(settings.ui?.enter));
        return true;
      case "/details":
        toggleDetails();
        return true;
      case "/undo": {
        const parsed = arg === "" ? 1 : Number.parseInt(arg, 10);
        const count =
          Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
        const undo = checkpoints.undo(count);
        const paths = [...new Set([...undo.restored, ...undo.deleted])];
        if (paths.length === 0) {
          emit([messages.app.undo.none]);
          return true;
        }
        const shown = paths.map((path) => relative(o.cwd, path) || path);
        emit([
          messages.app.undo.restored(shown.join(", "), shown.length),
          messages.app.undo.shellNote,
        ]);
        pendingNotice = `The user undid your changes to: ${shown.join(", ")}. Read them again before editing.`;
        return true;
      }
      case "/mode": {
        const chosen = arg === "" ? undefined : parseMode(arg, messages);
        if (chosen !== undefined) {
          setMode(chosen);
        } else {
          picker = {
            kind: "mode",
            index: Math.max(0, MODES.indexOf(mode)),
          };
          render();
        }
        return true;
      }
      case "/permission": {
        const chosen = arg === "" ? undefined : parsePermission(arg, messages);
        if (chosen !== undefined) {
          applyPermission(chosen);
        } else {
          picker = {
            kind: "permission",
            index: Math.max(0, PERMISSIONS.indexOf(permission)),
          };
          render();
        }
        return true;
      }
      case "/model": {
        const index = Math.max(
          0,
          MODELS.findIndex((item) => item.id === model),
        );
        const info = MODELS[index] ?? MODELS[0];
        picker = {
          kind: "model",
          modelIndex: index,
          effortIndex: Math.max(0, info?.efforts.indexOf(effort) ?? 0),
        };
        render();
        return true;
      }
      case "/resume": {
        const sessions = listSessions(sessionsDir, o.cwd).filter(
          (session) => session.id !== sessionId,
        );
        if (sessions.length === 0) {
          emit([messages.app.noPreviousSession]);
          return true;
        }
        picker = { kind: "session", sessions, index: 0 };
        render();
        return true;
      }
      case "/skills": {
        if (arg === "add" || arg.startsWith("add ")) {
          const source = arg.slice(3).trim();
          if (source === "") {
            emit([messages.app.skillsInstall.noSource]);
          } else {
            void installSkills(source);
          }
          return true;
        }
        openSkillsPicker();
        return true;
      }
      case "/clear": {
        skillState = loadSkillState();
        const nextSettings = loadSettings({
          cwd: o.cwd,
          home,
          env: o.env,
        }).settings;
        const nextWarnings: string[] = [];
        const nextServers = resolveServers(nextSettings.mcp, {
          onWarning: (warning) => nextWarnings.push(warning),
        });
        if (enabledServersKey(nextServers) !== enabledServersKey(mcpServers)) {
          void reconnectMcp(nextServers, nextWarnings);
          return true;
        }
        for (const text of nextWarnings) {
          emit([theme.warn(` ${text}`)]);
        }
        rebuildSystemContent();
        resetConversation();
        return true;
      }
      case "/compact":
      case "/summarize":
        compactConversation();
        return true;
      case "/context":
        showContext();
        return true;
      default:
        emit([messages.app.unknownCommand(command)]);
        return true;
    }
  }

  function submit(text: string): void {
    exitAskedAt = undefined;
    if (exitTimer !== undefined) {
      clearTimeout(exitTimer);
      exitTimer = undefined;
    }
    const invocation = skillInvocation(text);
    if (invocation === undefined && handleCommand(text)) {
      render();
      return;
    }
    const content = invocation ?? text;
    history.push(text);
    lastSubmitted = text;
    const noticeText = pendingNotice;
    pendingNotice = undefined;
    if (busy) {
      queue.push({ text, content, notice: noticeText });
      render();
      return;
    }
    printUser(text, false);
    void startTurn(content, noticeText);
  }

  function handleKey(key: Key): void {
    if (contextView !== undefined) {
      if (
        key.type === "enter" ||
        key.type === "escape" ||
        (key.type === "ctrl" && key.key === "d")
      ) {
        contextView = undefined;
        render();
      }
      return;
    }
    if (warning !== undefined) {
      handleWarningKey(key);
      return;
    }
    if (plan !== undefined) {
      handlePlanKey(key);
      return;
    }
    if (picker !== undefined) {
      handlePickerKey(key);
      return;
    }
    if (pending !== undefined) {
      handleConfirmKey(key);
      return;
    }
    if (review !== undefined) {
      handleReviewKey(key);
      return;
    }

    if (key.type === "escape") {
      if (busy) {
        stopShown = true;
        emit([messages.app.stopped]);
        abort?.abort();
        return;
      }
      handleEscapeIdle();
      return;
    }
    lastEscapeAt = undefined;
    if (!(key.type === "ctrl" && key.key === "d")) {
      exitAskedAt = undefined;
      if (exitTimer !== undefined) {
        clearTimeout(exitTimer);
        exitTimer = undefined;
      }
    }

    const slash = slashCandidates();
    if (slash.length > 0 && (key.type === "up" || key.type === "down")) {
      slashIndex =
        key.type === "up"
          ? (slashIndex - 1 + slash.length) % slash.length
          : (slashIndex + 1) % slash.length;
      render();
      return;
    }

    const before = editor.text;
    const result = applyKey(editor, key, {
      enter: slash.length > 0 ? "send" : (settings.ui?.enter ?? "send"),
    });
    const action = result.action;
    if (action === "submit") {
      if (slash.length > 0) {
        const item = slash[Math.min(slashIndex, slash.length - 1)];
        editor = { text: "", cursor: 0 };
        slashIndex = 0;
        if (item !== undefined) {
          if (skillInvocation(item.name) === undefined) {
            handleCommand(item.name);
          } else {
            submit(item.name);
            return;
          }
        }
        render();
        return;
      }
      const text = result.state.text;
      editor = { text: "", cursor: 0 };
      slashIndex = 0;
      submit(text);
      render();
      return;
    }
    if (action === "tab") {
      if (slash.length > 0) {
        const item = slash[Math.min(slashIndex, slash.length - 1)];
        if (item !== undefined) {
          editor = { text: item.name, cursor: [...item.name].length };
          slashIndex = 0;
        }
        render();
        return;
      }
      const candidates = atCandidates();
      const first = candidates[0];
      if (first !== undefined) {
        applyAtCompletion(first);
      }
      render();
      return;
    }
    if (action === "shift-tab") {
      setMode(nextMode(mode));
      return;
    }
    if (action === "details") {
      toggleDetails();
      return;
    }
    if (action === "review") {
      openReview();
      return;
    }
    if (action === "history-prev") {
      if (busy && editor.text === "" && queue.length > 0) {
        const queued = queue.pop();
        if (queued !== undefined) {
          editor = { text: queued.text, cursor: [...queued.text].length };
          slashIndex = 0;
          render();
          return;
        }
      }
      const text = history.prev(editor.text);
      editor = { text, cursor: [...text].length };
      slashIndex = 0;
      render();
      return;
    }
    if (action === "history-next") {
      const text = history.next();
      editor = { text, cursor: [...text].length };
      slashIndex = 0;
      render();
      return;
    }
    if (action === "exit-request") {
      handleExitRequest();
      return;
    }
    if (action === "redraw") {
      render();
      return;
    }
    editor = result.state;
    if (editor.text !== before) {
      slashIndex = 0;
    }
    render();
  }

  function onData(chunk: string | Buffer): void {
    if (closed) {
      return;
    }
    if (escapeTimer !== undefined) {
      clearTimeout(escapeTimer);
      escapeTimer = undefined;
    }
    const text = typeof chunk === "string" ? chunk : utf8Decoder.write(chunk);
    const result = decodeKeys(text, decoder);
    decoder = result.state;
    for (const key of result.keys) {
      handleKey(key);
    }
    if (decoder.pending === "\x1b") {
      escapeTimer = setTimeout(() => {
        escapeTimer = undefined;
        const flushed = flushEscape(decoder);
        decoder = flushed.state;
        for (const key of flushed.keys) {
          handleKey(key);
        }
      }, timing.escape);
    }
  }

  function onResize(): void {
    if (closed) {
      return;
    }
    screen.resize();
    render();
  }

  function toolResultLines(result: string): string[] {
    return result
      .replace(/\r\n/g, "\n")
      .split("\n")
      .slice(0, 3)
      .map((line) =>
        theme.dim(`  ${truncate(line, Math.max(1, width() - 2))}`),
      );
  }

  function handleEvent(event: LoopEvent): void {
    if (closed) {
      return;
    }
    switch (event.type) {
      case "text": {
        thinking = false;
        live += event.text;
        const parts = live.split("\n");
        live = parts.pop() ?? "";
        if (parts.length > 0) {
          emit(parts.flatMap((line) => answerLines(line)));
        } else {
          render();
        }
        return;
      }
      case "reasoning":
        thinking = true;
        reasoningBuffer += event.text;
        if (
          details &&
          !reasoningShown &&
          reasoningBuffer.split("\n").length >= 3
        ) {
          printReasoning();
        } else {
          render();
        }
        return;
      case "tool-start":
        thinking = false;
        printReasoning();
        activeTool = {
          name: event.name,
          summary: summarizeStart(event.name, event.args, messages),
        };
        render();
        return;
      case "tool-end": {
        recordMessages();
        const start = activeTool?.summary ?? "";
        const end = summarizeEnd(
          event.name,
          event.result,
          event.isError,
          messages,
        );
        let summary = start === "" ? event.name : start;
        if (event.isError) {
          summary = end === "" ? summary : end;
        } else if (end !== "") {
          summary = end.startsWith(messages.toolSummary.suffixStart)
            ? `${summary}${end}`
            : `${summary} ${end}`;
        }
        activeTool = undefined;
        thinking = true;
        const lines = [
          formatToolLine({
            name: event.name,
            summary,
            failed: event.isError,
            theme,
            width: width(),
            messages,
          }),
        ];
        if (details) {
          lines.push(...toolResultLines(event.result));
        }
        emit(lines);
        return;
      }
      case "step-end":
        lastStepInput = event.usage.input;
        turnUsage = addUsage(turnUsage, event.usage);
        recordMessages();
        thinking = true;
        maybeWarnTier(event.usage.input);
        render();
        return;
      case "input-delivered":
        recordMessages();
        render();
        return;
      case "context":
        savedByContext += event.savedTokens;
        recordReset();
        emit([
          theme.dim(
            messages.app.contextAction(
              event.action === "prune"
                ? messages.app.contextPrune
                : messages.app.contextSummary,
              formatTokens(event.savedTokens),
            ),
          ),
        ]);
        return;
    }
  }

  function drainInput(): Message[] {
    if (queue.length === 0) {
      return [];
    }
    const items = queue.splice(0, queue.length);
    const delivered: Message[] = [];
    for (const item of items) {
      if (item.notice !== undefined) {
        delivered.push(notice(item.notice));
      }
      printUser(item.text, true);
      delivered.push({ role: "user", content: item.content ?? item.text });
    }
    render();
    return delivered;
  }

  async function startTurn(text: string, noticeText?: string): Promise<void> {
    if (closed) {
      return;
    }
    checkpoints.beginTurn();
    if (noticeText !== undefined) {
      conversation.push(notice(noticeText));
    }
    conversation.push({ role: "user", content: text });
    recordMessages();
    let usageWritten = false;
    busy = true;
    thinking = true;
    turnUsage = zeroUsage();
    turnSaved = false;
    stopShown = false;
    reasoningBuffer = "";
    reasoningShown = false;
    abort = new AbortController();
    render();

    const tools = makeTools().map((tool) => ({
      ...tool,
      execute: async (args: unknown, signal?: AbortSignal) => {
        if (!modeAllowsTool(mode, tool.name)) {
          return blockedToolMessage(mode);
        }
        return tool.execute(args, signal);
      },
    }));
    const activeAbort = abort;
    const signal = activeAbort.signal;

    try {
      const result = await runTurn({
        complete: (msgs, specs, cb) => currentComplete()(msgs, specs, cb),
        tools,
        messages: conversation,
        signal,
        context: {
          manager,
          overflowRetries: DEFAULT_CONTEXT.overflowRetries,
        },
        repeat: createRepeatTracker(),
        limitResult: (value, tool) =>
          limitToolResult(value, {
            maxTokens: tool?.maxResultTokens ?? 2000,
            estimate,
            save,
          }),
        drainInput,
        onEvent: handleEvent,
      });
      if (closed) {
        return;
      }
      printReasoning();
      flushLive();
      thinking = false;
      sessionUsage = addUsage(sessionUsage, result.usage);
      recordMessages();
      writeSession({ type: "usage", usage: result.usage });
      usageWritten = true;
      turnUsage = zeroUsage();
      turnSaved = true;
      const cacheRatio =
        result.usage.input === 0
          ? 0
          : result.usage.cachedInput / result.usage.input;
      emit([
        theme.dim(
          ` ${formatTurnSummary(
            {
              tokens: result.usage.input + result.usage.output,
              cost: result.usage.cost ?? 0,
              cacheRatio,
            },
            messages,
          )}`,
        ),
      ]);
    } catch (error) {
      repairMessages(conversation);
      if (closed) {
        return;
      }
      recordMessages();
      printReasoning();
      flushLive();
      thinking = false;
      if (signal.aborted) {
        if (!stopShown) {
          emit([messages.app.stopped]);
        }
      } else {
        emit([
          theme.error(` ✕ ${errorMessage(error).split(/\r?\n/)[0] ?? ""}`),
        ]);
      }
    } finally {
      if (!closed) {
        if (!turnSaved) {
          sessionUsage = addUsage(sessionUsage, turnUsage);
        }
        if (!usageWritten) {
          const usage = turnUsage;
          if (usage.input + usage.cachedInput + usage.output > 0) {
            writeSession({ type: "usage", usage });
          }
        }
        turnUsage = zeroUsage();
        busy = false;
        thinking = false;
        activeTool = undefined;
        abort = undefined;
        stopShown = false;
        render();
        const next = queue.shift();
        if (next !== undefined) {
          printUser(next.text, true);
          void startTurn(next.content ?? next.text, next.notice);
        }
      }
    }
  }

  process.once("exit", restoreTerminal);
  o.input.setRawMode?.(true);
  o.output.write("\x1b[?2004h\x1b[>4;1m");

  const knownSessions = listSessions(sessionsDir, o.cwd);
  if (o.resume !== undefined) {
    const found = findSessionIn(knownSessions, o.resume);
    const opened = found === undefined ? false : applyLoadedSession(found);
    if (!opened) {
      startupLines.push(messages.app.sessionNotFound(o.resume));
      newSession();
    }
  } else if (o.continueLatest) {
    const found = knownSessions[0];
    const opened = found === undefined ? false : applyLoadedSession(found);
    if (!opened) {
      newSession();
    }
  } else {
    newSession();
  }

  const previous = listSessions(sessionsDir, o.cwd).find(
    (session) => session.id !== sessionId,
  );
  screen.print([
    ...renderGreeting({
      version: o.version,
      model,
      effort,
      cwd: o.cwd,
      home: o.home,
      ...(previous === undefined
        ? {}
        : { last: { cost: previous.cost, cacheRatio: previous.cacheRatio } }),
      theme,
      width: width(),
      messages,
    }),
    ...startupLines,
  ]);
  const startupNotices = [
    ...warnings.map((text) => ({ text, warn: true })),
    ...(instructions.labels.length === 0
      ? []
      : [
          {
            text: messages.instructions(instructions.labels.join(", ")),
            warn: false,
          },
        ]),
    ...(skillState.skills.length + skillState.disabled.length === 0
      ? []
      : [
          {
            text: messages.skills(
              skillState.skills.length,
              skillState.disabled.length,
            ),
            warn: false,
          },
        ]),
    ...(instructions.truncated
      ? [{ text: messages.instructionsTruncated, warn: true }]
      : []),
  ];
  if (startupNotices.length > 0) {
    screen.print(
      startupNotices.flatMap(({ text, warn }) =>
        wrap(text, Math.max(1, width() - 3)).map((part, index) => {
          const line = `${index === 0 ? " " : "   "}${part}`;
          return warn ? theme.warn(line) : theme.dim(line);
        }),
      ),
    );
  }
  booted = true;
  render();

  booting = false;
  o.input.off?.("data", onEarlyData);
  o.input.on("data", onData);
  for (const chunk of earlyChunks.splice(0)) {
    onData(chunk);
  }
  o.output.on?.("resize", onResize);

  return finished;
}
