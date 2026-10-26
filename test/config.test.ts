import { describe, expect, it } from "vitest";
import { readConfig } from "../src/cli/config.js";

describe("readConfig", () => {
  it("既定値を返す", () => {
    expect(readConfig({})).toEqual({
      baseUrl: "https://opencode.ai/zen/go/v1",
      model: "deepseek-v4.1-flash",
    });
  });

  it("環境変数を優先する", () => {
    expect(
      readConfig({
        JA_HARNESS_BASE_URL: "https://example.test/v1",
        JA_HARNESS_MODEL: "my-model",
        JA_HARNESS_API_KEY: "mine",
        OPENCODE_API_KEY: "other",
      }),
    ).toEqual({
      baseUrl: "https://example.test/v1",
      model: "my-model",
      apiKey: "mine",
    });
  });

  it("JA_HARNESS_API_KEY がなければ OPENCODE_API_KEY を使う", () => {
    expect(readConfig({ OPENCODE_API_KEY: "other" })).toEqual({
      baseUrl: "https://opencode.ai/zen/go/v1",
      model: "deepseek-v4.1-flash",
      apiKey: "other",
    });
  });

  it("末尾のスラッシュを取り除く", () => {
    expect(
      readConfig({ JA_HARNESS_BASE_URL: "https://example.test/v1/" }),
    ).toMatchObject({ baseUrl: "https://example.test/v1" });
  });

  it("apiKey がないときは入れない", () => {
    const config = readConfig({});
    expect("apiKey" in config).toBe(false);
  });
});
