import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeCost,
  createSimModel,
  mergeContext,
  prefixTokens,
  requestTokens,
  runSimulation,
  snapshotRequest,
} from "../src/bench/sim/run.js";
import { makeScenarios, type Scenario } from "../src/bench/sim/scenarios.js";
import { DEFAULT_CONTEXT } from "../src/context/manager.js";
import { maskStub } from "../src/context/mask.js";
import { createEstimator } from "../src/context/tokens.js";
import { findModel } from "../src/llm/models.js";
import type { Message, ToolSpec } from "../src/llm/types.js";

const estimate = createEstimator();

function allSteps(scenario: Scenario) {
  return scenario.turns.flatMap((turn) => turn.steps);
}

describe("makeScenarios", () => {
  it("毎回同じ台本を返す", () => {
    expect(makeScenarios()).toEqual(makeScenarios());
  });

  it("label が重ならず、needs は前の label だけを指す", () => {
    for (const scenario of makeScenarios()) {
      const seen = new Set<string>();
      for (const step of allSteps(scenario)) {
        for (const need of step.needs ?? []) {
          expect(seen.has(need)).toBe(true);
        }
        for (const call of step.calls) {
          expect(seen.has(call.label)).toBe(false);
          seen.add(call.label);
        }
      }
    }
  });

  it("4つの台本の形が決まっている", () => {
    const scenarios = makeScenarios();
    const short = scenarios.find((scenario) => scenario.id === "short");
    const medium = scenarios.find((scenario) => scenario.id === "medium");
    const long = scenarios.find((scenario) => scenario.id === "long");
    const readHeavy = scenarios.find(
      (scenario) => scenario.id === "read-heavy",
    );
    expect(short).toBeDefined();
    expect(medium).toBeDefined();
    expect(long).toBeDefined();
    expect(readHeavy).toBeDefined();
    if (
      short === undefined ||
      medium === undefined ||
      long === undefined ||
      readHeavy === undefined
    ) {
      return;
    }

    const calls = (scenario: Scenario) =>
      allSteps(scenario).flatMap((step) => step.calls);
    const shortCalls = calls(short);
    expect(shortCalls).toHaveLength(6);
    expect(shortCalls.filter((call) => call.tool === "read")).toHaveLength(3);
    expect(shortCalls.filter((call) => call.tool === "grep")).toHaveLength(1);
    expect(shortCalls.filter((call) => call.tool === "edit")).toHaveLength(1);
    expect(shortCalls.filter((call) => call.tool === "shell")).toHaveLength(1);

    expect(medium.turns).toHaveLength(2);
    expect(medium.turns[1]?.idleSeconds).toBe(600);
    expect(calls(medium)).toHaveLength(20);

    expect(long.turns.map((turn) => turn.idleSeconds)).toEqual([
      0, 120, 1800, 60,
    ]);
    expect(calls(long).length).toBeGreaterThanOrEqual(68);
    expect(calls(long).length).toBeLessThanOrEqual(74);
    const longTokens = calls(long).reduce(
      (sum, call) => sum + call.resultTokens,
      0,
    );
    expect(longTokens).toBeGreaterThan(200000);

    expect(readHeavy.turns).toHaveLength(1);
    expect(calls(readHeavy)).toHaveLength(40);
    const readish = calls(readHeavy).filter(
      (call) => call.tool === "read" || call.tool === "grep",
    );
    expect(readish.length).toBeGreaterThanOrEqual(36);

    for (const scenario of scenarios) {
      for (const step of allSteps(scenario)) {
        for (const call of step.calls) {
          expect(call.resultTokens).toBeGreaterThanOrEqual(50);
        }
      }
    }
  });
});

describe("キャッシュの模型", () => {
  const tools: ToolSpec[] = [];

  it("末尾に足すだけなら先頭が当たる", () => {
    const base: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
    ];
    const previous = snapshotRequest(base, tools, estimate, 0);
    const next = snapshotRequest(
      [
        ...base,
        { role: "assistant", content: "a" },
        { role: "user", content: "u2" },
      ],
      tools,
      estimate,
      1000,
    );
    expect(prefixTokens(previous, next, 1000, 3600)).toBe(
      requestTokens(previous),
    );
  });

  it("途中を書き換えるとそこから後ろが当たらない", () => {
    const previous = snapshotRequest(
      [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
        { role: "assistant", content: "a" },
      ],
      tools,
      estimate,
      0,
    );
    const next = snapshotRequest(
      [
        { role: "system", content: "s" },
        { role: "user", content: "changed" },
        { role: "assistant", content: "a" },
      ],
      tools,
      estimate,
      1000,
    );
    const expected =
      (previous.parts[0]?.tokens ?? 0) + (previous.parts[1]?.tokens ?? 0);
    expect(prefixTokens(previous, next, 1000, 3600)).toBe(expected);
  });

  it("TTL を過ぎると当たらない", () => {
    const messages: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
    ];
    const previous = snapshotRequest(messages, tools, estimate, 0);
    const next = snapshotRequest(messages, tools, estimate, 4_000_000);
    expect(prefixTokens(previous, next, 4_000_000, 3600)).toBe(0);
    expect(prefixTokens(previous, next, 3_600_000, 3600)).toBe(
      requestTokens(previous),
    );
  });
});

