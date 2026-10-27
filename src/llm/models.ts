export type ModelInfo = {
  id: string;
  label: string;
  prices: {
    input: number;
    cachedInput: number;
    cacheWrite?: number;
    output: number;
  };
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
): ModelInfo {
  const prices: ModelInfo["prices"] = { input, cachedInput, output };
  if (cacheWrite !== undefined) {
    prices.cacheWrite = cacheWrite;
  }
  return {
    id,
    label: id,
    prices,
    efforts: [...EFFORTS],
    defaultEffort: "high",
  };
}

export const MODELS: ModelInfo[] = [
  model("deepseek-v4.1-flash", 0.15, 0.003, 0.6),
  model("deepseek-v4-pro", 0.66, 0.022, 1.98),
  model("mimo-v2.6-flash", 0.14, 0.0028, 0.28),
  model("qwen3.8-flash", 0.15, 0.016, 0.47),
  model("glm-5.3-flash", 0.15, 0.03, 0.5),
  model("minimax-m3.1-flash", 0.15, 0.015, 0.6),
  model("kimi-k2.7-code", 0.95, 0.19, 4),
  model("claude-haiku-5-5", 0.1, 0.01, 0.5, 0.125),
];

export function findModel(id: string): ModelInfo | undefined {
  return MODELS.find((candidate) => candidate.id === id);
}

export function costPer1kJaChars(model: ModelInfo): number {
  return (model.prices.input * 0.7) / 1000;
}
