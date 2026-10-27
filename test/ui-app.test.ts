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
  complete: Complete;
  createTools?: (confirm: Confirm) => Tool[];
  columns?: number;
}) {
  const input = new FakeInput();
  const output = new FakeOutput();
  if (options.columns !== undefined) {
    output.columns = options.columns;
  }
  const result = runApp({
    input,
    output,
    env: {},
    cwd: "/work",
    home: "/home/user",
    complete: options.complete,
    ...(options.createTools === undefined
      ? {}
      : { createTools: options.createTools }),
    contextWindow: 100000,
    model: "deepseek-v4.1-flash",
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
