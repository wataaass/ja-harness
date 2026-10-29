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
import {
  type Call,
  makeScenarios,
  type Scenario,
} from "../src/bench/sim/scenarios.js";
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

describe("needs の確率", () => {
  type Position = {
    call: Call;
    turn: number;
    step: number;
    order: number;
  };

  const callPaths = (call: Call): string[] => {
    if (call.tool === "read") {
      const paths = call.args.paths;
      if (Array.isArray(paths)) {
        return paths.filter((path): path is string => typeof path === "string");
      }
    }
    return typeof call.args.path === "string" ? [call.args.path] : [];
  };

  function positions(scenario: Scenario): Position[] {
    const items: Position[] = [];
    scenario.turns.forEach((turn, turnIndex) => {
      turn.steps.forEach((step, stepIndex) => {
        for (const call of step.calls) {
          items.push({
            call,
            turn: turnIndex,
            step: stepIndex,
            order: items.length,
          });
        }
      });
    });
    return items;
  }

  function isStale(candidate: Position, items: Position[]): boolean {
    if (candidate.call.tool !== "read") {
      return false;
    }
    const paths = callPaths(candidate.call);
    return items.some(
      (other) =>
        other.order > candidate.order &&
        (other.call.tool === "edit" || other.call.tool === "write") &&
        callPaths(other.call).some((path) => paths.includes(path)),
    );
  }

  function isEligible(candidate: Position, items: Position[]): boolean {
    return (
      candidate.call.tool !== "edit" &&
      candidate.call.tool !== "write" &&
      !isStale(candidate, items)
    );
  }

  it("種が同じなら毎回同じ", () => {
    expect(makeScenarios({ prevNeed: 0.3 })).toEqual(
      makeScenarios({ prevNeed: 0.3 }),
    );
  });

  it("同じ turn の結果は後ろの1つの step だけに入る", () => {
    for (const scenario of makeScenarios({ prevNeed: 0 })) {
      const items = positions(scenario);
      for (const item of items) {
        if (!isEligible(item, items)) {
          continue;
        }
        const steps = scenario.turns[item.turn]?.steps ?? [];
        const targets = steps
          .map((step, index) => ({ step, index }))
          .filter(
            (target) =>
              target.index > item.step &&
              (target.step.needs ?? []).includes(item.call.label),
          );
        expect(targets.length).toBeLessThanOrEqual(1);
      }
      for (
        let turnIndex = 0;
        turnIndex < scenario.turns.length;
        turnIndex += 1
      ) {
        const steps = scenario.turns[turnIndex]?.steps ?? [];
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
          for (const need of steps[stepIndex]?.needs ?? []) {
            const source = items.find((item) => item.call.label === need);
            expect(source?.turn).toBe(turnIndex);
            expect(source?.step).toBeLessThan(stepIndex);
            expect(isEligible(source as Position, items)).toBe(true);
          }
        }
      }
    }
  });

  it("同じ turn は 0.8、前の turn は prevNeed の割合で選ぶ", () => {
    const rate = (prevNeed: number) => {
      let same = 0;
      let sameNeeded = 0;
      let previous = 0;
      let previousNeeded = 0;
      for (const scenario of makeScenarios({ prevNeed })) {
        const items = positions(scenario);
        for (const item of items) {
          if (!isEligible(item, items)) {
            continue;
          }
          const steps = scenario.turns[item.turn]?.steps ?? [];
          if (item.step + 1 < steps.length) {
            same += 1;
            if (
              steps
                .slice(item.step + 1)
                .some((step) => (step.needs ?? []).includes(item.call.label))
            ) {
              sameNeeded += 1;
            }
          }
          const next = scenario.turns[item.turn + 1];
          if (next !== undefined) {
            previous += 1;
            if ((next.steps[0]?.needs ?? []).includes(item.call.label)) {
              previousNeeded += 1;
            }
          }
        }
      }
      return {
        same: sameNeeded / same,
        previous: previousNeeded / previous,
      };
    };

    const fixed = rate(0.3);
    expect(fixed.same).toBeGreaterThan(0.7);
    expect(fixed.same).toBeLessThan(0.9);
    expect(fixed.previous).toBeGreaterThan(0.2);
    expect(fixed.previous).toBeLessThan(0.4);
    expect(rate(0.3)).toEqual(fixed);
    expect(rate(0).previous).toBe(0);
    expect(rate(1).previous).toBe(1);
  });

  it("前の turn の結果は次の turn の最初の step に入る", () => {
    const none = makeScenarios({ prevNeed: 0 });
    const all = makeScenarios({ prevNeed: 1 });
    for (let index = 0; index < none.length; index += 1) {
      const withoutPrevious = none[index] as Scenario;
      const withPrevious = all[index] as Scenario;
      const items = positions(withPrevious);
      for (let turn = 1; turn < withPrevious.turns.length; turn += 1) {
        expect(withoutPrevious.turns[turn]?.steps[0]?.needs).toBeUndefined();
        const expected = items
          .filter((item) => item.turn === turn - 1 && isEligible(item, items))
          .map((item) => item.call.label);
        const needs = withPrevious.turns[turn]?.steps[0]?.needs ?? [];
        expect(new Set(needs)).toEqual(new Set(expected));
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
