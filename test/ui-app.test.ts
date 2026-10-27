import {
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
import type { Confirm, Decision } from "../src/tools/confirm.js";
import { runApp } from "../src/ui/app.js";
import { stringWidth, stripAnsi } from "../src/ui/width.js";

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

  send(text: string): void {
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
  model?: string;
}) {
  const input = new FakeInput();
  const output = new FakeOutput();
  if (options.columns !== undefined) {
    output.columns = options.columns;
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
    env: {},
    cwd: options.cwd ?? "/work",
    home: "/home/user",
    makeComplete,
    ...(options.createTools === undefined
      ? {}
      : { createTools: options.createTools }),
    contextWindow: 100000,
    model: options.model ?? "deepseek-v4.1-flash",
    version: "0.1",
    timing: { escape: 5, doubleEscape: 100, exit: 200 },
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
  await waitFor(output, "もう一度 Ctrl+D で終了");
  input.send("\x04");
  return result;
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
    await waitFor(output, "今回");

    expect(await close(input, output, result)).toBe(0);
    const text = stripAnsi(output.text);
    expect(text).toContain("› src/app.ts を直して");
    expect(text).toContain("読  src/app.ts（120行）");
    expect(text).toContain("直しました。");
    expect(text).toContain("今回 30 トークン");
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
    await waitFor(output, "Enter 許可");
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
    await waitFor(output, "Enter 許可");
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
    await waitFor(output, "Enter 許可");
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
    await waitFor(output, "Enter 許可");
    input.send("e");
    await waitFor(output, "却下の理由");
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
    await waitFor(output, "Enter 許可");
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
    await waitFor(output, "考えています");
    input.send("追加の指示\r");
    await waitFor(output, "待ち 1件");
    release?.();
    await waitFor(output, "作業中に送信");
    await waitFor(output, "受け取りました");

    expect(await close(input, output, result)).toBe(0);
    const last = calls[1]?.at(-1);
    expect(last).toEqual({ role: "user", content: "追加の指示" });
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
    await waitFor(output, "考えています");
    input.send("\x1b");
    await waitFor(output, "止めました");

    expect(await close(input, output, result)).toBe(0);
  });

  it("終了時は下の領域を消すエスケープを出してから改行する", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("\x04");
    await waitFor(output, "もう一度 Ctrl+D で終了");
    input.send("\x04");

    expect(await result).toBe(0);
    expect(output.text.endsWith("\r\x1b[J\r\n")).toBe(true);
  });

  it("Ctrl+D を2回押すと終了して 0 を返す", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("\x04");
    await waitFor(output, "もう一度 Ctrl+D で終了");
    input.send("\x04");

    expect(await result).toBe(0);
    expect(input.raw).toBe(false);
    expect(stripAnsi(output.text)).toContain("ja-harness 0.1");
  });
});

describe("runApp の追加機能", () => {
  it("Shift+Tab でモードが回り、次の発言の前に notice が入る", async () => {
    const { complete, calls } = sequence([answer("了解")]);
    const { input, output, result } = start({ complete });

    input.send("\x1b[Z");
    await waitFor(output, "計画");
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
    await waitFor(output, "計画");
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
      await waitFor(output, "計画");
      input.send("plan please\r");
      await waitFor(output, "計画  .ja-harness/plans/");

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
      await waitFor(output, "計画");
      input.send("plan please\r");
      await waitFor(output, "承認して実行");
      input.send("e");
      await waitFor(output, "直す理由");
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
      await waitFor(output, "計画");
      input.send("plan please\r");
      await waitFor(output, "却下");
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

    input.send("/permission 編集は自動\r");
    await waitFor(output, "編集は自動");
    input.send("go\r");
    await waitFor(output, "Enter 許可");
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

    input.send("/permission 編集は自動\r");
    await waitFor(output, "編集は自動");
    input.send("go\r");
    await waitFor(output, "Enter 許可");
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

    input.send("/permission すべて自動\r");
    await waitFor(output, "シェルのコマンドも確認せずに実行します");
    input.send("\r");
    await waitFor(output, "すべて自動");
    input.send("go\r");
    await waitFor(output, "done");

    expect(await close(input, output, result)).toBe(0);
    expect(seen).toEqual([true]);
    expect(stripAnsi(output.text)).not.toContain("Enter 許可");
  });

  it("/ の候補を Tab で入れて Enter で実行する", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("/mo");
    await waitFor(output, "/mode");
    await waitFor(output, "/model");
    input.send("\t");
    await waitFor(output, "› /mode");
    input.send("\r");
    await waitFor(output, "Enter 決める");

    input.send("\x1b");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await close(input, output, result)).toBe(0);
  });

  it("知らないコマンドを知らせる", async () => {
    const { complete } = sequence([]);
    const { input, output, result } = start({ complete });

    input.send("/nope\r");
    await waitFor(output, "知らないコマンドです: /nope");
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
    await waitFor(output, "推論の量");
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
    await waitFor(output, "途中経過: 詳しく");
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
    await waitFor(output, "考えています");
    input.send("\x1b");
    await waitFor(output, "止めました");
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
          title: "a.ts を編集します",
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
      await waitFor(output, "編集の案  a.txt  1/2");
      input.send("\r");
      await waitFor(output, "編集の案  a.txt  2/2");
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

  it("a で残りを全部採用する", async () => {
    const seen: Decision[] = [];
    const { complete } = sequence([call("edit", {}), answer("done")]);
    const { input, output, result } = start({
      complete,
      createTools: hunkTool(seen, TWO_HUNKS),
    });

    input.send("go\r");
    await waitFor(output, "編集の案  a.ts  1/2");
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
    await waitFor(output, "編集の案  a.ts  1/2");
    input.send("\r");
    await waitFor(output, "編集の案  a.ts  2/2");
    input.send("e");
    await waitFor(output, "却下の理由");
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

  it("Ctrl+R で見直し、←→ でファイルを切り替え、i の指示を送る", async () => {
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

      input.send("/permission 編集は自動\r");
      await waitFor(output, "編集は自動");
      input.send("go\r");
      await waitFor(output, "done");
      await waitFor(output, "今回");

      input.send("\x12");
      await waitFor(output, "見直し  a.txt  1/2");
      input.send("\x1b[C");
      await waitFor(output, "見直し  b.txt  2/2");
      input.send("i");
      await waitFor(output, "追加の指示");
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

      input.send("/permission 編集は自動\r");
      await waitFor(output, "編集は自動");
      input.send("go\r");
      await waitFor(output, "done");
      await waitFor(output, "今回");

      input.send("/undo\r");
      await waitFor(output, "戻しました: a.txt（1件）");
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
