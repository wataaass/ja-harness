export type ModelPrices = {
  input: number;
  cachedInput: number;
  cacheWrite?: number;
  output: number;
};

export type ModelInfo = {
  id: string;
  label: string;
  prices: ModelPrices;
  tier?: { above: number; prices: ModelPrices };
  efforts: string[];
  defaultEffort: string;
};

const EFFORTS = ["low", "medium", "high"];

function model(
  id: string,
  input: number,
  cachedInput: number,
  output: number,
  cacheWrite?: number,
  tier?: ModelInfo["tier"],
): ModelInfo {
  const prices: ModelInfo["prices"] = { input, cachedInput, output };
  if (cacheWrite !== undefined) {
    prices.cacheWrite = cacheWrite;
  }
  const info: ModelInfo = {
    id,
    label: id,
    prices,
    efforts: [...EFFORTS],
    defaultEffort: "high",
  };
  if (tier !== undefined) {
    info.tier = tier;
  }
  return info;
}

export const MODELS: ModelInfo[] = [
  model("deepseek-v4.1-flash", 0.15, 0.003, 0.6),
  model("deepseek-v4-pro", 0.66, 0.022, 1.98),
  model("mimo-v2.6-flash", 0.14, 0.0028, 0.28),
  model("qwen3.8-flash", 0.15, 0.016, 0.47),
  model("glm-5.3-flash", 0.15, 0.03, 0.5),
  model("minimax-m3.1-flash", 0.15, 0.015, 0.6),
  model("kimi-k2.7-code", 0.95, 0.19, 4),
  model("claude-haiku-5-5", 0.1, 0.01, 0.5, 0.125, {
    above: 100000,
    prices: {
      input: 0.5,
      cachedInput: 0.05,
      cacheWrite: 0.625,
      output: 2.5,
    },
  }),
];

export function findModel(id: string): ModelInfo | undefined {
  return MODELS.find((candidate) => candidate.id === id);
}