describe("context の上書き", () => {
  it("mask の片方だけを変えても他の既定は残る", () => {
    const merged = mergeContext({ mask: { margin: 2 } });

    expect(merged.mask).toEqual({ ...DEFAULT_CONTEXT.mask, margin: 2 });
    expect(merged.prune).toBeUndefined();
  });

  it("prune と mask を同時に深く重ねられる", () => {
    const merged = mergeContext({
      prune: { maxTokens: 1234 },
      mask: { window: 2, maxCallsAhead: 10 },
    });

    expect(merged.prune).toEqual({
      ...DEFAULT_CONTEXT.prune,
      maxTokens: 1234,
    });
    expect(merged.mask).toEqual({
      ...DEFAULT_CONTEXT.mask,
      window: 2,
      maxCallsAhead: 10,
    });
  });
});

describe("偽のモデル", () => {
  it("needs の結果が消えていたら読み直しを1回挟む", async () => {
    const scenario: Scenario = {
      id: "needs",
      turns: [
        {
          idleSeconds: 0,
          user: "u",
          steps: [
            {
              calls: [
                {
                  label: "a",
                  tool: "read",
                  args: { paths: ["a.ts"] },
                  resultTokens: 50,
                },
              ],
              outputTokens: 10,
              reasoningTokens: 0,
            },
            {
              calls: [
                {
                  label: "b",
                  tool: "read",
                  args: { paths: ["b.ts"] },
                  resultTokens: 50,
                },
              ],
              outputTokens: 10,
              reasoningTokens: 0,
              needs: ["a"],
            },
            { calls: [], outputTokens: 10, reasoningTokens: 0 },
          ],
        },
      ],
    };
    const info = findModel("deepseek-v4.1-flash");
    expect(info).toBeDefined();
    if (info === undefined) {
      return;
    }
    const model = createSimModel({
      scenario,
      estimate,
      queue: new Map(),
      info,
    });
    model.startTurn(0);
    const messages: Message[] = [{ role: "user", content: "u" }];

    const first = await model.complete(messages, []);
    expect(first.message.toolCalls?.[0]?.id).toBe("a");
    messages.push(first.message);
    messages.push({
      role: "tool",
      toolCallId: "a",
      content: maskStub("read", JSON.stringify({ paths: ["a.ts"] }), 50),
    });

    const second = await model.complete(messages, []);
    expect(second.message.toolCalls).toHaveLength(1);
    expect(second.message.toolCalls?.[0]?.name).toBe("read");
    expect(second.message.toolCalls?.[0]?.arguments).toBe(
      JSON.stringify({ paths: ["a.ts"] }),
    );
    expect(model.stats.rereads).toBe(1);

    messages.push(second.message);
    messages.push({
      role: "tool",
      toolCallId: "reread-a",
      content: "<<a>> read again",
    });
    const third = await model.complete(messages, []);
    expect(third.message.toolCalls?.[0]?.id).toBe("b");
  });
});

describe("料金の計算", () => {
  it("cacheWrite と tier を使う", () => {
    const info = findModel("claude-haiku-5-5");
    expect(info).toBeDefined();
    if (info === undefined) {
      return;
    }

    const low = computeCost({
      prices: info.prices,
      tier: info.tier,
      input: 1000,
      cachedInput: 400,
      output: 100,
      reasoning: 50,
    });
    expect(low).toBeCloseTo(0.000154, 12);

    const high = computeCost({
      prices: info.prices,
      tier: info.tier,
      input: 200000,
      cachedInput: 50000,
      output: 100,
      reasoning: 50,
    });
    expect(high).toBeCloseTo(0.096625, 12);
  });
});

describe("台本を none で回す", () => {
  let resultsDir = "";

  afterEach(() => {
    if (resultsDir !== "") {
      rmSync(resultsDir, { recursive: true, force: true });
    }
  });

  it("short は道具6回で往復7回", async () => {
    resultsDir = mkdtempSync(join(tmpdir(), "ja-harness-sim-test-"));
    const output = await runSimulation({
      models: ["deepseek-v4.1-flash"],
      conditions: ["none"],
      scenarios: ["short"],
      resultsDir,
      now: new Date(0),
      onProgress: () => {},
    });
    const record = output.records[0];
    expect(record).toBeDefined();
    if (record === undefined) {
      return;
    }
    expect(record.toolCalls).toBe(6);
    expect(record.steps).toBe(7);
    expect(record.rereads).toBe(0);
    expect(record.summaries).toBe(0);
    expect(record.cost).toBeGreaterThan(0);
  });
});
