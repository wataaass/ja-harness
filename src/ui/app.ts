import { type Dirent, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
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
import { createContextManager, DEFAULT_CONTEXT } from "../context/manager.js";
import { createFileSaver, limitToolResult } from "../context/spill.js";
import { createEstimator } from "../context/tokens.js";
import {
  costPer1kJaChars,
  findModel,
  MODELS,
  type ModelInfo,
} from "../llm/models.js";
import type { Message, Usage } from "../llm/types.js";
import type { Confirm, ConfirmRequest, Decision } from "../tools/confirm.js";
import { createTools, type PlanHandler } from "../tools/index.js";
import { renderCard } from "./card.js";
import { applyKey, type EditorState, renderEditor } from "./editor.js";
import { formatTurnSummary } from "./format.js";
import { renderGreeting } from "./greeting.js";
import { createHistory } from "./history.js";
import {
  type DecoderState,
  decodeKeys,
  emptyDecoderState,
  flushEscape,
  type Key,
} from "./keys.js";
import {
  blockedToolMessage,
  MODE_LABELS,
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
  PERMISSION_LABELS,
  PERMISSIONS,
  type Permission,
  parsePermission,
  permissionLabel,
} from "./permissions.js";
import { createScreen } from "./screen.js";
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
  contextWindow: number;
  model: string;
  effort?: string;
  version: string;
  prices?: { input: number; cachedInput: number; cacheWrite?: number };
  timing?: {
    escape?: number;
    doubleEscape?: number;
    exit?: number;
  };
};

type PendingConfirm = {
  request: ConfirmRequest;
  resolve: (decision: Decision) => void;
  phase: "card" | "reason";
  reason: EditorState;
};

type PendingPlan = {
  path: string;
  markdown: string;
  resolve: (result: string) => void;
  phase: "card" | "reason";
  reason: EditorState;
};

type Picker =
  | { kind: "mode"; index: number }
  | { kind: "permission"; index: number }
  | { kind: "model"; modelIndex: number; effortIndex: number };

type Warning = { text: string; onYes: () => void };

type QueuedInput = { text: string; notice?: string };

type Command = { name: string; description: string };

const DEFAULT_TIMING = {
  escape: 30,
  doubleEscape: 500,
  exit: 2000,
};

const COMMANDS: Command[] = [
  { name: "/help", description: "キーとコマンドの一覧" },
  { name: "/mode", description: "モードを選ぶ" },
  { name: "/permission", description: "権限を選ぶ" },
  { name: "/model", description: "モデルと推論の量を選ぶ" },
  { name: "/details", description: "途中経過の見せ方を切り替える" },
  { name: "/undo", description: "変更を戻す" },
  { name: "/resume", description: "前のセッションを続ける" },
  { name: "/clear", description: "会話を空にする" },
  { name: "/compact", description: "会話を要約して短くする" },
  { name: "/summarize", description: "/compact と同じ" },
  { name: "/context", description: "文脈の内訳を見る" },
];

const HELP_LINES = [
  " キー",
  "  Enter 送る  Shift+Enter か Ctrl+J 改行  ↑↓ 前の入力",
  "  Shift+Tab モード  Ctrl+O 途中経過  Ctrl+C 入力を消す  Ctrl+D 2回で終了",
  "  Esc 止める・閉じる  Tab 候補を入れる",
  " コマンド",
  "  /help /mode /permission /model /details /undo /resume /clear /compact /summarize /context",
];

