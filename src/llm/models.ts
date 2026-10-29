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
  contextWindow?: number;
  priced?: boolean;
};

const EFFORTS = ["low", "medium", "high"];
const DEFAULT_CONTEXT_WINDOW = 1048576;

function model(
  id: string,
  input: number,
  cachedInput: number,
  output: number,
  cacheWrite?: number,
  tier?: ModelInfo["tier"],
  contextWindow = DEFAULT_CONTEXT_WINDOW,
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
    contextWindow,
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
  model("kimi-k2.7-code", 0.95, 0.19, 4, undefined, undefined, 262144),
  model("claude-haiku-5-5", 0.1, 0.01, 0.5, 0.125, {
    above: 100000,
    prices: {
      input: 0.5,
      cachedInput: 0.05,
      cacheWrite: 0.625,
      output: 2.5,
    },
  }),
  model("kimi-k3", 3, 0.3, 15),
  model("kimi-k3.1-pro", 2, 0.2, 10),
  model("glm-5.3", 1.4, 0.26, 4.4),
  model("glm-5.2", 1.4, 0.26, 4.4),
  model("minimax-m3", 0.3, 0.06, 1.2),
  model("qwen3.8-max", 2, 0.25, 6, 2.5),
  model("qwen3.7-plus", 0.4, 0.04, 1.6, 0.5),
];

let loadedModels: ModelInfo[] = [];

export function setLoadedModels(models: ModelInfo[]): void {
  loadedModels = models;
}

export function listModels(): ModelInfo[] {
  return loadedModels.length > 0 ? loadedModels : MODELS;
}

export function findModel(id: string): ModelInfo | undefined {
  return (
    loadedModels.find((candidate) => candidate.id === id) ??
    MODELS.find((candidate) => candidate.id === id)
  );
}

export function modelPrices(id: string): ModelPrices | undefined {
  const info = findModel(id);
  if (info === undefined || info.priced === false) {
    return undefined;
  }
  return info.prices;
}
