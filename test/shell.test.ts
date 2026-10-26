import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Confirm } from "../src/tools/confirm.js";
import { cleanOutput, createShellTool } from "../src/tools/shell.js";

function setup(): string {
  return mkdtempSync(join(tmpdir(), "ja-harness-shell-"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!existsSync(path)) {
    if (Date.now() > deadline) {
      throw new Error(`file not created: ${path}`);
    }
    await sleep(20);
  }
}

async function waitForExit(pid: number): Promise<void> {
  const deadline = Date.now() + 2000;
  for (;;) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        return;
      }
      throw error;
    }
    if (Date.now() > deadline) {
      throw new Error(`process still running: ${pid}`);
    }
    await sleep(20);
  }
}

const GRANDCHILD = "sh -c 'sleep 30 & echo $! > grandchild.pid; wait'";

describe("cleanOutput", () => {
  it("ANSI のエスケープを除く", () => {
    expect(cleanOutput("\x1b[31mred\x1b[0m")).toBe("red");
    expect(cleanOutput("\x1b[2K\x1b[1;2Hmoved")).toBe("moved");
  });

  it("CRLF を LF にする", () => {
    expect(cleanOutput("a\r\nb\r\n")).toBe("a\nb");
  });

  it("行の中の CR は最後の CR より後ろだけを残す", () => {
    expect(cleanOutput("10%\r20%\r30%")).toBe("30%");
  });

  it("同じ行が3回以上続いたら1行にまとめる", () => {
    expect(cleanOutput("x\nx\nx\ny")).toBe(
      "x\n(previous line repeated 2 more times)\ny",
    );
    expect(cleanOutput("x\nx\ny")).toBe("x\nx\ny");
  });

  it("末尾の空行を除く", () => {
    expect(cleanOutput("a\n\n\n")).toBe("a");
  });
});

describe("shell", () => {
  it("終了コードを付けて返す", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);

    const result = await createShellTool(cwd, confirm).execute({
      command: "echo hi",
    });

    expect(result).toBe("hi\n[exit code 0]");
    expect(confirm).toHaveBeenCalledWith({
      tool: "shell",
      title: "コマンドを実行します: echo hi",
      detail: "echo hi",
    });
  });

  it("stderr も出力に含める", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);

    const result = await createShellTool(cwd, confirm).execute({
      command: "echo err >&2",
    });

    expect(result).toBe("err\n[exit code 0]");
  });

  it("失敗した終了コードも返す", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);

    const result = await createShellTool(cwd, confirm).execute({
      command: "exit 3",
    });

    expect(result).toBe("(no output)\n[exit code 3]");
  });

  it("時間切れなら子を止めて印を付ける", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);

    const result = await createShellTool(cwd, confirm).execute({
      command: "sleep 5",
      timeoutSeconds: 1,
    });

    expect(result).toContain("[timed out after 1s]");
    expect(result).toContain("[killed by SIGKILL]");
  }, 10000);

  it("時間切れで孫のプロセスも止める", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);
    const pidFile = join(cwd, "grandchild.pid");

    const result = await createShellTool(cwd, confirm).execute({
      command: GRANDCHILD,
      timeoutSeconds: 1,
    });

    expect(result).toContain("[timed out after 1s]");
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    await waitForExit(pid);
  }, 10000);

  it("中断で reject し、孫のプロセスも止める", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);
    const controller = new AbortController();
    const pidFile = join(cwd, "grandchild.pid");

    const pending = createShellTool(cwd, confirm).execute(
      { command: GRANDCHILD, timeoutSeconds: 30 },
      controller.signal,
    );

    await waitForFile(pidFile);
    controller.abort(new Error("aborted by test"));

    await expect(pending).rejects.toThrow("aborted by test");
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    await waitForExit(pid);
  }, 10000);

  it("入力を読むコマンドは待たずに終わる", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);
    const started = Date.now();

    const result = await createShellTool(cwd, confirm).execute({
      command: "cat",
      timeoutSeconds: 5,
    });

    expect(Date.now() - started).toBeLessThan(2000);
    expect(result).not.toContain("[timed out");
    expect(result).toBe("(no output)\n[exit code 0]");
  }, 10000);

  it("断られたら実行しない", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => false);

    const result = await createShellTool(cwd, confirm).execute({
      command: "echo x > side.txt",
    });

    expect(result).toBe(
      "The user declined this command. Ask what they want instead.",
    );
    expect(existsSync(join(cwd, "side.txt"))).toBe(false);
  });

  it("timeoutSeconds の範囲を確かめる", async () => {
    const cwd = setup();
    const confirm = vi.fn<Confirm>(async () => true);

    await expect(
      createShellTool(cwd, confirm).execute({
        command: "echo hi",
        timeoutSeconds: 0,
      }),
    ).rejects.toThrow(
      'shell: "timeoutSeconds" must be an integer from 1 to 600',
    );
  });
});
