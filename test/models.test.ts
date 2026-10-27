import { describe, expect, it } from "vitest";
import { costPer1kJaChars, findModel, MODELS } from "../src/llm/models.js";

describe("MODELS", () => {
  it("8つのモデルと単価を持つ", () => {
    expect(MODELS).toHaveLength(8);
    const ids = MODELS.map((model) => model.id);
    expect(ids).toEqual([
      "deepseek-v4.1-flash",
      "deepseek-v4-pro",
      "mimo-v2.6-flash",
      "qwen3.8-flash",
      "glm-5.3-flash",
      "minimax-m3.1-flash",
      "kimi-k2.7-code",
      "claude-haiku-5-5",
    ]);
    const haiku = findModel("claude-haiku-5-5");
    expect(haiku?.prices).toEqual({
      input: 0.1,
      cachedInput: 0.01,
      cacheWrite: 0.125,
      output: 0.5,
    });
    for (const model of MODELS) {
      expect(model.efforts).toEqual(["low", "medium", "high"]);
      expect(model.defaultEffort).toBe("high");
    }
  });

  it("claude-haiku-5-5 に100k超の料金の段を持つ", () => {
    expect(findModel("claude-haiku-5-5")?.tier).toEqual({
      above: 100000,
      prices: {
        input: 0.5,
        cachedInput: 0.05,
        cacheWrite: 0.625,
        output: 2.5,
      },
    });
    expect(findModel("deepseek-v4.1-flash")?.tier).toBeUndefined();
  });

  it("findModel は知らない名前で undefined", () => {
    expect(findModel("deepseek-v4.1-flash")?.prices.input).toBe(0.15);
    expect(findModel("nope")).toBeUndefined();
  });

  it("日本語1,000字の料金は入力単価 × 0.7 / 1000", () => {
    const model = findModel("deepseek-v4.1-flash");
    expect(model).toBeDefined();
    if (model !== undefined) {
      expect(costPer1kJaChars(model)).toBeCloseTo(0.000105, 10);
    }
  });
});
