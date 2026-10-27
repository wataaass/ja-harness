import { spawn } from "node:child_process";
import type { Tool } from "../agent/loop.js";
import { type Confirm, toDecision } from "./confirm.js";

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

export function shellInvocation(
  command: string,
  platform: string = process.platform,
): { command: string; args: string[] } {
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command}`,
      ],
    };
  }
  return { command, args: [] };
}

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
  platform: string = process.platform,
): Promise<ShellResult> {
  return new Promise<ShellResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const invocation = shellInvocation(command, platform);
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      ...(platform === "win32"
        ? { windowsHide: true }
        : { shell: true, detached: true }),
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
      if (platform === "win32") {
        const killer = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          { windowsHide: true },
        );
        killer.on("error", () => {
          // already gone
        });
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

function declined(message: string, reason: string | undefined): string {
  const text = reason?.trim() ?? "";
  return text === "" ? message : `${message}\nReason from the user: ${text}`;
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
        description: {
          type: "string",
          description:
            'Shown to the user when asking permission. Say what the command does in plain English, starting with a verb. Keep simple commands to 3-8 words, e.g. ls -> "List files in this folder", npm test -> "Run the tests", git log -5 -> "Show the last 5 commits". For a long or unclear command, name its goal, e.g. "Find TODO comments in src".',
        },
        timeoutSeconds: {
          type: "integer",
          minimum: 1,
          maximum: 600,
          description: "Timeout in seconds (default 120).",
        },
      },
      required: ["command", "description"],
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

      const description =
        typeof args.description === "string"
          ? args.description.trim().slice(0, 80)
          : "";
      const title = description === "" ? "Shell" : `Shell · ${description}`;

      signal?.throwIfAborted();
      const decision = toDecision(
        await confirm({
          tool: "shell",
          title,
          detail: args.command,
        }),
      );
      if (!decision.allow) {
        return declined(
          "The user declined this command. Ask what they want instead.",
          decision.reason,
        );
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
