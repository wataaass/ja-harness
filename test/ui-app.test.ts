import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Complete, Tool } from "../src/agent/loop.js";
import type { Completion, Message, Usage } from "../src/llm/types.js";
import type { connectMcp, McpToolInfo } from "../src/mcp/hub.js";
import type { Confirm, Decision } from "../src/tools/confirm.js";
import { runApp } from "../src/ui/app.js";
import {
  createSessionWriter,
  listSessions,
  loadSession,
} from "../src/ui/sessions.js";
import { stringWidth, stripAnsi, wrap } from "../src/ui/width.js";

class FakeInput {
  isTTY = false;
  raw: boolean | undefined;
  private listeners = new Set<(chunk: string | Buffer) => void>();

  on(event: "data", listener: (chunk: string | Buffer) => void): this {
    if (event === "data") {
      this.listeners.add(listener);
    }
    return this;
  }

  off(event: "data", listener: (chunk: string | Buffer) => void): this {
    if (event === "data") {
      this.listeners.delete(listener);
    }
    return this;
  }

  setRawMode(mode: boolean): void {
    this.raw = mode;
  }

  send(text: string | Buffer): void {
    for (const listener of [...this.listeners]) {
      listener(text);
    }
  }
}

class FakeOutput {
  text = "";
  columns = 100;
  isTTY = false;
  private listeners = new Set<() => void>();

  write(s: string): void {
    this.text += s;
  }

  on(event: "resize", listener: () => void): this {
    if (event === "resize") {
      this.listeners.add(listener);
    }
    return this;
  }

  off(event: "resize", listener: () => void): this {
    if (event === "resize") {
      this.listeners.delete(listener);
    }
    return this;
  }

