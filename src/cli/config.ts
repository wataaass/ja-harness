import { findModel } from "../llm/models.js";

export type CliConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindow: number;
  provider: string;
};

export type ConfigCatalog = {
  api?: string;
  env?: string[];
};

export type ReadConfigOptions = {
  provider?: string;
  model?: string;
  catalog?: ConfigCatalog;
};

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
const DEFAULT_MODEL = "deepseek-v4.1-flash";
const DEFAULT_CONTEXT_WINDOW = 1048576;
const DEFAULT_PROVIDER = "opencode-go";

function catalogApiKey(
  env: Record<string, string | undefined>,
  names: string[] | undefined,
): string | undefined {
  for (const name of names ?? []) {
    const value = env[name];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return undefined;
}

export function useOpencodeSession(provider: string): boolean {
  return provider === "opencode-go" || provider === "opencode";
}

export function readConfig(
  env: Record<string, string | undefined>,
  options: ReadConfigOptions = {},
): CliConfig {
  const provider =
    env.JA_HARNESS_PROVIDER ?? options.provider ?? DEFAULT_PROVIDER;

  let baseUrl = env.JA_HARNESS_BASE_URL;
  if (baseUrl === undefined || baseUrl === "") {
    if (provider === DEFAULT_PROVIDER) {
      baseUrl = DEFAULT_BASE_URL;
    } else if (options.catalog?.api !== undefined) {
      baseUrl = options.catalog.api;
    } else {
      throw new Error(
        `${provider} の API の URL が分かりません。JA_HARNESS_BASE_URL を設定してください`,
      );
    }
  }
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  const model = env.JA_HARNESS_MODEL ?? options.model ?? DEFAULT_MODEL;
  const apiKey =
    env.JA_HARNESS_API_KEY ??
    catalogApiKey(env, options.catalog?.env) ??
    env.OPENCODE_API_KEY;

  const rawContextWindow = env.JA_HARNESS_CONTEXT_WINDOW;
  const parsedContextWindow =
    rawContextWindow === undefined ? Number.NaN : Number(rawContextWindow);
  const contextWindow =
    Number.isInteger(parsedContextWindow) && parsedContextWindow > 0
      ? parsedContextWindow
      : (findModel(model)?.contextWindow ?? DEFAULT_CONTEXT_WINDOW);

  const config: CliConfig = {
    baseUrl: normalizedBaseUrl,
    model,
    contextWindow,
    provider,
  };
  if (apiKey !== undefined) {
    config.apiKey = apiKey;
  }
  return config;
}
