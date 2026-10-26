export type CliConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindow: number;
};

const DEFAULT_CONTEXT_WINDOW = 1048576;

export function readConfig(env: Record<string, string | undefined>): CliConfig {
  const baseUrl = (
    env.JA_HARNESS_BASE_URL ?? "https://opencode.ai/zen/go/v1"
  ).replace(/\/+$/, "");
  const model = env.JA_HARNESS_MODEL ?? "deepseek-v4.1-flash";
  const apiKey = env.JA_HARNESS_API_KEY ?? env.OPENCODE_API_KEY;
  const rawContextWindow = env.JA_HARNESS_CONTEXT_WINDOW;
  const parsedContextWindow =
    rawContextWindow === undefined ? Number.NaN : Number(rawContextWindow);
  const contextWindow =
    Number.isInteger(parsedContextWindow) && parsedContextWindow > 0
      ? parsedContextWindow
      : DEFAULT_CONTEXT_WINDOW;
  const config: CliConfig = { baseUrl, model, contextWindow };
  if (apiKey !== undefined) {
    config.apiKey = apiKey;
  }
  return config;
}
