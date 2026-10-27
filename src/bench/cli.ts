import {
  CONDITIONS,
  type ConditionName,
  isConditionName,
} from "./conditions.js";
import { gradeExternal, prepareExternal } from "./external.js";
import { rerunErrors } from "./rerun.js";
import { runBench, validateTasks } from "./run.js";

const BENCH_HELP = `使い方: ja-harness bench [オプション]

コードの課題を解かせ、隠したテストで採点します。

オプション:
  --tasks a,b           課題を選ぶ
  --conditions a,b      条件（none,input-only,default）
  --reps N              回数（既定3）
  --concurrency N       同時数（既定3）
  --tasks-dir DIR       課題のフォルダ（既定 bench/tasks）
  --work-dir DIR        作業場所（既定は tmpdir。--grade は --prepare のフォルダ）
  --validate            API を呼ばずに課題を確かめる
  --rerun-errors FILE   結果の JSON の中で実行失敗だけをやり直す
  --prepare NAME        他のハーネス用に作業場所を作る
  --grade NAME          他のハーネスの結果を採点する
  -h, --help            この使い方
`;

export type BenchArgs = {
  tasks?: string[];
  conditions: ConditionName[];
  reps: number;
  concurrency: number;
  tasksDir: string;
  workDir?: string;
  validate: boolean;
  rerunErrors?: string;
  prepare?: string;
  grade?: string;
  help: boolean;
};

function words(value: string, option: string): string[] {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  if (items.length === 0) {
    throw new Error(`${option} に値がありません`);
  }
  return items;
}

function positive(value: string, option: string): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < 1) {
    throw new Error(`${option} は正の整数です`);
  }
  return number;
}

function optionValue(
  args: string[],
  index: number,
  option: string,
): { value: string; next: number } {
  const value = args[index + 1];
  if (value === undefined) {
    throw new Error(`${option} に値がありません`);
  }
  return { value, next: index + 1 };
}

export function parseBenchArgs(args: string[]): BenchArgs {
  const parsed: BenchArgs = {
    conditions: [...CONDITIONS],
    reps: 3,
    concurrency: 3,
    tasksDir: "bench/tasks",
    validate: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--validate") {
      parsed.validate = true;
    } else if (arg === "--rerun-errors") {
      const item = optionValue(args, index, arg);
      parsed.rerunErrors = item.value;
      index = item.next;
    } else if (arg === "--tasks") {
      const item = optionValue(args, index, arg);
      parsed.tasks = words(item.value, arg);
      index = item.next;
    } else if (arg === "--conditions") {
      const item = optionValue(args, index, arg);
      const conditions = words(item.value, arg);
      for (const condition of conditions) {
        if (!isConditionName(condition)) {
          throw new Error(`知らない条件です: ${condition}`);
        }
      }
      parsed.conditions = conditions as ConditionName[];
      index = item.next;
    } else if (arg === "--reps") {
      const item = optionValue(args, index, arg);
      parsed.reps = positive(item.value, arg);
      index = item.next;
    } else if (arg === "--concurrency") {
      const item = optionValue(args, index, arg);
      parsed.concurrency = positive(item.value, arg);
      index = item.next;
    } else if (arg === "--tasks-dir") {
      const item = optionValue(args, index, arg);
      parsed.tasksDir = item.value;
      index = item.next;
    } else if (arg === "--work-dir") {
      const item = optionValue(args, index, arg);
      parsed.workDir = item.value;
      index = item.next;
    } else if (arg === "--prepare") {
      const item = optionValue(args, index, arg);
      parsed.prepare = item.value;
      index = item.next;
    } else if (arg === "--grade") {
      const item = optionValue(args, index, arg);
      parsed.grade = item.value;
      index = item.next;
    } else {
      throw new Error(`知らないオプションです: ${arg}`);
    }
  }

  if (parsed.prepare !== undefined && parsed.grade !== undefined) {
    throw new Error("--prepare と --grade は同時に使えません");
  }
  if (
    parsed.validate &&
    (parsed.prepare !== undefined || parsed.grade !== undefined)
  ) {
    throw new Error("--validate と --prepare / --grade は同時に使えません");
  }
  if (
    parsed.rerunErrors !== undefined &&
    (parsed.validate ||
      parsed.prepare !== undefined ||
      parsed.grade !== undefined)
  ) {
    throw new Error(
      "--rerun-errors と --validate / --prepare / --grade は同時に使えません",
    );
  }

  return parsed;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runBenchCli(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  let options: BenchArgs;
  try {
    options = parseBenchArgs(args);
  } catch (error) {
    process.stderr.write(`エラー: ${message(error)}\n`);
    return 1;
  }

  if (options.help) {
    process.stdout.write(BENCH_HELP);
    return 0;
  }

  try {
    if (options.rerunErrors !== undefined) {
      const result = await rerunErrors({
        resultsPath: options.rerunErrors,
        tasksDir: options.tasksDir,
        concurrency: options.concurrency,
        ...(options.workDir === undefined ? {} : { workRoot: options.workDir }),
        env,
      });
      process.stdout.write(`${result.table}\n結果: ${result.resultsPath}\n`);
      return 0;
    }

    if (options.prepare !== undefined) {
      const result = prepareExternal({
        name: options.prepare,
        tasksDir: options.tasksDir,
        ...(options.tasks === undefined ? {} : { taskIds: options.tasks }),
        reps: options.reps,
        ...(options.workDir === undefined ? {} : { workRoot: options.workDir }),
      });
      process.stdout.write(
        `用意: ${result.manifest.tasks.length} 課題 × ${options.reps} 回\n${result.manifestPath}\n`,
      );
      return 0;
    }

    if (options.grade !== undefined) {
      const result = await gradeExternal({
        name: options.grade,
        tasksDir: options.tasksDir,
        env,
        ...(options.workDir === undefined ? {} : { workDir: options.workDir }),
      });
      process.stdout.write(`${result.table}\n結果: ${result.resultsPath}\n`);
      return 0;
    }

    if (options.validate) {
      const report = await validateTasks({
        tasksDir: options.tasksDir,
        ...(options.tasks === undefined ? {} : { taskIds: options.tasks }),
        ...(options.workDir === undefined ? {} : { workRoot: options.workDir }),
      });
      process.stdout.write(`${report.table}\n`);
      return report.ok ? 0 : 1;
    }

    const result = await runBench({
      tasksDir: options.tasksDir,
      ...(options.tasks === undefined ? {} : { taskIds: options.tasks }),
      conditions: options.conditions,
      reps: options.reps,
      concurrency: options.concurrency,
      ...(options.workDir === undefined ? {} : { workRoot: options.workDir }),
      env,
    });
    process.stdout.write(`${result.table}\n結果: ${result.resultsPath}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`エラー: ${message(error)}\n`);
    return 1;
  }
}
