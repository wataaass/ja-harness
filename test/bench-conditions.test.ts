import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Complete, Tool } from "../src/agent/loop.js";
import { createCondition, isConditionName } from "../src/bench/conditions.js";
import { createEstimator } from "../src/context/tokens.js";
import type { Message, ToolSpec } from "../src/llm/types.js";

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

  it("モデルの価格を文脈管理に渡す", async () => {
    const parts = createCondition({
      name: "default",
      workspace,
      complete,
      contextWindow: 100000,
      estimate: createEstimator(),
      model: "deepseek-v4.1-flash",
    });
    const manager = parts.context?.manager;
    expect(manager).toBeDefined();
    if (manager === undefined) {
      return;
    }
    const big = `${"a".repeat(50000)}\n${"b".repeat(50000)}`;
    const list: Message[] = [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "1", name: "shell", arguments: "{}" }],
      },
      { role: "tool", toolCallId: "1", content: big },
      { role: "assistant", content: "done" },
    ];
    const specs: ToolSpec[] = [tool];
    for (let index = 0; index < 300; index += 1) {
      await manager.beforeStep(list, specs, undefined);
    }
    expect((list[3] as Extract<Message, { role: "tool" }>).content).toContain(
      "lines pruned",
    );
  });

  it("条件名を判定する", () => {
    expect(isConditionName("none")).toBe(true);
    expect(isConditionName("default")).toBe(true);
    expect(isConditionName("other")).toBe(false);
  });
});
