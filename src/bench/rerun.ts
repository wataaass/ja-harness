import { readFileSync } from "node:fs";
import { readConfig } from "../cli/config.js";
import { type ConditionName, isConditionName } from "./conditions.js";
import {
  type BenchRecord,
  formatProgress,
  formatResultsTable,
  isExecutionFailure,
  runOne,
  TURN_TIMEOUT_MS,
  writeResults,
} from "./run.js";
import { loadTasks } from "./tasks.js";
import { defaultWorkRoot } from "./workspace.js";

export type BenchResultsFile = {
  model: string;
  baseUrl?: string;
  createdAt?: string;
  conditions: string[];
  reps: number;
  results: BenchRecord[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseResultsJson(text: string): BenchResultsFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`結果の JSON が壊れています: ${message(error)}`);
  }

  const data = asRecord(value);
  if (typeof data.model !== "string" || data.model === "") {
    throw new Error("結果の JSON に model がありません");
  }
  if (!Array.isArray(data.results)) {
    throw new Error("結果の JSON に results がありません");
  }

  const results: BenchRecord[] = [];
  for (const item of data.results) {
    const record = asRecord(item);
    if (
      typeof record.task !== "string" ||
      typeof record.condition !== "string" ||
      typeof record.rep !== "number"
    ) {
      throw new Error(
        "結果の JSON に task・condition・rep のない記録があります",
      );
    }
    results.push(record as BenchRecord);
  }

  const conditions = Array.isArray(data.conditions)
    ? data.conditions.filter((item): item is string => typeof item === "string")
    : [...new Set(results.map((record) => record.condition))];
  const reps =
    typeof data.reps === "number"
      ? data.reps
      : results.reduce((max, record) => Math.max(max, record.rep), 0);

  const parsed: BenchResultsFile = {
    model: data.model,
    conditions,
    reps,
    results,
  };
  if (typeof data.baseUrl === "string") {
    parsed.baseUrl = data.baseUrl;
  }
  if (typeof data.createdAt === "string") {
    parsed.createdAt = data.createdAt;
  }
  return parsed;
}

function recordKey(record: BenchRecord): string {
  return `${record.task}\u0000${record.condition}\u0000${record.rep}`;
}

export function replaceRecords(
  original: BenchRecord[],
  replacements: BenchRecord[],
): BenchRecord[] {
  const index = new Map<string, number>();
  original.forEach((record, position) => {
    const key = recordKey(record);
    if (!index.has(key)) {
      index.set(key, position);
    }
  });

  const next = [...original];
  for (const replacement of replacements) {
    const position = index.get(recordKey(replacement));
    if (position === undefined) {
      throw new Error(
        `置き換える記録がありません: ${replacement.task} ${replacement.condition} ${replacement.rep}回目`,
      );
    }
    next[position] = replacement;
  }
  return next;
}

export function executionFailures(records: BenchRecord[]): BenchRecord[] {
  return records.filter((record) => isExecutionFailure(record));
}

export type RerunErrorsOptions = {
  resultsPath: string;
  tasksDir: string;
  concurrency: number;
  workRoot?: string;
  resultsDir?: string;
  env?: NodeJS.ProcessEnv;
  turnTimeoutMs?: number;
  onProgress?: (line: string) => void;
};

export type RerunErrorsOutput = {
  records: BenchRecord[];
  resultsPath: string;
  table: string;
};

export async function rerunErrors(
  options: RerunErrorsOptions,
): Promise<RerunErrorsOutput> {
  const text = readFileSync(options.resultsPath, "utf8");
  const payload = parseResultsJson(text);
  const config = readConfig(options.env ?? process.env);
  if (payload.model !== config.model) {
    throw new Error(
      `モデルが違います: 結果は ${payload.model}、今の環境は ${config.model}`,
    );
  }

  const failures = executionFailures(payload.results);
  const workRoot = options.workRoot ?? defaultWorkRoot();
  const resultsDir = options.resultsDir ?? "bench/results";
  const turnTimeoutMs = options.turnTimeoutMs ?? TURN_TIMEOUT_MS;
  const onProgress =
    options.onProgress ?? ((line: string) => process.stderr.write(`${line}\n`));

  const taskIds = [...new Set(failures.map((record) => record.task))];
  const tasks = loadTasks(options.tasksDir, taskIds);
  const byId = new Map(tasks.map((task) => [task.id, task]));

  const jobs = failures.map((record) => {
    const task = byId.get(record.task);
    if (task === undefined) {
      throw new Error(`課題がありません: ${record.task}`);
    }
    if (!isConditionName(record.condition)) {
      throw new Error(`知らない条件です: ${record.condition}`);
    }
    return {
      task,
      condition: record.condition as ConditionName,
      rep: record.rep,
    };
  });

  const replacements = new Array<BenchRecord>(jobs.length);
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
      });
      replacements[index] = record;
      onProgress(formatProgress(index + 1, jobs.length, record));
    }
  });
  await Promise.all(workers);

  const replaced = replaceRecords(payload.results, replacements);
  const resultsPath = writeResults(resultsDir, config.model, {
    model: config.model,
    baseUrl: config.baseUrl,
    createdAt: new Date().toISOString(),
    conditions: payload.conditions,
    reps: payload.reps,
    results: replaced,
  });

  return {
    records: replaced,
    resultsPath,
    table: formatResultsTable(replaced, payload.conditions, config.model),
  };
}