const UNIMPLEMENTED = new Set([
  "/undo",
  "/resume",
  "/clear",
  "/compact",
  "/summarize",
  "/context",
]);

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
  return `${request.tool}\u0000${request.detail}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function priceText(value: number): string {
  return `$${value}`;
}

function modelRow(info: ModelInfo): string {
  const cost = costPer1kJaChars(info);
  return `${info.label}  入力 ${priceText(info.prices.input)}・キャッシュ ${priceText(info.prices.cachedInput)}・出力 ${priceText(info.prices.output)} /100万  日本語1,000字 約$${cost.toFixed(4)}`;
}

export async function runApp(o: AppOptions): Promise<number> {
  const timing = { ...DEFAULT_TIMING, ...o.timing };
  const screen = createScreen(o.output);
  const theme = createTheme({
    env: o.env,
    isTTY: o.output.isTTY ?? o.input.isTTY ?? false,
  });
  const history = createHistory();
  const estimate = createEstimator();
  const saver = createFileSaver(join(o.cwd, ".ja-harness", "out"));
  const save = (text: string) => relative(o.cwd, saver(text));

  let mode: Mode = "run";
  let permission: Permission = "ask";
  let model = o.model;
  let effort =
    o.effort ??
    o.env.JA_HARNESS_EFFORT ??
    findModel(o.model)?.defaultEffort ??
    "high";

  const currentComplete = (): Complete => o.makeComplete(model, effort);

  const manager = createContextManager({
    config: {
      ...DEFAULT_CONTEXT,
      contextWindow: o.contextWindow,
      ...(o.prices === undefined ? {} : { prices: o.prices }),
    },
    complete: (messages, tools, cb) => currentComplete()(messages, tools, cb),
    estimate,
  });

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];
  const queue: QueuedInput[] = [];
  const alwaysAllowed = new Set<string>();

  let editor: EditorState = { text: "", cursor: 0 };
  let pending: PendingConfirm | undefined;
  let plan: PendingPlan | undefined;
  let picker: Picker | undefined;
  let warning: Warning | undefined;
  let pendingNotice: string | undefined;
  let activeTool: { name: string; summary: string } | undefined;
  let decoder: DecoderState = emptyDecoderState();
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
  let details = false;
  let reasoningBuffer = "";
  let reasoningShown = false;
  let slashIndex = 0;
  let workspaceFilesCache: string[] | undefined;

  let sessionUsage = zeroUsage();
  let turnUsage = zeroUsage();
  let lastStepInput = 0;

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

  function statusLine(maxWidth: number): string {
    if (exitAskedAt !== undefined) {
      return truncate(theme.dim(" もう一度 Ctrl+D で終了"), maxWidth);
    }
    const total = totalUsage();
    const contextRatio =
      o.contextWindow > 0 ? lastStepInput / o.contextWindow : 0;
    return renderStatus({
      mode: modeLabel(mode),
      permission: permissionLabel(permission),
      model,
      effort,
      contextRatio,
      cost: total.cost ?? 0,
      cacheRatio: total.input === 0 ? 0 : total.cachedInput / total.input,
      queued: queue.length,
      warn: contextRatio >= 0.85,
      theme,
      width: maxWidth,
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
        const text = ` ${index === current.index ? "●" : " "} ${MODE_LABELS[item]}`;
        return index === current.index ? theme.accent(text) : text;
      });
      return renderCard({
        title: "モード",
        body,
        footer: "Enter 決める  Esc やめる",
        width: maxWidth,
        theme,
      });
    }
    if (current.kind === "permission") {
      const body = PERMISSIONS.map((item, index) => {
        const text = ` ${index === current.index ? "●" : " "} ${PERMISSION_LABELS[item]}`;
        return index === current.index ? theme.accent(text) : text;
      });
      return renderCard({
        title: "権限",
        body,
        footer: "Enter 決める  Esc やめる",
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
    const body: string[] = [` 推論の量  ${efforts.join("  ")}`];
    for (let index = 0; index < MODELS.length; index += 1) {
      const item = MODELS[index];
      if (item === undefined) {
        continue;
      }
      const active = index === current.modelIndex;
      const marker = model === item.id ? "●" : " ";
      const text = `${marker} ${modelRow(item)}`;
      body.push(active ? theme.accent(text) : text);
    }
    return renderCard({
      title: "モデル",
      body,
      footer: "↑↓ モデル  ←→ 推論の量  Enter 決める  Esc やめる",
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
        title: "直す理由",
        body: bodyLines(rendered.lines),
        footer: "Enter 決定  Esc 戻る",
        width: maxWidth,
        theme,
      });
    }
    const lines = plan.markdown.split(/\r?\n/);
    const body = lines.slice(0, 30);
    if (lines.length > 30) {
      body.push(`…ほか${lines.length - 30}行`);
    }
    return renderCard({
      title: `計画  ${plan.path}`,
      body,
      footer: "Enter 承認して実行  e 直す  Esc 却下",
      width: maxWidth,
      theme,
    });
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
            title: "却下の理由",
            body: bodyLines(rendered.lines),
            footer: "Enter 決定  Esc 戻る",
            width: maxWidth,
            theme,
          }),
        );
        cursor = {
          row: top + 1 + rendered.cursorRow,
          col: 4 + rendered.cursorCol,
        };
      } else {
        const detail = pending.request.detail.split(/\r?\n/);
        const body = detail.slice(0, 20);
        if (detail.length > 20) {
          body.push(`…ほか${detail.length - 20}行`);
        }
        lines.push(
          ...renderCard({
            title: pending.request.title,
            body,
            footer: "Enter 許可  Esc 却下  a 常に許可  e 理由を書く",
            width: maxWidth,
            theme,
          }),
        );
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
    } else if (warning !== undefined) {
      lines.push(
        ...renderCard({
          title: "権限",
          body: modalBody([warning.text]),
          footer: "Enter はい  Esc やめる",
          width: maxWidth,
          theme,
        }),
      );
    } else if (picker !== undefined) {
      lines.push(...renderPicker(maxWidth));
    } else {
      if (thinking) {
        lines.push(theme.dim(" 考えています…"));
      }
      if (live !== "") {
        lines.push(truncate(`  ${live}`, maxWidth));
      }
      if (activeTool !== undefined) {
        lines.push(
          truncate(
            ` ${toolMark(activeTool.name)}  ${activeTool.summary} …`,
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
          const text = ` ${item.name}  ${item.description}`;
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
    const lines = [` › ${parts[0] ?? ""}`];
    for (let i = 1; i < parts.length; i += 1) {
      lines.push(`   ${parts[i]}`);
    }
    if (duringWork) {
      lines[lines.length - 1] += "（作業中に送信）";
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
    emit([` 途中経過: ${details ? "詳しく" : "簡潔"}`]);
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
    return COMMANDS.filter((command) =>
      command.name.startsWith(editor.text),
    ).slice(0, 8);
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
      pending = {
        request,
        resolve,
        phase: "card",
        reason: { text: "", cursor: 0 },
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
    o.input.off?.("data", onData);
    o.output.off?.("resize", onResize);
    o.input.setRawMode?.(false);
    o.output.write("\x1b[?2004l");
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
    if (key.type === "ctrl" && key.key === "d") {
      resolvePending({ allow: false });
      return;
    }
    if (pending.phase === "reason") {
      if (key.type === "escape") {
        pending.phase = "card";
        render();
        return;
      }
      if (key.type === "enter") {
        const reason = pending.reason.text.trim();
        resolvePending({
          allow: false,
          ...(reason === "" ? {} : { reason }),
        });
        return;
      }
      const result = applyKey(pending.reason, key);
      pending.reason = result.state;
      render();
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
      warning = undefined;
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
        emit([
          " モデルを変えました。キャッシュが効かなくなるので、次の1回は料金が高くなります",
        ]);
      } else {
        render();
      }
    }
  }

  function applyPermission(next: Permission): void {
    if (next === "auto-all") {
      warning = {
        text: "シェルのコマンドも確認せずに実行します。よろしいですか？",
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

  function handleCommand(text: string): boolean {
    if (!text.startsWith("/")) {
      return false;
    }
    const body = text.slice(1).trim();
    const [name = "", ...rest] = body.split(/\s+/);
    const command = `/${name}`;
    const arg = rest.join(" ").trim();

    if (busy && command !== "/details" && command !== "/help") {
      emit([" 作業が終わってから使えます"]);
      return true;
    }

    if (UNIMPLEMENTED.has(command)) {
      emit([" まだ使えません"]);
      return true;
    }

    switch (command) {
      case "/help":
        emit(HELP_LINES);
        return true;
      case "/details":
        toggleDetails();
        return true;
      case "/mode": {
        const chosen = arg === "" ? undefined : parseMode(arg);
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
        const chosen = arg === "" ? undefined : parsePermission(arg);
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
      default:
        emit([` 知らないコマンドです: ${command}`]);
        return true;
    }
  }

  function submit(text: string): void {
    exitAskedAt = undefined;
    if (exitTimer !== undefined) {
      clearTimeout(exitTimer);
      exitTimer = undefined;
    }
    if (handleCommand(text)) {
      render();
      return;
    }
    history.push(text);
    lastSubmitted = text;
    const noticeText = pendingNotice;
    pendingNotice = undefined;
    if (busy) {
      queue.push({ text, notice: noticeText });
      render();
      return;
    }
    printUser(text, false);
    void startTurn(text, noticeText);
  }

  function handleKey(key: Key): void {
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

    if (key.type === "escape") {
      if (busy) {
        stopShown = true;
        emit([" 止めました"]);
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
    const result = applyKey(editor, key);
    const action = result.action;
    if (action === "submit") {
      if (slash.length > 0) {
        const item = slash[Math.min(slashIndex, slash.length - 1)];
        editor = { text: "", cursor: 0 };
        slashIndex = 0;
        if (item !== undefined) {
          handleCommand(item.name);
        }
        render();
        return;
      }
      const text = editor.text;
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
    if (action === "history-prev") {
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
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
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
          summary: summarizeStart(event.name, event.args),
        };
        render();
        return;
      case "tool-end": {
        const start = activeTool?.summary ?? "";
        const end = summarizeEnd(event.name, event.result, event.isError);
        let summary = start === "" ? event.name : start;
        if (event.isError) {
          summary = end === "" ? summary : end;
        } else if (end !== "") {
          summary = end.startsWith("（")
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
        thinking = true;
        render();
        return;
      case "input-delivered":
        render();
        return;
      case "context":
        emit([
          theme.dim(
            ` （文脈: ${event.action === "prune" ? "切り詰め" : "要約"} ${event.savedTokens} トークン減）`,
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
      delivered.push({ role: "user", content: item.text });
    }
    render();
    return delivered;
  }

  async function startTurn(text: string, noticeText?: string): Promise<void> {
    if (closed) {
      return;
    }
    if (noticeText !== undefined) {
      messages.push(notice(noticeText));
    }
    messages.push({ role: "user", content: text });
    busy = true;
    thinking = true;
    turnUsage = zeroUsage();
    turnSaved = false;
    stopShown = false;
    reasoningBuffer = "";
    reasoningShown = false;
    abort = new AbortController();
    render();

    const created = (
      o.createTools ?? ((fn, planFn) => createTools(o.cwd, fn, planFn))
    )(confirmWithPermission, planHandler);
    const tools = created.map((tool) => ({
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
        messages,
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
      turnUsage = zeroUsage();
      turnSaved = true;
      const cacheRatio =
        result.usage.input === 0
          ? 0
          : result.usage.cachedInput / result.usage.input;
      emit([
        theme.dim(
          ` ${formatTurnSummary({
            tokens: result.usage.input + result.usage.output,
            cost: result.usage.cost ?? 0,
            cacheRatio,
          })}`,
        ),
      ]);
    } catch (error) {
      repairMessages(messages);
      if (closed) {
        return;
      }
      printReasoning();
      flushLive();
      thinking = false;
      if (signal.aborted) {
        if (!stopShown) {
          emit([" 止めました"]);
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
          turnUsage = zeroUsage();
        }
        busy = false;
        thinking = false;
        activeTool = undefined;
        abort = undefined;
        stopShown = false;
        render();
        const next = queue.shift();
        if (next !== undefined) {
          printUser(next.text, true);
          void startTurn(next.text, next.notice);
        }
      }
    }
  }

  o.input.setRawMode?.(true);
  o.output.write("\x1b[?2004h");
  screen.print(
    renderGreeting({
      version: o.version,
      model,
      effort,
      cwd: o.cwd,
      home: o.home,
      theme,
      width: width(),
    }),
  );
  render();

  o.input.on("data", onData);
  o.output.on?.("resize", onResize);

  return finished;
}
