import { join, relative } from "node:path";
import {
  type Complete,
  type LoopEvent,
  runTurn,
  type Tool,
} from "../agent/loop.js";
import { SYSTEM_PROMPT } from "../agent/prompt.js";
import { createRepeatTracker } from "../agent/repeat.js";
import { createContextManager, DEFAULT_CONTEXT } from "../context/manager.js";
import { createFileSaver, limitToolResult } from "../context/spill.js";
import { createEstimator } from "../context/tokens.js";
import type { Message, Usage } from "../llm/types.js";
import type { Confirm, ConfirmRequest, Decision } from "../tools/confirm.js";
import { createTools } from "../tools/index.js";
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
  complete: Complete;
  createTools?: (confirm: Confirm) => Tool[];
  contextWindow: number;
  model: string;
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

const DEFAULT_TIMING = {
  escape: 30,
  doubleEscape: 500,
  exit: 2000,
};

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
  const manager = createContextManager({
    config: {
      ...DEFAULT_CONTEXT,
      contextWindow: o.contextWindow,
      ...(o.prices === undefined ? {} : { prices: o.prices }),
    },
    complete: o.complete,
    estimate,
  });

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];
  const queue: string[] = [];
  const alwaysAllowed = new Set<string>();

  let editor: EditorState = { text: "", cursor: 0 };
  let pending: PendingConfirm | undefined;
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
      mode: "実行",
      permission: "確認する",
      model: o.model,
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

  function submit(text: string): void {
    exitAskedAt = undefined;
    if (exitTimer !== undefined) {
      clearTimeout(exitTimer);
      exitTimer = undefined;
    }
    history.push(text);
    lastSubmitted = text;
    if (busy) {
      queue.push(text);
      render();
      return;
    }
    printUser(text, false);
    void startTurn(text);
  }

  function handleKey(key: Key): void {
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

    const result = applyKey(editor, key);
    const action = result.action;
    if (action === "submit") {
      const text = editor.text;
      editor = { text: "", cursor: 0 };
      submit(text);
      render();
      return;
    }
    if (action === "history-prev") {
      const text = history.prev(editor.text);
      editor = { text, cursor: [...text].length };
      render();
      return;
    }
    if (action === "history-next") {
      const text = history.next();
      editor = { text, cursor: [...text].length };
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
        render();
        return;
      case "tool-start":
        thinking = false;
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
        emit([
          formatToolLine({
            name: event.name,
            summary,
            failed: event.isError,
            theme,
            width: width(),
          }),
        ]);
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
    for (const text of items) {
      printUser(text, true);
      delivered.push({ role: "user", content: text });
    }
    render();
    return delivered;
  }

  async function startTurn(text: string): Promise<void> {
    if (closed) {
      return;
    }
    messages.push({ role: "user", content: text });
    busy = true;
    thinking = true;
    turnUsage = zeroUsage();
    turnSaved = false;
    stopShown = false;
    abort = new AbortController();
    render();

    const tools = (o.createTools ?? ((fn) => createTools(o.cwd, fn)))(confirm);
    const activeAbort = abort;
    const signal = activeAbort.signal;

    try {
      const result = await runTurn({
        complete: o.complete,
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
      if (closed) {
        return;
      }
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
          printUser(next, true);
          void startTurn(next);
        }
      }
    }
  }

  o.input.setRawMode?.(true);
  o.output.write("\x1b[?2004h");
  screen.print(
    renderGreeting({
      version: o.version,
      model: o.model,
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
