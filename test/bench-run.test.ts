import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Complete } from "../src/agent/loop.js";
import {
  type BenchRecord,
  formatProgress,
  formatResultsTable,
  runOne,
  writeResults,
} from "../src/bench/run.js";
import { loadTasks } from "../src/bench/tasks.js";

function record(overrides: Partial<BenchRecord> = {}): BenchRecord {
  return {
    task: "fix-csv-quote",
    kind: "fix",
    condition: "default",
    rep: 2,
    pass: true,
    passed: 3,
    failed: 0,
    steps: 4,
    turns: 1,
    stop: "done",
    usage: { input: 10, cachedInput: 0, output: 5, reasoning: 0, cost: 0.0021 },
    contextActions: { mask: 1, prune: 0, summary: 0 },
    durationMs: 41_400,
    model: "deepseek-v4.1-flash",
    ...overrides,
  };
}

function makeTask(root: string): void {
  const dir = join(root, "sample-add");
  mkdirSync(join(dir, "files"), { recursive: true });
  mkdirSync(join(dir, "grade"), { recursive: true });
  mkdirSync(join(dir, "solution"), { recursive: true });
  writeFileSync(
    join(dir, "task.json"),
    JSON.stringify({
      id: "sample-add",
      kind: "fix",
      prompt: "足し算に直してください。",
    }),
  );
  writeFileSync(join(dir, "files", "package.json"), '{"type":"module"}\n');
  writeFileSync(
    join(dir, "files", "math.js"),
    "export function add(a, b) {\n  return a - b;\n}\n",
  );
  writeFileSync(
    join(dir, "grade", "math.test.js"),
    'import assert from "node:assert";\nimport test from "node:test";\ntest("ok", () => {\n  assert.ok(true);\n});\n',
  );
  writeFileSync(
    join(dir, "solution", "math.js"),
    "export function add(a, b) {\n  return a + b;\n}\n",
  );
}

function makeMultiTask(root: string): void {
  const dir = join(root, "sample-add");
  mkdirSync(join(dir, "files"), { recursive: true });
  mkdirSync(join(dir, "grade"), { recursive: true });
  mkdirSync(join(dir, "solution"), { recursive: true });
  writeFileSync(
    join(dir, "task.json"),
    JSON.stringify({
      id: "sample-add",
      kind: "fix",
      turns: ["まず直してください。", "次に変えてください。"],
    }),
  );
  writeFileSync(join(dir, "files", "package.json"), '{"type":"module"}\n');
  writeFileSync(
    join(dir, "files", "math.js"),
    "export function add(a, b) {\n  return a - b;\n}\n",
  );
  writeFileSync(
    join(dir, "grade", "math.test.js"),
    'import assert from "node:assert";\nimport test from "node:test";\ntest("ok", () => {\n  assert.ok(true);\n});\n',
  );
  writeFileSync(
    join(dir, "solution", "math.js"),
    "export function add(a, b) {\n  return a + b;\n}\n",
  );
}

describe("writeResults", () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ja-harness-results-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("ファイル名と JSON にモデルを入れる", () => {
    const now = new Date("2026-10-26T17:00:00.000Z");
    const payload = {
      model: "deepseek-v4.1-flash",
      baseUrl: "https://example.test/v1",
      results: [],
    };

    const path = writeResults(dir, "deepseek-v4.1-flash", payload, now);

    expect(
      path.endsWith("2026-10-26T17-00-00-000Z-deepseek-v4.1-flash.json"),
    ).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(payload);
  });

  it("モデルの記号をファイル名に使える形にする", () => {
    const path = writeResults(
      dir,
      "openai/gpt-4o",
      { model: "openai/gpt-4o" },
      new Date("2026-10-26T17:00:00.000Z"),
    );

    expect(path.endsWith("2026-10-26T17-00-00-000Z-openai-gpt-4o.json")).toBe(
      true,
    );
  });
});

describe("formatProgress", () => {
  it("1行の進み具合を返す", () => {
    expect(formatProgress(12, 72, record())).toBe(
      "[12/72] fix-csv-quote default 2回目 合格 41s $0.0021",
    );
  });

  it("不合格と料金なしを出す", () => {
    expect(
      formatProgress(
        3,
        6,
        record({
          task: "sample-add",
          condition: "none",
          rep: 1,
          pass: false,
          durationMs: 2_400,
          usage: { input: 1, cachedInput: 0, output: 1, reasoning: 0 },
        }),
      ),
    ).toBe("[3/6] sample-add none 1回目 不合格 2s —");
  });

  it("実行失敗は理由の先頭60文字を出す", () => {
    const error =
      "429 Too Many Requests: abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN";
    expect(
      formatProgress(
        3,
        72,
        record({
          pass: false,
          stop: "error",
          steps: 0,
          durationMs: 2_400,
          usage: { input: 0, cachedInput: 0, output: 0, reasoning: 0 },
          error,
        }),
      ),
    ).toBe(
      `[3/72] fix-csv-quote default 2回目 実行失敗 2s ${error.slice(0, 60)}`,
    );
  });
});