  resize(columns: number): void {
    this.columns = columns;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

function usage(input = 10, cachedInput = 5, output = 5): Usage {
  return { input, cachedInput, output, reasoning: 0, cost: 0.001 };
}

function answer(text: string, used: Usage = usage()): Completion {
  return {
    message: { role: "assistant", content: text },
    usage: used,
    finishReason: "stop",
  };
}

function call(
  name: string,
  args: unknown,
  id = "call-1",
  used: Usage = usage(),
): Completion {
  return {
    message: {
      role: "assistant",
      content: "",
      toolCalls: [{ id, name, arguments: JSON.stringify(args) }],
    },
    usage: used,
    finishReason: "tool_calls",
  };
}

function sequence(items: Completion[]): {
  complete: Complete;
  calls: Message[][];
} {
  const calls: Message[][] = [];
  const complete: Complete = async (messages, _tools, cb) => {
    calls.push(structuredClone(messages));
    const item = items.shift();
    if (item === undefined) {
      throw new Error("想定より多く complete が呼ばれた");
    }
    if (item.message.content !== "") {
      cb?.onText(item.message.content);
    }
    return item;
  };
  return { complete, calls };
}

function start(options: {
  complete?: Complete;
  makeComplete?: (model: string, effort?: string) => Complete;
  createTools?: (confirm: Confirm) => Tool[];
  columns?: number;
  cwd?: string;
  home?: string;
  model?: string;
  resume?: string;
  continueLatest?: boolean;
  env?: NodeJS.ProcessEnv;
  isTTY?: boolean;
  connectMcp?: typeof connectMcp;
}) {
  const input = new FakeInput();
  const output = new FakeOutput();
  if (options.columns !== undefined) {
    output.columns = options.columns;
  }
  if (options.isTTY === true) {
    input.isTTY = true;
    output.isTTY = true;
  }
  const complete = options.complete;
  const makeComplete =
    options.makeComplete ??
    (() => {
      if (complete === undefined) {
        throw new Error("complete がありません");
      }
      return complete;
    });
  const result = runApp({
    input,
    output,
    env: options.env ?? {},
    cwd: options.cwd ?? "/work",
    home: options.home ?? mkdtempSync(join(tmpdir(), "ja-harness-home-")),
    makeComplete,
    ...(options.createTools === undefined
      ? {}
      : { createTools: options.createTools }),
    contextWindow: 100000,
    model: options.model ?? "deepseek-v4.1-flash",
    version: "0.1",
    timing: { escape: 5, doubleEscape: 100, exit: 200 },
    ...(options.resume === undefined ? {} : { resume: options.resume }),
    ...(options.continueLatest === undefined
      ? {}
      : { continueLatest: options.continueLatest }),
    ...(options.connectMcp === undefined
      ? {}
      : { connectMcp: options.connectMcp }),
  });
  return { input, output, result };
}

async function waitFor(
  output: FakeOutput,
  needle: string,
  timeout = 2000,
): Promise<void> {
  const started = Date.now();
  while (!stripAnsi(output.text).includes(needle)) {
    if (Date.now() - started > timeout) {
      throw new Error(
        `待っても出ません: ${needle}\n---\n${stripAnsi(output.text)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function readTool(): Tool {
  return {
    name: "read",
    description: "read",
    parameters: {},
    execute: async () => "== src/app.ts (lines 1-20 of 120)\n1\tconst a = 1;",
  };
}

async function close(
  input: FakeInput,
  output: FakeOutput,
  result: Promise<number>,
) {
  input.send("\x04");
  await waitFor(output, "Press Ctrl+D again to exit");
  input.send("\x04");
  return result;
}

function writeSettingsConfig(dir: string, value: unknown): string {
  const path = join(dir, ".ja-harness", "config.json");
  mkdirSync(join(dir, ".ja-harness"), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function confirmTool(seen: Decision[]): (confirm: Confirm) => Tool[] {
  return (confirm) => [
    {
      name: "shell",
      description: "shell",
      parameters: {},
      execute: async () => {
        const decision = await confirm({
          tool: "shell",
          title: "コマンドを実行します",
          detail: "echo hi",
        });
        seen.push(
          typeof decision === "boolean" ? { allow: decision } : decision,
        );
        return decision ? "ok\n[exit code 0]" : "declined";
      },
    },
  ];
}

describe("runApp", () => {
  it("入力の行・道具の行・答え・やりとりのまとめを出す", async () => {
    const { complete } = sequence([
      call("read", { paths: ["src/app.ts"] }),
      answer("直しました。"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: () => [readTool()],
    });

    input.send("src/app.ts を直して\r");
    await waitFor(output, "直しました。");
    await waitFor(output, "cache");

    expect(await close(input, output, result)).toBe(0);
    const text = stripAnsi(output.text);
    expect(text).toContain("› src/app.ts を直して");
    expect(text).toContain("Read  src/app.ts (120 lines)");
    expect(text).toContain("直しました。");
    expect(text).toContain("30 tokens");
  });

  it("UTF-8の3バイトの文字が2つの塊で届いても文字化けしない", async () => {
    const { complete } = sequence([answer("ok")]);
    const { input, output, result } = start({ complete });
    const bytes = Buffer.from("日");
    input.send(bytes.subarray(0, 2));
    input.send(bytes.subarray(2));

    await waitFor(output, "› 日");
    input.send("\r");
    await waitFor(output, "ok");
    expect(await close(input, output, result)).toBe(0);

    const text = stripAnsi(output.text);
    expect(text).toContain("日");
    expect(text).not.toContain("�");
  });

  it("UTF-8の4バイトの絵文字が2つの塊で届いても文字化けしない", async () => {
    const { complete } = sequence([answer("ok")]);
    const { input, output, result } = start({ complete });
    const bytes = Buffer.from("🙂");
    input.send(bytes.subarray(0, 2));
    input.send(bytes.subarray(2));

    await waitFor(output, "› 🙂");
    input.send("\r");
    await waitFor(output, "ok");
    expect(await close(input, output, result)).toBe(0);

    const text = stripAnsi(output.text);
    expect(text).toContain("🙂");
    expect(text).not.toContain("�");
  });

  it("長い答えは端末の幅で折り返して字下げする", async () => {
    const content = `${"あ".repeat(39)}終`;
    const { complete } = sequence([answer(content)]);
    const { input, output, result } = start({ complete, columns: 30 });

    input.send("q\r");
    await waitFor(output, "終");
    expect(await close(input, output, result)).toBe(0);

    const lines = stripAnsi(output.text).split("\r\n");
    const answerLines = lines.filter((line) => /^ {2}[あ終]+$/.test(line));
    expect(answerLines).toContain(`  ${"あ".repeat(14)}`);
    expect(answerLines).toContain(`  ${"あ".repeat(11)}終`);
    for (const line of answerLines) {
      expect(stringWidth(line)).toBeLessThanOrEqual(30);
    }
  });

  it("確認のカードで Enter を押すと許可になる", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([
      call("shell", { command: "echo hi" }),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: confirmTool(seen),
    });

    input.send("run\r");
    await waitFor(output, "Enter allow");
    input.send("\r");
    await waitFor(output, "done");
    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([{ allow: true }]);
  });

  it("確認のカードで Esc を押すと却下になる", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([
      call("shell", { command: "echo hi" }),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: confirmTool(seen),
    });

    input.send("run\r");
    await waitFor(output, "Enter allow");
    input.send("\x1b");
    await waitFor(output, "done");
    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([{ allow: false }]);
  });

  it("確認のカードで a を押すと常に許可になる", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([
      call("shell", { command: "echo hi" }),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: confirmTool(seen),
    });

    input.send("run\r");
    await waitFor(output, "Enter allow");
    input.send("a");
    await waitFor(output, "done");
    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([{ allow: true, always: true }]);
  });

  it("確認のカードで e を押すと理由を書いて却下できる", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([
      call("shell", { command: "echo hi" }),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: confirmTool(seen),
    });

    input.send("run\r");
    await waitFor(output, "Enter allow");
    input.send("e");
    await waitFor(output, "Why reject");
    input.send("違います\r");
    await waitFor(output, "done");
    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([{ allow: false, reason: "違います" }]);
  });

  it("確認のカード中の Ctrl+D は却下として扱う", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([
      call("shell", { command: "echo hi" }),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: confirmTool(seen),
    });

    input.send("run\r");
    await waitFor(output, "Enter allow");
    input.send("\x04");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([{ allow: false }]);
  });

  it("作業中の submit は待ち行列に入り、次の区切りで渡る", async () => {
    let release: (() => void) | undefined;
    const first = new Promise<Completion>((resolve) => {
      release = () => resolve(call("read", { paths: ["a.ts"] }));
    });
    let count = 0;
    const calls: Message[][] = [];
    const complete: Complete = async (messages, _tools, cb) => {
      calls.push(structuredClone(messages));
      count += 1;
      if (count === 1) {
        return first;
      }
      cb?.onText("受け取りました");
      return answer("受け取りました");
    };
    const { input, output, result } = start({
      complete,
      createTools: () => [readTool()],
    });

    input.send("start\r");
    await waitFor(output, "Thinking");
    input.send("追加の指示\r");
    await waitFor(output, "Queued 1");
    release?.();
    await waitFor(output, "sent while working");
    await waitFor(output, "受け取りました");

    expect(await close(input, output, result)).toBe(0);
    const last = calls[1]?.at(-1);
    expect(last).toEqual({ role: "user", content: "追加の指示" });
  });

  it("作業中で入力欄が空なら ↑ で待ち行列の最後を呼び戻す", async () => {
    let release: (() => void) | undefined;
    const first = new Promise<Completion>((resolve) => {
      release = () => resolve(call("read", { paths: ["a.ts"] }));
    });
    let count = 0;
    const calls: Message[][] = [];
    const complete: Complete = async (messages, _tools, cb) => {
      calls.push(structuredClone(messages));
      count += 1;
      if (count === 1) {
        return first;
      }
      cb?.onText("受け取りました");
      return answer("受け取りました");
    };
    const { input, output, result } = start({
      complete,
      createTools: () => [readTool()],
    });

    input.send("start\r");
    await waitFor(output, "Thinking");
    input.send("追加1\r");
    input.send("追加2\r");
    await waitFor(output, "Queued 2");
    input.send("\x1b[A");
    await waitFor(output, "│ › 追加2");
    release?.();
    await waitFor(output, "受け取りました");

    input.send("\x03");
    expect(await close(input, output, result)).toBe(0);
    const users = (calls[1] ?? [])
      .filter((message) => message.role === "user")
      .map((message) => message.content);
    expect(users).toContain("追加1");
    expect(users).not.toContain("追加2");
  });

  it("作業中の Esc で止まる", async () => {
    const complete: Complete = (_messages, _tools, cb) =>
      new Promise((_resolve, reject) => {
        const signal = cb?.signal;
        if (signal?.aborted) {
          reject(new Error("aborted"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
      });
    const { input, output, result } = start({ complete });

    input.send("start\r");
    await waitFor(output, "Thinking");
    input.send("\x1b");
    await waitFor(output, "Stopped");

    expect(await close(input, output, result)).toBe(0);
  });

  it("終了時は下の領域を消すエスケープを出してから改行する", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("\x04");
    await waitFor(output, "Press Ctrl+D again to exit");
    input.send("\x04");

    expect(await result).toBe(0);
    expect(output.text.endsWith("\r\x1b[J\r\n")).toBe(true);
  });

  it("Ctrl+D を2回押すと終了して 0 を返す", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("\x04");
    await waitFor(output, "Press Ctrl+D again to exit");
    input.send("\x04");

    expect(await result).toBe(0);
    expect(input.raw).toBe(false);
    expect(stripAnsi(output.text)).toContain("ja-harness 0.1");
  });

  it("起動時に Shift+Enter を改行にし、終了時に元へ戻す", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    expect(output.text).toContain("\x1b[>4;1m");

    expect(await close(input, output, result)).toBe(0);
    expect(output.text).toContain("\x1b[>4;0m");
  });

  it("Shift+Enter の列で入力欄が改行される", async () => {
    const { complete, calls } = sequence([answer("了解")]);
    const { input, output, result } = start({ complete });

    input.send("a\x1b[27;2;13~b\r");
    await waitFor(output, "了解");

    expect(await close(input, output, result)).toBe(0);
    expect(calls[0]?.at(-1)).toEqual({ role: "user", content: "a\nb" });
  });

  it("設定の ui.enter が newline なら Enter 2回で送り、末尾の改行を送らない", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    try {
      writeSettingsConfig(home, { ui: { enter: "newline" } });
      const { complete, calls } = sequence([answer("了解")]);
      const { input, output, result } = start({ complete, home });

      input.send("あ\r\r");
      await waitFor(output, "了解");

      expect(await close(input, output, result)).toBe(0);
      expect(calls[0]?.at(-1)).toEqual({ role: "user", content: "あ" });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("runApp の追加機能", () => {
  it("Shift+Tab でモードが回り、次の発言の前に notice が入る", async () => {
    const { complete, calls } = sequence([answer("了解")]);
    const { input, output, result } = start({ complete });

    input.send("\x1b[Z");
    await waitFor(output, "Plan");
    input.send("hi\r");
    await waitFor(output, "了解");

    expect(await close(input, output, result)).toBe(0);
    const tail = calls[0]?.slice(-2) ?? [];
    expect(tail[0]?.role).toBe("user");
    expect(tail[0]?.content).toContain("Plan mode");
    expect(tail[1]).toEqual({ role: "user", content: "hi" });
  });

  it("計画のモードでは edit を実行せずに断る", async () => {
    let executes = 0;
    const editTool: Tool = {
      name: "edit",
      description: "edit",
      parameters: {},
      execute: async () => {
        executes += 1;
        return "ok";
      },
    };
    const { complete, calls } = sequence([call("edit", {}), answer("done")]);
    const { input, output, result } = start({
      complete,
      createTools: () => [editTool],
    });

    input.send("\x1b[Z");
    await waitFor(output, "Plan");
    input.send("go\r");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(executes).toBe(0);
    const toolMessage = calls[1]?.find((message) => message.role === "tool");
    expect(toolMessage?.content).toBe(
      "Not allowed in plan mode. Only read, list and grep are allowed.",
    );
  });

  it("submit_plan を承認すると保存して実行モードに戻る", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-plan-"));
    try {
      const markdown = "# 計画\n\n- 直す";
      const { complete, calls } = sequence([
        call("submit_plan", { markdown }),
        answer("始めます"),
      ]);
      const { input, output, result } = start({ complete, cwd });

      input.send("\x1b[Z");
      await waitFor(output, "Plan");
      input.send("plan please\r");
      await waitFor(output, "Plan  .ja-harness/plans/");

      const dir = join(cwd, ".ja-harness", "plans");
      const files = readdirSync(dir);
      expect(files).toHaveLength(1);
      expect(readFileSync(join(dir, files[0] ?? ""), "utf8")).toBe(markdown);

      input.send("\r");
      await waitFor(output, "始めます");
      expect(await close(input, output, result)).toBe(0);

      const toolMessage = calls[1]?.find((message) => message.role === "tool");
      expect(toolMessage?.content).toContain("The user approved the plan.");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("submit_plan の「直す」は理由を道具に返す", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-plan-"));
    try {
      const { complete, calls } = sequence([
        call("submit_plan", { markdown: "# 計画" }),
        answer("直します"),
      ]);
      const { input, output, result } = start({ complete, cwd });

      input.send("\x1b[Z");
      await waitFor(output, "Plan");
      input.send("plan please\r");
      await waitFor(output, "approve & run");
      input.send("e");
      await waitFor(output, "What to change");
      input.send("もっと詳しく\r");
      await waitFor(output, "直します");

      expect(await close(input, output, result)).toBe(0);
      const toolMessage = calls[1]?.find((message) => message.role === "tool");
      expect(toolMessage?.content).toBe(
        "The user asked for changes: もっと詳しく. Revise the plan and call submit_plan again.",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("submit_plan の却下は計画を止める文を返す", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-plan-"));
    try {
      const { complete, calls } = sequence([
        call("submit_plan", { markdown: "# 計画" }),
        answer("わかりました"),
      ]);
      const { input, output, result } = start({ complete, cwd });

      input.send("\x1b[Z");
      await waitFor(output, "Plan");
      input.send("plan please\r");
      await waitFor(output, "reject");
      input.send("\x1b");
      await waitFor(output, "わかりました");

      expect(await close(input, output, result)).toBe(0);
      const toolMessage = calls[1]?.find((message) => message.role === "tool");
      expect(toolMessage?.content).toContain("The user rejected the plan.");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("編集は自動では edit を聞かず、shell は聞く", async () => {
    const seen: { tool: string; allow: boolean }[] = [];
    const makeTool = (confirm: Confirm, name: string): Tool => ({
      name,
      description: name,
      parameters: {},
      execute: async () => {
        const decision = await confirm({
          tool: name,
          title: `${name} を実行`,
          detail: name,
        });
        seen.push({
          tool: name,
          allow: typeof decision === "boolean" ? decision : decision.allow,
        });
        return "ok";
      },
    });
    const { complete } = sequence([
      call("edit", {}, "call-edit"),
      call("shell", {}, "call-shell"),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: (confirm) => [
        makeTool(confirm, "edit"),
        makeTool(confirm, "shell"),
      ],
    });

    input.send("/permission Auto-edit\r");
    await waitFor(output, "Auto-edit");
    input.send("go\r");
    await waitFor(output, "Enter allow");
    input.send("\r");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([
      { tool: "edit", allow: true },
      { tool: "shell", allow: true },
    ]);
    expect(stripAnsi(output.text)).not.toContain("edit を実行");
  });

  it("作業フォルダの外の edit は自動でも必ず聞く", async () => {
    const seen: boolean[] = [];
    const { complete } = sequence([call("edit", {}, "call-1"), answer("done")]);
    const { input, output, result } = start({
      complete,
      createTools: (confirm) => [
        {
          name: "edit",
          description: "edit",
          parameters: {},
          execute: async () => {
            const decision = await confirm({
              tool: "edit",
              title: "外を編集",
              detail: "x",
              outside: true,
            });
            seen.push(
              typeof decision === "boolean" ? decision : decision.allow,
            );
            return "ok";
          },
        },
      ],
    });

    input.send("/permission Auto-edit\r");
    await waitFor(output, "Auto-edit");
    input.send("go\r");
    await waitFor(output, "Enter allow");
    input.send("\r");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([true]);
    expect(stripAnsi(output.text)).toContain("外を編集");
  });

  it("すべて自動はもう一度確かめてから効く", async () => {
    const seen: boolean[] = [];
    const shell: Tool = {
      name: "shell",
      description: "shell",
      parameters: {},
      execute: async () => "ok",
    };
    const { complete } = sequence([
      call("shell", {}, "call-1"),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: (confirm) => [
        {
          ...shell,
          execute: async () => {
            const decision = await confirm({
              tool: "shell",
              title: "コマンドを実行します",
              detail: "echo hi",
            });
            seen.push(
              typeof decision === "boolean" ? decision : decision.allow,
            );
            return "ok";
          },
        },
      ],
    });

    input.send("/permission Auto\r");
    await waitFor(output, "シェルのコマンドも確認せずに実行します");
    input.send("\r");
    await waitFor(output, "Auto");
    input.send("go\r");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([true]);
    expect(stripAnsi(output.text)).not.toContain("Enter allow");
  });

  it("/ の候補を Tab で入れて Enter で実行する", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("/mo");
    await waitFor(output, "/mode");
    await waitFor(output, "/model");
    expect(stripAnsi(output.text)).not.toContain("Choose mode");
    expect(stripAnsi(output.text)).not.toContain("Choose model and effort");
    input.send("\t");
    await waitFor(output, "› /mode");
    input.send("\r");
    await waitFor(output, "Enter select");

    input.send("\x1b");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await close(input, output, result)).toBe(0);
  });

  it("知らないコマンドを知らせる", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("/nope\r");
    await waitFor(output, "Unknown command: /nope");
    expect(await close(input, output, result)).toBe(0);
  });

  it("@ の候補を Tab で入れてそのまま送る", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-at-"));
    try {
      mkdirSync(join(cwd, "src"));
      mkdirSync(join(cwd, "node_modules"));
      writeFileSync(join(cwd, "src", "app.ts"), "const a = 1;\n");
      writeFileSync(join(cwd, "src", "other.ts"), "const b = 2;\n");
      writeFileSync(join(cwd, "node_modules", "hidden.ts"), "");
      writeFileSync(join(cwd, "README.md"), "readme\n");
      const { complete, calls } = sequence([answer("ok")]);
      const { input, output, result } = start({ complete, cwd });

      input.send("@ap");
      await waitFor(output, "@src/app.ts");
      input.send("\t");
      await waitFor(output, "› @src/app.ts ");
      input.send("\r");
      await waitFor(output, "ok");

      expect(await close(input, output, result)).toBe(0);
      expect(calls[0]?.at(-1)).toEqual({
        role: "user",
        content: "@src/app.ts ",
      });
      expect(stripAnsi(output.text)).not.toContain("node_modules");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/model で次のリクエストのモデルと effort が変わる", async () => {
    const seen: { model: string; effort?: string }[] = [];
    const items = [answer("first"), answer("second")];
    const makeComplete = (model: string, effort?: string): Complete => {
      return async (_messages, _tools, cb) => {
        seen.push({ model, effort });
        const item = items.shift();
        if (item === undefined) {
          throw new Error("想定より多く complete が呼ばれた");
        }
        if (item.message.content !== "") {
          cb?.onText(item.message.content);
        }
        return item;
      };
    };
    const { input, output, result } = start({ makeComplete });

    input.send("one\r");
    await waitFor(output, "first");
    input.send("/model\r");
    await waitFor(output, "Effort");
    input.send("\x1b[B");
    input.send("\x1b[D");
    input.send("\r");
    await waitFor(output, "モデルを変えました");
    input.send("two\r");
    await waitFor(output, "second");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([
      { model: "deepseek-v4.1-flash", effort: "high" },
      { model: "deepseek-v4-pro", effort: "medium" },
    ]);
  });

  it("料金の段の手前で1回だけ知らせる", async () => {
    const items = [
      answer("first", usage(95000, 0, 10)),
      answer("second", usage(96000, 0, 10)),
    ];
    const complete: Complete = async (_messages, _tools, cb) => {
      const item = items.shift();
      if (item === undefined) {
        throw new Error("想定より多く complete が呼ばれた");
      }
      cb?.onText(item.message.content);
      return item;
    };
    const { input, output, result } = start({
      complete,
      model: "claude-haiku-5-5",
    });

    input.send("one\r");
    await waitFor(output, "first");
    await waitFor(output, "Context が 90k を超えました");
    await waitFor(output, "100k を超えると、次から単価が5倍になります");
    input.send("two\r");
    await waitFor(output, "second");
    expect(await close(input, output, result)).toBe(0);

    const text = stripAnsi(output.text);
    expect(text.match(/Context が 90k を超えました/g)).toHaveLength(1);
  });

  it("料金の段がないモデルでは知らせない", async () => {
    const { complete } = sequence([answer("first", usage(95000, 0, 10))]);
    const { input, output, result } = start({ complete });

    input.send("one\r");
    await waitFor(output, "first");
    expect(await close(input, output, result)).toBe(0);
    expect(stripAnsi(output.text)).not.toContain("Context が 90k を超えました");
  });

  it("/details で道具の結果の先頭を出す", async () => {
    const { complete } = sequence([
      call("read", { paths: ["src/app.ts"] }),
      answer("done"),
    ]);
    const { input, output, result } = start({
      complete,
      createTools: () => [readTool()],
    });

    input.send("/details\r");
    await waitFor(output, "Details: verbose");
    input.send("go\r");
    await waitFor(output, "1\tconst a = 1;");

    expect(await close(input, output, result)).toBe(0);
  });

  it("中断のあとの次の発言は修復された messages で送られる", async () => {
    const calls: Message[][] = [];
    let count = 0;
    const makeComplete = (): Complete => {
      return async (messages, _tools, cb) => {
        calls.push(structuredClone(messages));
        count += 1;
        if (count === 1) {
          return call("slow", {});
        }
        cb?.onText("again ok");
        return answer("again ok");
      };
    };
    const slow: Tool = {
      name: "slow",
      description: "slow",
      parameters: {},
      execute: (_args, signal) =>
        new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            {
              once: true,
            },
          );
        }),
    };
    const { input, output, result } = start({
      makeComplete,
      createTools: () => [slow],
    });

    input.send("start\r");
    await waitFor(output, "Thinking");
    input.send("\x1b");
    await waitFor(output, "Stopped");
    input.send("again\r");
    await waitFor(output, "again ok");

    expect(await close(input, output, result)).toBe(0);
    const second = calls[1] ?? [];
    const toolIndex = second.findIndex((message) => message.role === "tool");
    expect(second[toolIndex]).toEqual({
      role: "tool",
      toolCallId: "call-1",
      content: "Interrupted by the user.",
    });
    expect(second[toolIndex + 1]).toEqual({
      role: "user",
      content: "again",
    });
  });
});

function hunkTool(
  seen: Decision[],
  hunks: string[][],
): (confirm: Confirm) => Tool[] {
  return (confirm) => [
    {
      name: "edit",
      description: "edit",
      parameters: {},
      execute: async () => {
        const decision = await confirm({
          tool: "edit",
          title: "Edit a.ts",
          detail: "",
          hunks,
        });
        seen.push(
          typeof decision === "boolean" ? { allow: decision } : decision,
        );
        return "ok";
      },
    },
  ];
}

const TWO_HUNKS = [
  ["@@ line 1 @@", "-a", "+A"],
  ["@@ line 5 @@", "-b", "+B"],
];

describe("runApp のまとまりごとの確認と取り消し", () => {
  it("2つのまとまりで Enter と Esc を押すと1つだけ反映する", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-hunks-"));
    try {
      writeFileSync(join(cwd, "a.txt"), "a\nb\nc\nd\ne\nf\ng\nh\ni\n");
      const { complete } = sequence([
        call("edit", {
          path: "a.txt",
          edits: [
            { oldText: "b", newText: "B" },
            { oldText: "h", newText: "H" },
          ],
        }),
        answer("done"),
      ]);
      const { input, output, result } = start({ complete, cwd });

      input.send("go\r");
      await waitFor(output, "Diff  a.txt  1/2");
      input.send("\r");
      await waitFor(output, "Diff  a.txt  2/2");
      input.send("\x1b");
      await waitFor(output, "done");

      expect(await close(input, output, result)).toBe(0);
      expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe(
        "a\nB\nc\nd\ne\nf\ng\nh\ni\n",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("差分のカードの題はパスだけで Edit を付けない", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([call("edit", {}), answer("done")]);
    const { input, output, result } = start({
      complete,
      createTools: hunkTool(seen, TWO_HUNKS),
    });

    input.send("go\r");
    await waitFor(output, "Diff  a.ts  1/2");
    const text = stripAnsi(output.text);
    expect(text).toContain("Diff  a.ts  1/2");
    expect(text).not.toContain("Diff  Edit");

    input.send("a");
    await waitFor(output, "done");
    expect(await close(input, output, result)).toBe(0);
  });

  it("a で残りを全部採用する", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([call("edit", {}), answer("done")]);
    const { input, output, result } = start({
      complete,
      createTools: hunkTool(seen, TWO_HUNKS),
    });

    input.send("go\r");
    await waitFor(output, "Diff  a.ts  1/2");
    input.send("a");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([{ allow: true, acceptedHunks: [true, true] }]);
  });

  it("e で理由を書くと残りを却下して理由が届く", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([call("edit", {}), answer("done")]);
    const { input, output, result } = start({
      complete,
      createTools: hunkTool(seen, TWO_HUNKS),
    });

    input.send("go\r");
    await waitFor(output, "Diff  a.ts  1/2");
    input.send("\r");
    await waitFor(output, "Diff  a.ts  2/2");
    input.send("e");
    await waitFor(output, "Why reject");
    input.send("まだ早い\r");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([
      {
        allow: true,
        acceptedHunks: [true, false],
        reason: "まだ早い",
      },
    ]);
  });

  it("Ctrl+R で Review、←→ でファイルを切り替え、i の指示を送る", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-review-"));
    try {
      writeFileSync(join(cwd, "a.txt"), "a\n");
      writeFileSync(join(cwd, "b.txt"), "b\n");
      const { complete, calls } = sequence([
        call("edit", {
          path: "a.txt",
          edits: [{ oldText: "a", newText: "A" }],
        }),
        call("edit", {
          path: "b.txt",
          edits: [{ oldText: "b", newText: "B" }],
        }),
        answer("done"),
        answer("了解"),
      ]);
      const { input, output, result } = start({ complete, cwd });

      input.send("/permission Auto-edit\r");
      await waitFor(output, "Auto-edit");
      input.send("go\r");
      await waitFor(output, "done");
      await waitFor(output, "cache");

      input.send("\x12");
      await waitFor(output, "Review  a.txt  1/2");
      input.send("\x1b[C");
      await waitFor(output, "Review  b.txt  2/2");
      input.send("i");
      await waitFor(output, "More instructions");
      input.send("もっと\r");
      await waitFor(output, "了解");

      expect(await close(input, output, result)).toBe(0);
      expect(calls.at(-1)?.at(-1)).toEqual({
        role: "user",
        content: "もっと",
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/undo でファイルを戻し、次の発言の前に notice を入れる", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-undo-"));
    try {
      writeFileSync(join(cwd, "a.txt"), "old\n");
      const { complete, calls } = sequence([
        call("edit", {
          path: "a.txt",
          edits: [{ oldText: "old", newText: "new" }],
        }),
        answer("done"),
        answer("again ok"),
      ]);
      const { input, output, result } = start({ complete, cwd });

      input.send("/permission Auto-edit\r");
      await waitFor(output, "Auto-edit");
      input.send("go\r");
      await waitFor(output, "done");
      await waitFor(output, "cache");

      input.send("/undo\r");
      await waitFor(output, "Restored: a.txt (1)");
      await waitFor(output, "シェルで変えたファイルは戻りません");
      expect(readFileSync(join(cwd, "a.txt"), "utf8")).toBe("old\n");

      input.send("again\r");
      await waitFor(output, "again ok");

      expect(await close(input, output, result)).toBe(0);
      const last = calls.at(-1) ?? [];
      expect(last.at(-2)?.content).toContain(
        "The user undid your changes to: a.txt.",
      );
      expect(last.at(-1)).toEqual({ role: "user", content: "again" });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function sessionDir(home: string): string {
  return join(home, ".ja-harness", "sessions");
}

function seedSession(options: {
  home: string;
  cwd: string;
  id: string;
  createdAt: string;
  messages: Message[];
  cost?: number;
}): string {
  const writer = createSessionWriter(sessionDir(options.home), {
    id: options.id,
    cwd: options.cwd,
    model: "deepseek-v4.1-flash",
    createdAt: options.createdAt,
  });
  for (const message of options.messages) {
    writer.append({ type: "message", message });
  }
  writer.append({
    type: "usage",
    usage: {
      input: 100,
      cachedInput: 50,
      output: 10,
      reasoning: 0,
      cost: options.cost ?? 0.012,
    },
  });
  return writer.path;
}

describe("runApp のセッション", () => {
  it("新しいセッションに message と usage を書く", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const { complete } = sequence([answer("ok")]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("hi\r");
      await waitFor(output, "ok");
      await waitFor(output, "cache");
      expect(await close(input, output, result)).toBe(0);

      const sessions = listSessions(sessionDir(home), cwd);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.turns).toBe(1);
      expect(sessions[0]?.cost).toBeCloseTo(0.001);
      expect(sessions[0]?.firstUser).toBe("hi");
      const loaded = loadSession(sessions[0]?.path ?? "");
      expect(loaded.messages.map((message) => message.role)).toEqual([
        "system",
        "user",
        "assistant",
      ]);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/clear で新しいファイルを始め、前の会話は残す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const { complete } = sequence([answer("ok")]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("hi\r");
      await waitFor(output, "ok");
      await waitFor(output, "cache");
      input.send("/clear\r");
      await waitFor(output, "会話を空にしました");
      await new Promise((resolve) => setTimeout(resolve, 5));

      const sessions = listSessions(sessionDir(home), cwd);
      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.turns).toBe(0);
      expect(loadSession(sessions[0]?.path ?? "").messages).toHaveLength(1);
      expect(loadSession(sessions[1]?.path ?? "").messages).toHaveLength(3);

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/resume で messages を置き換え、次のリクエストに入れる", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const path = seedSession({
        home,
        cwd,
        id: "old-session",
        createdAt: "2026-10-26T03:12:00.000Z",
        messages: [
          { role: "system", content: "prompt" },
          { role: "user", content: "前の話" },
          { role: "assistant", content: "前の答え" },
        ],
      });
      const { complete, calls } = sequence([answer("続きです")]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/resume\r");
      await waitFor(output, "Sessions");
      input.send("\r");
      await waitFor(output, "続きから始めます（1件のやりとり）");
      input.send("next\r");
      await waitFor(output, "続きです");

      expect(await close(input, output, result)).toBe(0);
      expect(calls[0]?.map((message) => message.content)).toContain("前の話");
      expect(calls[0]?.at(-1)).toEqual({ role: "user", content: "next" });
      expect(
        loadSession(path).messages.map((message) => message.content),
      ).toContain("next");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("--continue で最新のセッションを読み込む", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      seedSession({
        home,
        cwd,
        id: "latest-session",
        createdAt: "2026-10-26T03:12:00.000Z",
        messages: [
          { role: "system", content: "prompt" },
          { role: "user", content: "前の話" },
          { role: "assistant", content: "前の答え" },
        ],
      });
      const { complete, calls } = sequence([answer("続きです")]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        continueLatest: true,
      });

      input.send("next\r");
      await waitFor(output, "続きです");

      expect(await close(input, output, result)).toBe(0);
      expect(calls[0]?.map((message) => message.content)).toContain("前の話");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("あいさつに前回の料金とキャッシュの割合を出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      seedSession({
        home,
        cwd,
        id: "old-session",
        createdAt: "2026-10-26T03:12:00.000Z",
        messages: [
          { role: "system", content: "prompt" },
          { role: "user", content: "前の話" },
        ],
      });
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      await waitFor(output, "Last session $0.012 · cache 50%");
      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/compact で会話を要約し、usage を足す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const long = "あ".repeat(80);
      const { complete, calls } = sequence([
        answer(`${long}一`),
        answer(`${long}二`),
        answer("短い要約"),
      ]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("one\r");
      await waitFor(output, "一");
      await waitFor(output, "cache");
      input.send("two\r");
      await waitFor(output, "二");
      await waitFor(output, "cache");
      input.send("/compact\r");
      await waitFor(output, "Compacted");

      expect(await close(input, output, result)).toBe(0);
      expect(
        calls[2]?.some((message) => message.content.includes("checkpoint")),
      ).toBe(true);
      const sessions = listSessions(sessionDir(home), cwd);
      expect(sessions[0]?.turns).toBe(3);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/context のカードに Context と料金の内訳を出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const { complete } = sequence([answer("ok")]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("hi\r");
      await waitFor(output, "ok");
      await waitFor(output, "cache");
      input.send("/context\r");
      await waitFor(output, "Context");
      await waitFor(output, "System prompt");
      await waitFor(output, "Tools");
      await waitFor(output, "Tool results");
      await waitFor(output, "Saved by pruning/summary");
      await waitFor(output, "Cached input");
      input.send("\r");

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/model の行を短くし、単価の説明を出さない", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/model\r");
      await waitFor(output, "in $0.15  cache $0.003  out $0.6");
      expect(stripAnsi(output.text)).not.toContain("$ per 1M tokens");
      expect(stripAnsi(output.text)).not.toContain("JA 1k chars");
      input.send("\x1b");
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("長い入力も折り返して2行目から字下げする", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const { complete } = sequence([answer("ok")]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        columns: 30,
      });

      input.send(`${"あ".repeat(20)}終\r`);
      await waitFor(output, "終");
      expect(await close(input, output, result)).toBe(0);

      const lines = stripAnsi(output.text).split("\r\n");
      const first = lines.find((line) => line.includes(" › あ"));
      expect(first).toBeDefined();
      const wrapped = lines.filter((line) => line.includes("   あ"));
      expect(wrapped.length).toBeGreaterThan(0);
      for (const line of [...wrapped, first ?? ""]) {
        expect(stringWidth(line)).toBeLessThanOrEqual(30);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("runApp の設定ファイル", () => {
  it("設定の permission を起動時の既定に使う", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeSettingsConfig(home, { permission: "auto-edit" });
      const seen: { tool: string; allow: boolean }[] = [];
      const makeTool = (confirm: Confirm, name: string): Tool => ({
        name,
        description: name,
        parameters: {},
        execute: async () => {
          const decision = await confirm({
            tool: name,
            title: `${name} を実行`,
            detail: name,
          });
          seen.push({
            tool: name,
            allow: typeof decision === "boolean" ? decision : decision.allow,
          });
          return "ok";
        },
      });
      const { complete } = sequence([
        call("edit", {}, "call-edit"),
        call("shell", {}, "call-shell"),
        answer("done"),
      ]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        createTools: (confirm) => [
          makeTool(confirm, "edit"),
          makeTool(confirm, "shell"),
        ],
      });

      await waitFor(output, "Auto-edit");
      input.send("go\r");
      await waitFor(output, "Enter allow");
      input.send("\r");
      await waitFor(output, "done");

      expect(await close(input, output, result)).toBe(0);
      expect(seen).toEqual([
        { tool: "edit", allow: true },
        { tool: "shell", allow: true },
      ]);
      expect(stripAnsi(output.text)).not.toContain("edit を実行");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("設定の mode を起動時の既定に使う", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeSettingsConfig(home, { mode: "plan" });
      let executes = 0;
      const editTool: Tool = {
        name: "edit",
        description: "edit",
        parameters: {},
        execute: async () => {
          executes += 1;
          return "ok";
        },
      };
      const { complete, calls } = sequence([call("edit", {}), answer("done")]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        createTools: () => [editTool],
      });

      await waitFor(output, "Plan");
      input.send("go\r");
      await waitFor(output, "done");

      expect(await close(input, output, result)).toBe(0);
      expect(executes).toBe(0);
      const toolMessage = calls[1]?.find((message) => message.role === "tool");
      expect(toolMessage?.content).toContain("Not allowed in plan mode.");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("設定の ui.theme が light なら明るい藍を使う", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    try {
      writeSettingsConfig(home, { ui: { theme: "light" } });
      const { complete } = sequence([]);
      const { input, output, result } = start({
        complete,
        home,
        env: { COLORTERM: "truecolor" },
        isTTY: true,
      });

      await waitFor(output, "ja-harness 0.1");
      expect(output.text).toContain("\u001B[38;2;22;94;131m");
      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("設定ファイルの警告を端末の幅で折り返して字下げする", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    try {
      const path = join(home, ".ja-harness", "config.json");
      mkdirSync(join(home, ".ja-harness"), { recursive: true });
      writeFileSync(path, "{");
      const warning = `設定ファイルの ${path} が壊れています（JSON として読めません）`;
      const { complete } = sequence([]);
      const { input, output, result } = start({
        complete,
        home,
        columns: 30,
      });

      await waitFor(output, "壊れています");
      expect(await close(input, output, result)).toBe(0);

      const lines = stripAnsi(output.text).split("\r\n");
      const expected = wrap(warning, 27).map((part, index) =>
        index === 0 ? ` ${part}` : `   ${part}`,
      );
      expect(expected.length).toBeGreaterThan(1);
      for (const line of expected) {
        expect(lines).toContain(line);
        expect(stringWidth(line)).toBeLessThanOrEqual(30);
      }
      expect(expected[0]?.startsWith(" ")).toBe(true);
      expect(expected.slice(1).every((line) => line.startsWith("   "))).toBe(
        true,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("設定ファイルの警告をあいさつのあとに1行ずつ出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    try {
      const path = join(home, ".ja-harness", "config.json");
      mkdirSync(join(home, ".ja-harness"), { recursive: true });
      writeFileSync(path, "{");
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home });

      await waitFor(output, "壊れています");
      expect(await close(input, output, result)).toBe(0);

      const text = stripAnsi(output.text);
      expect(text).toContain(`設定ファイルの ${path}`);
      expect(text.indexOf("壊れています")).toBeGreaterThan(
        text.indexOf("ja-harness 0.1"),
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("runApp の決まりのファイル", () => {
  it("作業フォルダの AGENTS.md を読み、最初の system メッセージに入れる", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeFileSync(join(cwd, "AGENTS.md"), "作業フォルダの決まりです\n");
      const { complete, calls } = sequence([answer("ok")]);
      const { input, output, result } = start({ complete, home, cwd });

      await waitFor(output, "Instructions: AGENTS.md");
      input.send("hi\r");
      await waitFor(output, "ok");
      expect(await close(input, output, result)).toBe(0);

      expect(stripAnsi(output.text)).toContain("Instructions: AGENTS.md");
      expect(calls[0]?.[0]?.role).toBe("system");
      expect(calls[0]?.[0]?.content).toContain("作業フォルダの決まりです");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("決まりのファイルの行は警告色ではなく控えめな色で出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeFileSync(join(cwd, "AGENTS.md"), "決まり\n");
      const { complete } = sequence([]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        env: { COLORTERM: "truecolor" },
        isTTY: true,
      });

      await waitFor(output, "Instructions: AGENTS.md");
      expect(await close(input, output, result)).toBe(0);
      expect(output.text).toContain(
        "\u001B[2m  Instructions: AGENTS.md\u001B[0m",
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function writePersonalSkill(home: string, name: string, body = "本文") {
  const dir = join(home, ".ja-harness", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${name} の説明。\n---\n${body}\n`,
  );
  return dir;
}

describe("runApp のスキル", () => {
  it("/skills で一覧を出し、Space で切り替えて Enter で保存する", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writePersonalSkill(home, "demo");
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/skills\r");
      await waitFor(output, "[x] demo");
      input.send(" ");
      await waitFor(output, "[ ] demo");
      input.send("\r");
      await waitFor(output, "保存しました。次の /clear か起動から効きます");

      const path = join(home, ".ja-harness", "config.json");
      const saved = JSON.parse(readFileSync(path, "utf8")) as {
        skills: { disabled: string[] };
      };
      expect(saved.skills.disabled).toContain("demo");

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("作業フォルダで無効なスキルは [-] で切り替えず、保存にも入れない", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writePersonalSkill(home, "demo");
      writeSettingsConfig(cwd, { skills: { disabled: ["demo"] } });
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/skills\r");
      await waitFor(output, "[-] demo");
      input.send(" ");
      input.send("\r");
      await waitFor(output, "保存しました。次の /clear か起動から効きます");

      const path = join(home, ".ja-harness", "config.json");
      const saved = JSON.parse(readFileSync(path, "utf8")) as {
        skills: { disabled: string[] };
      };
      expect(saved.skills.disabled).not.toContain("demo");

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/<スキル名> の後ろの文を添えてスキルの本文を送る", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writePersonalSkill(home, "demo", "手順です。");
      const { complete, calls } = sequence([answer("ok")]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/demo これを直して\r");
      await waitFor(output, "ok");

      expect(await close(input, output, result)).toBe(0);
      const last = calls[0]?.at(-1);
      expect(last?.content).toContain('Follow the skill "demo" below.');
      expect(last?.content).toContain("手順です。");
      expect(last?.content).toContain("User request: これを直して");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("ローカルのフォルダから /skills add で個人のスキルに入れる", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const source = join(cwd, "source", "my-skill");
      mkdirSync(source, { recursive: true });
      writeFileSync(
        join(source, "SKILL.md"),
        "---\nname: added\ndescription: Added skill.\n---\n本文\n",
      );
      writeFileSync(join(source, "extra.txt"), "参考\n");
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send(`/skills add ${source}\r`);
      await waitFor(output, "Install skills");
      await waitFor(output, "added — Added skill.");
      input.send("\r");
      await waitFor(output, "入れました: added。");

      const dir = join(home, ".ja-harness", "skills", "added");
      expect(readFileSync(join(dir, "SKILL.md"), "utf8")).toContain(
        "name: added",
      );
      expect(existsSync(join(dir, "extra.txt"))).toBe(true);

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function mcpTool(
  server: string,
  name: string,
  description: string,
): McpToolInfo {
  return {
    server,
    name,
    fullName: `${server}.${name}`,
    description,
    inputSchema: { type: "object" },
  };
}

function fakeMcp(tools: McpToolInfo[] = []): typeof connectMcp {
  return async () => ({
    tools,
    warnings: [],
    call: async () => "",
    close: async () => {},
  });
}

describe("runApp の MCP", () => {
  it("/mcp で一覧を出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeSettingsConfig(home, {
        mcp: { servers: { demo: { command: "node" } } },
      });
      const { complete } = sequence([]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        connectMcp: fakeMcp(),
      });

      input.send("/mcp\r");
      await waitFor(output, "MCP");
      await waitFor(output, "[x] demo  -");
      input.send("\x1b");
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("サーバーがなければ一覧を開かずに足し方を出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/mcp\r");
      await waitFor(
        output,
        "MCP サーバーはありません。/mcp add <名前> <command> [args...] で足せます",
      );
      expect(stripAnsi(output.text)).not.toContain("╭─ MCP");

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("つながっているサーバーは道具の数とトークンを出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeSettingsConfig(home, {
        mcp: { servers: { demo: { command: "node" } } },
      });
      const tools = [mcpTool("demo", "check", "日本語を点検します。")];
      const { complete } = sequence([]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        connectMcp: fakeMcp(tools),
      });

      input.send("/mcp\r");
      await waitFor(output, "[x] demo  1 tools");
      input.send("\x1b");
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("Space で切り替えて Enter で個人の設定に保存する", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeSettingsConfig(home, {
        mcp: {
          servers: { demo: { command: "node" } },
          disabled: ["demo"],
        },
      });
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/mcp\r");
      await waitFor(output, "[ ] demo");
      input.send(" ");
      await waitFor(output, "[x] demo");
      input.send("\r");
      await waitFor(output, "保存しました。次の /clear か起動から効きます");

      const path = join(home, ".ja-harness", "config.json");
      const saved = JSON.parse(readFileSync(path, "utf8")) as {
        mcp: { enabled: string[]; disabled: string[] };
      };
      expect(saved.mcp.enabled).toEqual(["demo"]);
      expect(saved.mcp.disabled).toEqual([]);

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("Esc では保存しない", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeSettingsConfig(cwd, {
        mcp: {
          servers: { demo: { command: "node" } },
          disabled: ["demo"],
        },
      });
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send("/mcp\r");
      await waitFor(output, "[ ] demo");
      input.send(" ");
      input.send("\x1b");
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(existsSync(join(home, ".ja-harness", "config.json"))).toBe(false);

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("/mcp add で個人の設定にサーバーを足す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      const { complete } = sequence([]);
      const { input, output, result } = start({ complete, home, cwd });

      input.send(
        '/mcp add demo node "C:\\Program Files\\demo\\server.mjs" --flag\r',
      );
      await waitFor(
        output,
        "追加しました（demo）。次の /clear か起動から効きます",
      );

      const path = join(home, ".ja-harness", "config.json");
      const saved = JSON.parse(readFileSync(path, "utf8")) as {
        mcp: { servers: Record<string, { command: string; args?: string[] }> };
      };
      expect(saved.mcp.servers.demo).toEqual({
        command: "node",
        args: ["C:\\Program Files\\demo\\server.mjs", "--flag"],
      });

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("有効なサーバーがあると起動時につないでいますと出す", async () => {
    const home = mkdtempSync(join(tmpdir(), "ja-harness-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "ja-harness-cwd-"));
    try {
      writeSettingsConfig(home, {
        mcp: { servers: { demo: { command: "node" } } },
      });
      const { complete } = sequence([]);
      const { input, output, result } = start({
        complete,
        home,
        cwd,
        connectMcp: fakeMcp(),
      });

      await waitFor(output, "MCP: demo につないでいます…");

      expect(await close(input, output, result)).toBe(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
