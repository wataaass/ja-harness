import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Complete, Tool } from "../src/agent/loop.js";
import { createCondition, isConditionName } from "../src/bench/conditions.js";
import { createEstimator } from "../src/context/tokens.js";

const complete: Complete = async () => {
  throw new Error("API は呼ばない");
};

const tool: Tool = {
  name: "shell",
  description: "run",
  parameters: {},
  maxResultTokens: 100,
  execute: async () => "",
};

describe("createCondition", () => {
  let workspace = "";

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "ja-harness-condition-"));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  function create(name: "none" | "input-only" | "default") {
    return createCondition({
      name,
      workspace,
      complete,
      contextWindow: 100000,
      estimate: createEstimator(),
    });
  }

  it("none は何も渡さない", () => {
    const parts = create("none");
    expect(parts.limitResult).toBeUndefined();
    expect(parts.context).toBeUndefined();
  });

  it("input-only は limitResult だけ渡す", () => {
    const parts = create("input-only");
    expect(parts.limitResult).toBeTypeOf("function");
    expect(parts.context).toBeUndefined();
  });

  it("input-only は長い出力を .ja-harness/out に保存する", () => {
    const parts = create("input-only");
    const result = parts.limitResult?.("a".repeat(5000), tool) ?? "";

    expect(result).toContain(".ja-harness/out/");
    expect(readdirSync(join(workspace, ".ja-harness", "out"))).toHaveLength(1);
  });

  it("default は limitResult と context を渡す", () => {
    const parts = create("default");
    expect(parts.limitResult).toBeTypeOf("function");
    expect(parts.context?.overflowRetries).toBe(1);
    expect(parts.context?.manager).toBeDefined();
  });

  it("条件名を判定する", () => {
    expect(isConditionName("none")).toBe(true);
    expect(isConditionName("default")).toBe(true);
    expect(isConditionName("other")).toBe(false);
  });
});
