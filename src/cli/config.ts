export type CliConfig = { baseUrl: string; model: string; apiKey?: string };

export function readConfig(env: Record<string, string | undefined>): CliConfig {
  const baseUrl = (
    env.JA_HARNESS_BASE_URL ?? "https://opencode.ai/zen/go/v1"
  ).replace(/\/+$/, "");
  const model = env.JA_HARNESS_MODEL ?? "deepseek-v4.1-flash";
  const apiKey = env.JA_HARNESS_API_KEY ?? env.OPENCODE_API_KEY;
  const config: CliConfig = { baseUrl, model };
  if (apiKey !== undefined) {
    config.apiKey = apiKey;
  }
  return config;
}
