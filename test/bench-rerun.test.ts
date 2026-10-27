import { describe, expect, it } from "vitest";
import {
  executionFailures,
  parseResultsJson,
  replaceRecords,
} from "../src/bench/rerun.js";
import type { BenchRecord } from "../src/bench/run.js";

function record(overrides: Partial<BenchRecord> = {}): BenchRecord {
  return {
    task: "fix-csv-quote",
    kind: "fix",
    condition: "default",
    rep: 1,
    pass: false,
    passed: 0,
    failed: 3,
    steps: 0,
    stop: "error",
    usage: { input: 0, cachedInput: 0, output: 0, reasoning: 0 },
    durationMs: 2_400,
    model: "test-model",
    error: "429 Too Many Requests",
    ...overrides,
  };
}

describe("parseResultsJson", () => {
  it("結果の JSON を読む", () => {
    const text = JSON.stringify({
      model: "test-model",
      baseUrl: "https://example.test/v1",
      createdAt: "2026-10-27T00:00:00.000Z",
      conditions: ["none", "default"],
      reps: 3,
      results: [record()],
    });

    const parsed = parseResultsJson(text);

    expect(parsed.model).toBe("test-model");
    expect(parsed.baseUrl).toBe("https://example.test/v1");
    expect(parsed.conditions).toEqual(["none", "default"]);
    expect(parsed.reps).toBe(3);
    expect(parsed.results).toHaveLength(1);
  });

  it("条件と回数がなくても記録から補う", () => {
    const parsed = parseResultsJson(
      JSON.stringify({
        model: "test-model",
        results: [record({ condition: "none", rep: 2 })],
      }),
    );

    expect(parsed.conditions).toEqual(["none"]);
    expect(parsed.reps).toBe(2);
  });

  it("壊れた JSON はエラー", () => {
    expect(() => parseResultsJson("{")).toThrow("壊れています");
  });

  it("model のない JSON はエラー", () => {
    expect(() => parseResultsJson(JSON.stringify({ results: [] }))).toThrow(
      "model",
    );
  });
});

describe("executionFailures", () => {
  it("stop が error で steps が 0 の記録だけを選ぶ", () => {
    const records = [
      record({ rep: 1 }),
      record({ rep: 2, steps: 1 }),
      record({ rep: 3, stop: "done" }),
    ];

    expect(executionFailures(records).map((item) => item.rep)).toEqual([1]);
  });
});

describe("replaceRecords", () => {
  it("同じ task・condition・rep の記録だけを差し替える", () => {
    const first = record({ task: "a", condition: "none", rep: 1 });
    const second = record({ task: "a", condition: "default", rep: 1 });
    const third = record({ task: "a", condition: "default", rep: 2 });
    const replacement = record({
      task: "a",
      condition: "default",
      rep: 2,
      pass: true,
      stop: "done",
      steps: 3,
    });

    const replaced = replaceRecords([first, second, third], [replacement]);

    expect(replaced).toHaveLength(3);
    expect(replaced[0]).toBe(first);
    expect(replaced[1]).toBe(second);
    expect(replaced[2]).toBe(replacement);
  });

  it("元にない記録はエラー", () => {
    expect(() =>
      replaceRecords(
        [record({ task: "a", condition: "none", rep: 1 })],
        [record({ task: "b", condition: "none", rep: 1 })],
      ),
    ).toThrow("置き換える記録がありません");
  });
});
