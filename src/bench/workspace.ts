import { spawn } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { BenchTask } from "./tasks.js";

const MAX_OUTPUT_CHARS = 2 * 1024 * 1024;

export function timestamp(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function defaultWorkRoot(now = new Date()): string {
  return join(tmpdir(), "ja-harness-bench", timestamp(now));
}

export type WorkspaceLabel = {
  condition?: string;
  rep?: number;
  suffix?: string;
};

function workspaceName(task: BenchTask, label: WorkspaceLabel): string {
  if (label.suffix !== undefined) {
    return `${task.id}-${label.suffix}`;
  }
  if (label.condition !== undefined && label.rep !== undefined) {
    return `${task.id}-${label.condition}-${label.rep}`;
  }
  return `${task.id}-work`;
}

export function prepareWorkspace(
  task: BenchTask,
  root: string,
  label: WorkspaceLabel = {},
): string {
  const workspace = join(resolve(root), workspaceName(task, label));
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  cpSync(join(task.dir, "files"), workspace, { recursive: true });
  return workspace;
}

export function applySolution(task: BenchTask, workspace: string): void {
  cpSync(join(task.dir, "solution"), workspace, { recursive: true });
}

type TestRun = {
  code: number | null;
  output: string;
  timedOut: boolean;
};

function runTests(
  workspace: string,
  testFiles: string[],
  timeoutMs: number,
): Promise<TestRun> {
  return new Promise((done) => {
    const child = spawn(process.execPath, ["--test", ...testFiles], {
      cwd: workspace,
      env: process.env,
    });

    let output = "";
    const collect = (chunk: Buffer): void => {
      if (output.length >= MAX_OUTPUT_CHARS) {
        return;
      }
      output += chunk
        .toString("utf8")
        .slice(0, MAX_OUTPUT_CHARS - output.length);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    let settled = false;
    let timedOut = false;
    const finish = (code: number | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      done({ code, output, timedOut });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (error) => {
      output += `\n${error.message}`;
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

function readCount(output: string, name: "pass" | "fail"): number {
  const found = output.match(new RegExp(`^# ${name} (\\d+)$`, "m"));
  return found === null ? 0 : Number(found[1]);
}

function tail(output: string): string {
  const text = output.replace(/\s+$/, "");
  if (text === "") {
    return "";
  }
  return text.split(/\r?\n/).slice(-40).join("\n");
}

export type GradeResult = {
  pass: boolean;
  passed: number;
  failed: number;
  output: string;
};

export async function gradeWorkspace(
  task: BenchTask,
  workspace: string,
  timeoutMs = 60000,
): Promise<GradeResult> {
  const gradeDir = join(workspace, ".bench-grade");
  rmSync(gradeDir, { recursive: true, force: true });
  cpSync(join(task.dir, "grade"), gradeDir, { recursive: true });

  const testFiles = readdirSync(gradeDir, { recursive: true, encoding: "utf8" })
    .map((file) => String(file))
    .filter((file) => file.endsWith(".test.js"))
    .map((file) => join(".bench-grade", file))
    .sort();

  if (testFiles.length === 0) {
    return {
      pass: false,
      passed: 0,
      failed: 0,
      output: "採点のテストがありません",
    };
  }

  const run = await runTests(workspace, testFiles, timeoutMs);
  const passed = readCount(run.output, "pass");
  const failed = readCount(run.output, "fail");
  const note = run.timedOut ? `\n採点が時間切れです（${timeoutMs}ms）` : "";

  return {
    pass: !run.timedOut && run.code === 0,
    passed,
    failed,
    output: tail(`${run.output}${note}`),
  };
}
