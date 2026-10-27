import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { readConfig } from "../cli/config.js";
import { type BenchRecord, formatResultsTable, writeResults } from "./run.js";
import { loadTasks } from "./tasks.js";
import {
  defaultWorkRoot,
  gradeWorkspace,
  prepareWorkspace,
} from "./workspace.js";

export type ExternalTask = {
  id: string;
  kind: string;
  prompt: string;
  workspaces: string[];
};

export type ExternalManifest = {
  name: string;
  reps: number;
  tasks: ExternalTask[];
};

export type PrepareExternalOptions = {
  name: string;
  tasksDir: string;
  taskIds?: string[];
  reps: number;
  workRoot?: string;
};

export function prepareExternal(options: PrepareExternalOptions): {
  dir: string;
  manifest: ExternalManifest;
  manifestPath: string;
} {
  const workRoot = options.workRoot ?? defaultWorkRoot();
  const dir = join(workRoot, options.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const tasks = loadTasks(options.tasksDir, options.taskIds);
  const manifest: ExternalManifest = {
    name: options.name,
    reps: options.reps,
    tasks: tasks.map((task) => {
      const workspaces: string[] = [];
      for (let rep = 1; rep <= options.reps; rep += 1) {
        const workspace = prepareWorkspace(task, dir, {
          suffix: String(rep),
        });
        workspaces.push(relative(dir, workspace));
      }
      return {
        id: task.id,
        kind: task.kind,
        prompt: task.prompt,
        workspaces,
      };
    }),
  };

  const manifestPath = join(dir, "tasks.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { dir, manifest, manifestPath };
}

function readManifest(path: string): ExternalManifest {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`tasks.json がありません: ${path}`);
  }

  const manifest =
    typeof value === "object" && value !== null
      ? (value as Partial<ExternalManifest>)
      : {};
  if (typeof manifest.name !== "string" || !Array.isArray(manifest.tasks)) {
    throw new Error(`tasks.json の形が正しくありません: ${path}`);
  }
  return manifest as ExternalManifest;
}

export type GradeExternalOptions = {
  name: string;
  tasksDir: string;
  workDir?: string;
  resultsDir?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export type GradeExternalOutput = {
  records: BenchRecord[];
  resultsPath: string;
  table: string;
};

export async function gradeExternal(
  options: GradeExternalOptions,
): Promise<GradeExternalOutput> {
  const workDir = options.workDir ?? join(defaultWorkRoot(), options.name);
  const resultsDir = options.resultsDir ?? "bench/results";
  const config = readConfig(options.env ?? process.env);
  const manifestPath = join(workDir, "tasks.json");
  const manifest = readManifest(manifestPath);
  const tasks = loadTasks(
    options.tasksDir,
    manifest.tasks.map((task) => task.id),
  );
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const records: BenchRecord[] = [];

  for (const entry of manifest.tasks) {
    const task = byId.get(entry.id);
    if (task === undefined) {
      throw new Error(`課題がありません: ${entry.id}`);
    }
    for (const [index, workspace] of entry.workspaces.entries()) {
      const started = Date.now();
      const grade = await gradeWorkspace(
        task,
        resolve(dirname(manifestPath), workspace),
        options.timeoutMs,
      );
      records.push({
        task: task.id,
        kind: task.kind,
        condition: options.name,
        rep: index + 1,
        pass: grade.pass,
        passed: grade.passed,
        failed: grade.failed,
        steps: 0,
        stop: "done",
        usage: { input: 0, cachedInput: 0, output: 0, reasoning: 0 },
        durationMs: Date.now() - started,
        model: config.model,
      });
    }
  }

  const resultsPath = writeResults(resultsDir, config.model, {
    model: config.model,
    baseUrl: config.baseUrl,
    createdAt: new Date().toISOString(),
    conditions: [options.name],
    reps: manifest.reps,
    results: records,
  });

  return {
    records,
    resultsPath,
    table: formatResultsTable(records, [options.name], config.model),
  };
}
