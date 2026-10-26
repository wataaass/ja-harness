import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type BenchRecord,
  formatProgress,
  formatResultsTable,
  writeResults,
} from "../src/bench/run.js";

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
    stop: "done",
    usage: { input: 10, cachedInput: 0, output: 5, reasoning: 0, cost: 0.0021 },
    durationMs: 41_400,
    model: "deepseek-v4.1-flash",
    ...overrides,
  };
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
});

describe("formatResultsTable", () => {
  it("最初の行にモデルを出す", () => {
    const table = formatResultsTable([], [], "deepseek-v4.1-flash");
    expect(table.split("\n")[0]).toBe("モデル: deepseek-v4.1-flash");
  });
});
