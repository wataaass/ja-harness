import { describe, expect, it } from "vitest";
import {
  findModel,
  listModels,
  MODELS,
  modelPrices,
  setLoadedModels,
} from "../src/llm/models.js";

describe("MODELS", () => {
  it("15のモデルと単価を持つ", () => {
    expect(MODELS).toHaveLength(15);
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
      "kimi-k3",
      "kimi-k3.1-pro",
      "glm-5.3",
      "glm-5.2",
      "minimax-m3",
      "qwen3.8-max",
      "qwen3.7-plus",
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
      if (model.id !== "kimi-k2.7-code") {
        expect(model.contextWindow).toBe(1048576);
      }
    }
    expect(findModel("kimi-k2.7-code")?.contextWindow).toBe(262144);
  });

  it("OpenCode Go のモデルを足した", () => {
    expect(findModel("kimi-k3")?.prices).toEqual({
      input: 3,
      cachedInput: 0.3,
      output: 15,
    });
    expect(findModel("qwen3.8-max")?.prices).toEqual({
      input: 2,
      cachedInput: 0.25,
      cacheWrite: 2.5,
      output: 6,
    });
    expect(findModel("glm-5.2")?.prices).toEqual({
      input: 1.4,
      cachedInput: 0.26,
      output: 4.4,
    });
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

  it("読み込んだ表を組み込みより先に探す", () => {
    setLoadedModels([
      {
        id: "deepseek-v4.1-flash",
        label: "loaded",
        prices: { input: 1, cachedInput: 1, output: 1 },
        efforts: ["low"],
        defaultEffort: "low",
      },
      {
        id: "extra",
        label: "extra",
        prices: { input: 2, cachedInput: 2, output: 2 },
        efforts: ["low"],
        defaultEffort: "low",
      },
    ]);
    try {
      expect(findModel("deepseek-v4.1-flash")?.label).toBe("loaded");
      expect(findModel("extra")?.label).toBe("extra");
      expect(findModel("kimi-k3")?.label).toBe("kimi-k3");
      expect(listModels().map((model) => model.id)).toEqual([
        "deepseek-v4.1-flash",
        "extra",
      ]);
    } finally {
      setLoadedModels([]);
    }
  });

  it("価格のないモデルは prices を渡さない", () => {
    setLoadedModels([
      {
        id: "free",
        label: "free",
        prices: { input: 0, cachedInput: 0, output: 0 },
        efforts: ["low"],
        defaultEffort: "low",
        priced: false,
      },
    ]);
    try {
      expect(modelPrices("free")).toBeUndefined();
      expect(modelPrices("deepseek-v4.1-flash")?.input).toBe(0.15);
    } finally {
      setLoadedModels([]);
    }
  });
});
