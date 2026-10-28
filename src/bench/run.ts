import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Complete, type LoopEvent, runTurn } from "../agent/loop.js";
import { SYSTEM_PROMPT } from "../agent/prompt.js";
import { createRepeatTracker } from "../agent/repeat.js";
import { readConfig, useOpencodeSession } from "../cli/config.js";
import { createEstimator } from "../context/tokens.js";
import {
  loadCatalogFromCache,
  providerInfo,
  resolveProvider,
} from "../llm/catalog.js";
import { createClient } from "../llm/openai.js";
import type { Message, Usage } from "../llm/types.js";
import { createTools } from "../tools/index.js";
import {
  CONDITIONS,
  type ConditionName,
  type ContextOverride,
  createCondition,
  mergeContext,
} from "./conditions.js";
import { loadTasks, type TaskKind } from "./tasks.js";
import {
  applySolution,
  defaultWorkRoot,
  type GradeResult,
  gradeWorkspace,
  prepareWorkspace,
  timestamp,
} from "./workspace.js";

export const TURN_TIMEOUT_MS = 10 * 60 * 1000;

export type StopReason = "done" | "max-steps" | "error";

export type ContextActionCounts = {
  mask: number;
  prune: number;
  summary: number;
};

export type BenchRecord = {
  task: string;
  kind: TaskKind;
  condition: string;
  rep: number;
  pass: boolean;
  passed: number;
  failed: number;
  steps: number;
  turns: number;
  stop: StopReason;
  usage: Usage;
  contextActions: ContextActionCounts;
  durationMs: number;
  model: string;
  error?: string;
};

export type RunBenchOptions = {
  tasksDir: string;
  taskIds?: string[];
  conditions?: ConditionName[];
  reps: number;
  concurrency: number;
  workRoot?: string;
  resultsDir?: string;
  context?: ContextOverride;
  env?: NodeJS.ProcessEnv;
  turnTimeoutMs?: number;
  onProgress?: (line: string) => void;
};

