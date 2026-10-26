import { describe, expect, it } from "vitest";
import { readConfig } from "../src/cli/config.js";

describe("readConfig", () => {
  it("既定値を返す", () => {
    expect(readConfig({})).toEqual({
      baseUrl: "https://opencode.ai/zen/go/v1",
      model: "deepseek-v4.1-flash",
      contextWindow: 1048576,
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
      contextWindow: 1048576,
    });
  });

  it("JA_HARNESS_API_KEY がなければ OPENCODE_API_KEY を使う", () => {
    expect(readConfig({ OPENCODE_API_KEY: "other" })).toEqual({
      baseUrl: "https://opencode.ai/zen/go/v1",
      model: "deepseek-v4.1-flash",
      apiKey: "other",
      contextWindow: 1048576,
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

  it("JA_HARNESS_CONTEXT_WINDOW を整数として読む", () => {
    expect(
      readConfig({ JA_HARNESS_CONTEXT_WINDOW: "12345" }).contextWindow,
    ).toBe(12345);
  });

  it("正の整数でなければ既定値を使う", () => {
    expect(readConfig({ JA_HARNESS_CONTEXT_WINDOW: "0" }).contextWindow).toBe(
      1048576,
    );
    expect(readConfig({ JA_HARNESS_CONTEXT_WINDOW: "-1" }).contextWindow).toBe(
      1048576,
    );
    expect(readConfig({ JA_HARNESS_CONTEXT_WINDOW: "abc" }).contextWindow).toBe(
      1048576,
    );
    expect(readConfig({ JA_HARNESS_CONTEXT_WINDOW: "1.5" }).contextWindow).toBe(
      1048576,
    );
  });
});
