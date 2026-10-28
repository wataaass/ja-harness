import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type ModelInfo, setLoadedModels } from "./models.js";

export const MODELS_URL = "https://models.dev/api.json";
export const DEFAULT_PROVIDER = "opencode-go";
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 10_000;

const EFFORTS = ["low", "medium", "high"];

export type CatalogCost = {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
};

export type CatalogModel = {
  id?: string;
  name?: string;
  tool_call?: boolean;
  reasoning?: boolean;
  cost?: CatalogCost;
  limit?: { context?: number; output?: number };
};

export type CatalogProvider = {
  id?: string;
  name?: string;
  api?: string;
  env?: string[];
  models?: Record<string, CatalogModel>;
};

export type CatalogSnapshot = {
  fetchedAt: number;
  provider: string;
  data: CatalogProvider;
};

export type ProviderInfo = {
  provider: string;
  api?: string;
  env?: string[];
};

let activeInfo: ProviderInfo | undefined;

export function resolveProvider(
  env: Record<string, string | undefined>,
  configured?: string,
): string {
  const value = env.JA_HARNESS_PROVIDER;
  if (value !== undefined && value !== "") {
    return value;
  }
  if (configured !== undefined && configured !== "") {
    return configured;
  }
  return DEFAULT_PROVIDER;
}

export function cachePath(home: string): string {
  return join(home, ".ja-harness", "cache", "models.json");
}

export function isFresh(fetchedAt: number, now: number): boolean {
  return now - fetchedAt < CACHE_TTL_MS;
}

export function toModelInfo(
  raw: CatalogModel,
  fallbackId?: string,
): ModelInfo | undefined {
  if (raw.tool_call === false) {
    return undefined;
  }
  const id = raw.id ?? fallbackId;
  if (id === undefined || id === "") {
    return undefined;
  }
  const cost = raw.cost;
  const hasCost =
    cost !== undefined &&
    typeof cost.input === "number" &&
    typeof cost.output === "number";
  const input = typeof cost?.input === "number" ? cost.input : 0;
  const output = typeof cost?.output === "number" ? cost.output : 0;
  const cachedInput =
    typeof cost?.cache_read === "number" ? cost.cache_read : input;
  const prices: ModelInfo["prices"] = { input, cachedInput, output };
  if (typeof cost?.cache_write === "number" && cost.cache_write > input) {
    prices.cacheWrite = cost.cache_write;
  }
  const info: ModelInfo = {
    id,
    label: raw.name ?? id,
    prices,
    efforts: [...EFFORTS],
    defaultEffort: "high",
  };
  const context = raw.limit?.context;
  if (typeof context === "number" && context > 0) {
    info.contextWindow = context;
  }
  if (!hasCost) {
    info.priced = false;
  }
  return info;
}

export function providerModels(provider: CatalogProvider): ModelInfo[] {
  const models: ModelInfo[] = [];
  for (const [key, raw] of Object.entries(provider.models ?? {})) {
    const info = toModelInfo(raw, key);
    if (info !== undefined) {
      models.push(info);
    }
  }
  return models;
}

export function applyProvider(
  provider: string,
  data: CatalogProvider,
): ModelInfo[] {
  const models = providerModels(data);
  setLoadedModels(models);
  const info: ProviderInfo = { provider };
  if (data.api !== undefined) {
    info.api = data.api;
  }
  if (data.env !== undefined) {
    info.env = data.env;
  }
  activeInfo = info;
  return models;
}

export function providerInfo(provider?: string): ProviderInfo | undefined {
  if (provider !== undefined && activeInfo?.provider !== provider) {
    return undefined;
  }
  return activeInfo;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parseSnapshot(value: unknown): CatalogSnapshot | undefined {
  const record = asRecord(value);
  if (
    typeof record.fetchedAt !== "number" ||
    typeof record.provider !== "string"
  ) {
    return undefined;
  }
  return {
    fetchedAt: record.fetchedAt,
    provider: record.provider,
    data: asRecord(record.data) as CatalogProvider,
  };
}

export function loadCatalogFromCache(o: {
  home: string;
  provider: string;
  now?: number;
}): { data: CatalogProvider; fresh: boolean } | undefined {
  const now = o.now ?? Date.now();
  let text: string;
  try {
    text = readFileSync(cachePath(o.home), "utf8");
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  const snapshot = parseSnapshot(parsed);
  if (snapshot === undefined || snapshot.provider !== o.provider) {
    return undefined;
  }
  applyProvider(snapshot.provider, snapshot.data);
  return {
    data: snapshot.data,
    fresh: isFresh(snapshot.fetchedAt, now),
  };
}

function saveSnapshot(path: string, snapshot: CatalogSnapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot)}\n`, "utf8");
}

function providerFromCatalog(
  value: unknown,
  provider: string,
): CatalogProvider | undefined {
  const record = asRecord(value);
  const raw = asRecord(record[provider]);
  if (raw.models === undefined) {
    return undefined;
  }
  return raw as CatalogProvider;
}

export async function refreshCatalog(o: {
  home: string;
  provider: string;
  fetch?: typeof fetch;
  now?: number;
  url?: string;
  onWarning?: (line: string) => void;
}): Promise<boolean> {
  const now = o.now ?? Date.now();
  const cached = loadCatalogFromCache({
    home: o.home,
    provider: o.provider,
    now,
  });
  if (cached?.fresh === true) {
    return true;
  }

  const doFetch = o.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  timer.unref?.();
  try {
    const response = await doFetch(o.url ?? MODELS_URL, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    const data = providerFromCatalog(json, o.provider);
    if (data === undefined) {
      throw new Error(`料金表に ${o.provider} がありません`);
    }
    saveSnapshot(cachePath(o.home), {
      fetchedAt: now,
      provider: o.provider,
      data,
    });
    applyProvider(o.provider, data);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const warning = `料金表を取れませんでした（組み込みの表を使います）: ${message}`;
    if (o.onWarning !== undefined) {
      o.onWarning(warning);
    } else {
      process.stderr.write(`${warning}\n`);
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function startCatalogRefresh(o: {
  home: string;
  provider: string;
  fetch?: typeof fetch;
  now?: number;
  url?: string;
  onWarning?: (line: string) => void;
}): void {
  void refreshCatalog(o);
}

export function clearCatalog(): void {
  activeInfo = undefined;
  setLoadedModels([]);
}