export type BenchOutput = {
  records: BenchRecord[];
  resultsPath: string;
  table: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function zeroUsage(): Usage {
  return { input: 0, cachedInput: 0, output: 0, reasoning: 0 };
}

function addUsage(total: Usage, usage: Usage): void {
  total.input += usage.input;
  total.cachedInput += usage.cachedInput;
  total.output += usage.output;
  total.reasoning += usage.reasoning;
  if (usage.cost !== undefined) {
    total.cost = (total.cost ?? 0) + usage.cost;
  }
}

export function isExecutionFailure(record: BenchRecord): boolean {
  return record.stop === "error" && record.steps === 0;
}

export function modelSlug(model: string): string {
  const slug = model.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug === "" ? "model" : slug;
}

export function writeResults(
  resultsDir: string,
  model: string,
  payload: unknown,
  now = new Date(),
): string {
  const path = join(resultsDir, `${timestamp(now)}-${modelSlug(model)}.json`);
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function signed(value: number, suffix: string, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}${suffix}`;
}

function money(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function formatProgress(
  index: number,
  total: number,
  record: BenchRecord,
): string {
  const seconds = Math.round(record.durationMs / 1000);
  const prefix = `[${index}/${total}] ${record.task} ${record.condition} ${record.rep}回目`;
  if (isExecutionFailure(record)) {
    const reason = (record.error ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return `${prefix} 実行失敗 ${seconds}s${reason === "" ? "" : ` ${reason}`}`;
  }
  const cost = record.usage.cost === undefined ? "—" : money(record.usage.cost);
  const result = record.pass ? "合格" : "不合格";
  return `${prefix} ${result} ${seconds}s ${cost}`;
}

function width(text: string): number {
  let total = 0;
  for (const char of text) {
    total += (char.codePointAt(0) ?? 0) > 0x2e80 ? 2 : 1;
  }
  return total;
}

function pad(text: string, columns: number): string {
  return `${text}${" ".repeat(Math.max(0, columns - width(text)))}`;
}

function columns(rows: string[][]): number[] {
  const sizes: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      sizes[index] = Math.max(sizes[index] ?? 0, width(cell));
    });
  }
  return sizes;
}

function render(rows: string[][]): string[] {
  const sizes = columns(rows);
  return rows.map((row) =>
    row
      .map((cell, index) =>
        index === row.length - 1 ? cell : pad(cell, sizes[index] ?? 0),
      )
      .join("  ")
      .trimEnd(),
  );
}

type Stat = {
  total: number;
  passed: number;
  steps: number;
  failed: number;
};

function stats(records: BenchRecord[]): Stat {
  const stat: Stat = {
    total: 0,
    passed: 0,
    steps: 0,
    failed: 0,
  };
  for (const record of records) {
    if (isExecutionFailure(record)) {
      stat.failed += 1;
      continue;
    }
    stat.total += 1;
    if (record.pass) {
      stat.passed += 1;
    }
    stat.steps += record.steps;
  }
  return stat;
}

function averageCost(records: BenchRecord[]): number | undefined {
  const costs = records
    .filter((record) => !isExecutionFailure(record))
    .map((record) => record.usage.cost)
    .filter((cost): cost is number => cost !== undefined);
  return costs.length === 0 ? undefined : average(costs);
}

function averageContextAction(
  records: BenchRecord[],
  action: keyof ContextActionCounts,
): number {
  const values = records
    .filter((record) => !isExecutionFailure(record))
    .map((record) => record.contextActions[action]);
  return average(values);
}

export function formatResultsTable(
  records: BenchRecord[],
  conditions: string[],
  model: string,
): string {
  const lines: string[] = [`モデル: ${model}`, "条件別"];

  const conditionRows: string[][] = [
    ["条件", "合格", "合格率", "平均料金", "平均steps", "平均mask", "失敗"],
  ];
  for (const condition of conditions) {
    const group = records.filter((record) => record.condition === condition);
    const stat = stats(group);
    const cost = averageCost(group);
    conditionRows.push([
      condition,
      `${stat.passed}/${stat.total}`,
      percent(stat.total === 0 ? 0 : stat.passed / stat.total),
      cost === undefined ? "—" : money(cost),
      (stat.total === 0 ? 0 : stat.steps / stat.total).toFixed(1),
      averageContextAction(group, "mask").toFixed(1),
      String(stat.failed),
    ]);
  }
  lines.push(...render(conditionRows), "");

  const taskIds = [...new Set(records.map((record) => record.task))];
  lines.push("課題別の合格数");
  const taskRows: string[][] = [["課題", ...conditions]];
  for (const task of taskIds) {
    const cells = conditions.map((condition) => {
      const group = records.filter(
        (record) => record.task === task && record.condition === condition,
      );
      const valid = group.filter((record) => !isExecutionFailure(record));
      const passed = valid.filter((record) => record.pass).length;
      const failed = group.length - valid.length;
      const base = `${passed}/${valid.length}`;
      return failed === 0 ? base : `${base}（失敗${failed}）`;
    });
    taskRows.push([task, ...cells]);
  }
  lines.push(...render(taskRows));

  if (conditions.includes("none") && conditions.length > 1) {
    const base = stats(records.filter((record) => record.condition === "none"));
    const baseRate = base.total === 0 ? 0 : base.passed / base.total;
    const baseCost = averageCost(
      records.filter((record) => record.condition === "none"),
    );

    lines.push("", "none との差");
    const diffRows: string[][] = [["条件", "合格率", "料金"]];
    for (const condition of conditions) {
      if (condition === "none") {
        continue;
      }
      const group = records.filter((record) => record.condition === condition);
      const stat = stats(group);
      const rate = stat.total === 0 ? 0 : stat.passed / stat.total;
      const cost = averageCost(group);
      let costDiff = "—";
      if (baseCost !== undefined && cost !== undefined && baseCost !== 0) {
        costDiff = signed(((cost - baseCost) / baseCost) * 100, "%");
      }
      diffRows.push([
        condition,
        signed((rate - baseRate) * 100, "pt", 1),
        costDiff,
      ]);
    }
    lines.push(...render(diffRows));
  }

  return lines.join("\n");
}

export type RunOneOptions = {
  task: ReturnType<typeof loadTasks>[number];
  condition: ConditionName;
  rep: number;
  workRoot: string;
  config: ReturnType<typeof readConfig>;
  turnTimeoutMs: number;
  context?: ContextOverride;
  complete?: Complete;
};

export async function runOne(options: RunOneOptions): Promise<BenchRecord> {
  const { task, condition, rep, workRoot, config, turnTimeoutMs } = options;
  const started = Date.now();
  const record: BenchRecord = {
    task: task.id,
    kind: task.kind,
    condition,
    rep,
    pass: false,
    passed: 0,
    failed: 0,
    steps: 0,
    turns: 0,
    stop: "error",
    usage: zeroUsage(),
    contextActions: { mask: 0, prune: 0, summary: 0 },
    durationMs: 0,
    model: config.model,
  };

  let workspace: string;
  try {
    workspace = prepareWorkspace(task, workRoot, { condition, rep });
  } catch (error) {
    record.error = errorMessage(error);
    record.durationMs = Date.now() - started;
    return record;
  }

  const estimate = createEstimator();
  const session = randomUUID();
  const complete =
    options.complete ??
    createClient({
      baseUrl: config.baseUrl,
      model: config.model,
      ...(config.apiKey === undefined ? {} : { apiKey: config.apiKey }),
      ...(useOpencodeSession(config.provider)
        ? { headers: { "x-opencode-session": session } }
        : {}),
    }).complete;
  const parts = createCondition({
    name: condition,
    workspace,
    complete,
    contextWindow: config.contextWindow,
    estimate,
    model: config.model,
    context: mergeContext(options.context),
  });

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];
  const tools = createTools(workspace, async () => true);
  const repeat = createRepeatTracker();

  let eventUsage = zeroUsage();
  let eventSteps = 0;
  const onEvent = (event: LoopEvent): void => {
    if (event.type === "context") {
      record.contextActions[event.action] += 1;
      return;
    }
    if (event.type !== "step-end") {
      return;
    }
    eventSteps += 1;
    addUsage(eventUsage, event.usage);
  };

  let runError: string | undefined;
  record.stop = "done";
  for (const [index, turn] of task.turns.entries()) {
    messages.push({ role: "user", content: turn });
    eventUsage = zeroUsage();
    eventSteps = 0;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), turnTimeoutMs);
    try {
      const result = await runTurn({
        complete,
        tools,
        messages,
        maxSteps: 30,
        signal: controller.signal,
        onEvent,
        repeat,
        ...parts,
      });
      record.steps += result.steps;
      addUsage(record.usage, result.usage);
      record.turns = index + 1;
      record.stop = result.stop;
      if (result.stop !== "done") {
        break;
      }
    } catch (error) {
      record.steps += eventSteps;
      addUsage(record.usage, eventUsage);
      record.turns = index + 1;
      record.stop = "error";
      runError = controller.signal.aborted ? "時間切れ" : errorMessage(error);
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  let gradeError: string | undefined;
  try {
    const grade = await gradeWorkspace(task, workspace);
    record.pass = grade.pass;
    record.passed = grade.passed;
    record.failed = grade.failed;
  } catch (error) {
    record.pass = false;
    gradeError = `採点に失敗: ${errorMessage(error)}`;
  } finally {
    record.durationMs = Date.now() - started;
  }

  const errors = [runError, gradeError].filter(
    (value): value is string => value !== undefined,
  );
  if (errors.length > 0) {
    record.error = errors.join(" / ");
  }

  return record;
}

export async function runBench(options: RunBenchOptions): Promise<BenchOutput> {
  const conditions = options.conditions ?? [...CONDITIONS];
  const tasks = loadTasks(options.tasksDir, options.taskIds);
  const env = options.env ?? process.env;
  const provider = resolveProvider(env);
  loadCatalogFromCache({
    home: env.JA_HARNESS_HOME ?? homedir(),
    provider,
  });
  const config = readConfig(env, {
    provider,
    catalog: providerInfo(provider),
  });
  const workRoot = options.workRoot ?? defaultWorkRoot();
  const resultsDir = options.resultsDir ?? "bench/results";
  const turnTimeoutMs = options.turnTimeoutMs ?? TURN_TIMEOUT_MS;
  const onProgress =
    options.onProgress ?? ((line: string) => process.stderr.write(`${line}\n`));

  const jobs: Array<{
    task: (typeof tasks)[number];
    condition: ConditionName;
    rep: number;
  }> = [];
  for (const task of tasks) {
    for (const condition of conditions) {
      for (let rep = 1; rep <= options.reps; rep += 1) {
        jobs.push({ task, condition, rep });
      }
    }
  }

  const records = new Array<BenchRecord>(jobs.length);
  let next = 0;
  const workerCount = Math.max(1, options.concurrency);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = next;
      next += 1;
      const job = jobs[index];
      if (job === undefined) {
        return;
      }
      const record = await runOne({
        ...job,
        workRoot,
        config,
        turnTimeoutMs,
        ...(options.context === undefined ? {} : { context: options.context }),
      });
      records[index] = record;
      onProgress(formatProgress(index + 1, jobs.length, record));
    }
  });
  await Promise.all(workers);

  const resultsPath = writeResults(resultsDir, config.model, {
    model: config.model,
    baseUrl: config.baseUrl,
    createdAt: new Date().toISOString(),
    conditions,
    reps: options.reps,
    results: records,
  });

  return {
    records,
    resultsPath,
    table: formatResultsTable(records, conditions, config.model),
  };
}

export type ValidationRow = {
  task: string;
  files: GradeResult;
  solution: GradeResult;
  ok: boolean;
};

export type ValidationReport = {
  ok: boolean;
  rows: ValidationRow[];
  table: string;
};

export async function validateTasks(options: {
  tasksDir: string;
  taskIds?: string[];
  workRoot?: string;
}): Promise<ValidationReport> {
  const tasks = loadTasks(options.tasksDir, options.taskIds);
  const workRoot = options.workRoot ?? defaultWorkRoot();
  const rows: ValidationRow[] = [];

  for (const task of tasks) {
    const workspace = prepareWorkspace(task, workRoot, { suffix: "validate" });
    const files = await gradeWorkspace(task, workspace);
    applySolution(task, workspace);
    const solution = await gradeWorkspace(task, workspace);
    rows.push({
      task: task.id,
      files,
      solution,
      ok: !files.pass && solution.pass,
    });
  }

  const tableRows: string[][] = [["課題", "元のまま", "模範解答", "判定"]];
  for (const row of rows) {
    tableRows.push([
      row.task,
      row.files.pass ? "合格" : "不合格",
      row.solution.pass ? "合格" : "不合格",
      row.ok ? "OK" : "期待と違う",
    ]);
  }

  return {
    ok: rows.every((row) => row.ok),
    rows,
    table: render(tableRows).join("\n"),
  };
}