describe("runOne", () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ja-harness-run-one-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("例外で終わっても error・steps・usage を残す", async () => {
    const tasksDir = join(dir, "tasks");
    const workRoot = join(dir, "work");
    makeTask(tasksDir);

    let calls = 0;
    const complete: Complete = async () => {
      calls += 1;
      if (calls === 1) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "call-1", name: "missing-tool", arguments: "{}" },
            ],
          },
          usage: {
            input: 10,
            cachedInput: 2,
            output: 3,
            reasoning: 1,
            cost: 0.0005,
          },
          finishReason: "tool_calls",
        };
      }
      throw new Error("429 Too Many Requests");
    };

    const task = loadTasks(tasksDir)[0];
    const result = await runOne({
      task,
      condition: "none",
      rep: 1,
      workRoot,
      config: {
        baseUrl: "https://example.test/v1",
        model: "test-model",
        contextWindow: 1000,
      },
      turnTimeoutMs: 10_000,
      complete,
    });

    expect(result.pass).toBe(true);
    expect(result.stop).toBe("error");
    expect(result.steps).toBe(1);
    expect(result.usage).toEqual({
      input: 10,
      cachedInput: 2,
      output: 3,
      reasoning: 1,
      cost: 0.0005,
    });
    expect(result.error).toContain("429 Too Many Requests");
  });

  it("文脈管理の action ごとの回数を記録する", async () => {
    const tasksDir = join(dir, "tasks");
    const workRoot = join(dir, "work");
    makeTask(tasksDir);

    let calls = 0;
    const complete: Complete = async () => {
      calls += 1;
      if (calls <= 2) {
        return {
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: `read-${calls}`,
                name: "read",
                arguments: JSON.stringify({ paths: ["math.js"] }),
              },
            ],
          },
          usage: { input: 10, cachedInput: 0, output: 3, reasoning: 0 },
          finishReason: "tool_calls",
        };
      }
      return {
        message: { role: "assistant", content: "done" },
        usage: { input: 10, cachedInput: 0, output: 3, reasoning: 0 },
        finishReason: "stop",
      };
    };

    const task = loadTasks(tasksDir)[0];
    const result = await runOne({
      task,
      condition: "default",
      rep: 1,
      workRoot,
      config: {
        baseUrl: "https://example.test/v1",
        model: "test-model",
        contextWindow: 100000,
      },
      context: { mode: "always", mask: { window: 0, minTokens: 0 } },
      turnTimeoutMs: 10_000,
      complete,
    });

    expect(result.contextActions).toEqual({ mask: 1, prune: 0, summary: 0 });
  });

  it("複数の turn を同じ会話で続けて実行する", async () => {
    const tasksDir = join(dir, "tasks");
    const workRoot = join(dir, "work");
    makeMultiTask(tasksDir);

    const seen: string[][] = [];
    const complete: Complete = async (messages) => {
      seen.push(
        messages
          .filter((message) => message.role === "user")
          .map((message) => message.content),
      );
      return {
        message: { role: "assistant", content: "done" },
        usage: { input: 10, cachedInput: 0, output: 3, reasoning: 0 },
        finishReason: "stop",
      };
    };

    const task = loadTasks(tasksDir)[0];
    const result = await runOne({
      task,
      condition: "none",
      rep: 1,
      workRoot,
      config: {
        baseUrl: "https://example.test/v1",
        model: "test-model",
        contextWindow: 1000,
      },
      turnTimeoutMs: 10_000,
      complete,
    });

    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual(["まず直してください。"]);
    expect(seen[1]).toEqual(["まず直してください。", "次に変えてください。"]);
    expect(result.turns).toBe(2);
    expect(result.steps).toBe(2);
    expect(result.usage.input).toBe(20);
    expect(result.usage.output).toBe(6);
    expect(result.stop).toBe("done");
  });
});

describe("formatResultsTable", () => {
  it("最初の行にモデルを出す", () => {
    const table = formatResultsTable([], [], "deepseek-v4.1-flash");
    expect(table.split("\n")[0]).toBe("モデル: deepseek-v4.1-flash");
  });

  it("実行失敗を除いた合格率と失敗の列を出す", () => {
    const records = [
      record(),
      record({
        rep: 3,
        pass: false,
        steps: 2,
        usage: {
          input: 10,
          cachedInput: 0,
          output: 5,
          reasoning: 0,
          cost: 0.004,
        },
      }),
      record({
        rep: 4,
        pass: false,
        steps: 0,
        stop: "error",
        usage: { input: 0, cachedInput: 0, output: 0, reasoning: 0 },
        error: "429 Too Many Requests",
      }),
    ];

    const table = formatResultsTable(records, ["default"], "test-model");

    expect(table).toMatch(
      /^default\s+1\/2\s+50%\s+\$0\.0030\s+3\.0\s+1\.0\s+1$/m,
    );
    expect(table).toMatch(/平均steps\s+平均mask\s+失敗/);
    expect(table).toContain("1/2（失敗1）");
  });

  it("条件別に mask の平均回数を出す", () => {
    const records = [
      record({ rep: 1, contextActions: { mask: 2, prune: 0, summary: 0 } }),
      record({ rep: 2, contextActions: { mask: 4, prune: 1, summary: 0 } }),
      record({
        rep: 3,
        stop: "error",
        steps: 0,
        contextActions: { mask: 99, prune: 0, summary: 0 },
        error: "429 Too Many Requests",
      }),
    ];

    const table = formatResultsTable(records, ["default"], "test-model");

    expect(table).toMatch(
      /^default\s+2\/2\s+100%\s+\$0\.0021\s+4\.0\s+3\.0\s+1$/m,
    );
  });
});
