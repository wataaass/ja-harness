import { spawn } from "node:child_process";
import type { Tool } from "../agent/loop.js";
import type { Confirm } from "./confirm.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes are intentional
const ANSI = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-_])/g;
const REPEAT_THRESHOLD = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function cleanOutput(text: string): string {
  const withoutAnsi = text.replace(ANSI, "").replace(/\r\n/g, "\n");

  const lines = withoutAnsi.split("\n").map((line) => {
    const carriage = line.lastIndexOf("\r");
    return carriage === -1 ? line : line.slice(carriage + 1);
  });
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const collapsed: string[] = [];
  let index = 0;
  while (index < lines.length) {
    let next = index + 1;
    while (next < lines.length && lines[next] === lines[index]) {
      next += 1;
    }
    const repeated = next - index - 1;
    if (repeated >= REPEAT_THRESHOLD) {
      collapsed.push(lines[index]);
      collapsed.push(`(previous line repeated ${repeated} more times)`);
    } else {
      collapsed.push(...lines.slice(index, next));
    }
    index = next;
  }

  return collapsed.join("\n");
}

type ShellResult = {
  output: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
};

function abortReason(signal?: AbortSignal): Error {
  const reason: unknown = signal?.reason;
  if (reason instanceof Error) {
    return reason;
  }
  if (reason !== undefined) {
    return new Error(String(reason));
  }
  return new Error("aborted");
}

function run(
  command: string,
  cwd: string,
  timeoutSeconds: number,
  signal?: AbortSignal,
): Promise<ShellResult> {
  return new Promise<ShellResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const child = spawn(command, {
      cwd,
      shell: true,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    let timedOut = false;

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      output += chunk;
    });

    const killGroup = () => {
      if (child.pid === undefined) {
        return;
      }
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // already gone
      }
    };

    const onAbort = () => {
      if (settled) {
        return;
      }
      killGroup();
      fail(abortReason(signal));
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutSeconds * 1000);

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    const finish = (code: number | null, reason: NodeJS.Signals | null) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({ output, code, signal: reason, timedOut });
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
    }

    child.on("error", fail);
    child.on("close", (code, reason) => {
      finish(code, reason);
    });
  });
}

export function createShellTool(cwd: string, confirm: Confirm): Tool {
  return {
    name: "shell",
    description:
      "Run a shell command in the working directory. Returns stdout and stderr.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to run.",
        },
        timeoutSeconds: {
          type: "integer",
          minimum: 1,
          maximum: 600,
          description: "Timeout in seconds (default 120).",
        },
      },
      required: ["command"],
    },
    maxResultTokens: 6000,
    async execute(args: unknown, signal?: AbortSignal): Promise<string> {
      if (!isRecord(args)) {
        throw new Error("shell: arguments must be an object");
      }
      if (typeof args.command !== "string" || args.command === "") {
        throw new Error('shell: "command" must be a non-empty string');
      }
      const timeoutSeconds = args.timeoutSeconds ?? 120;
      if (
        typeof timeoutSeconds !== "number" ||
        !Number.isInteger(timeoutSeconds) ||
        timeoutSeconds < 1 ||
        timeoutSeconds > 600
      ) {
        throw new Error(
          'shell: "timeoutSeconds" must be an integer from 1 to 600',
        );
      }

      const firstLine = args.command.split(/\r?\n/)[0] ?? "";
      const shown = firstLine.slice(0, 80);

      signal?.throwIfAborted();
      const accepted = await confirm({
        tool: "shell",
        title: `コマンドを実行します: ${shown}`,
        detail: args.command,
      });
      if (!accepted) {
        return "The user declined this command. Ask what they want instead.";
      }

      const result = await run(args.command, cwd, timeoutSeconds, signal);
      const cleaned = cleanOutput(result.output);
      const body = cleaned === "" ? "(no output)" : cleaned;
      const parts = [body];
      if (result.timedOut) {
        parts.push(`[timed out after ${timeoutSeconds}s]`);
      }
      parts.push(
        result.signal === null
          ? `[exit code ${result.code ?? 0}]`
          : `[killed by ${result.signal}]`,
      );
      return parts.join("\n");
    },
  };
}
