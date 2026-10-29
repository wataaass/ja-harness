import { describe, expect, it } from "vitest";
import { readConfig, useOpencodeSession } from "../src/cli/config.js";

describe("readConfig", () => {
  it("既定値を返す", () => {
    expect(readConfig({})).toEqual({
      baseUrl: "https://opencode.ai/zen/go/v1",
      model: "deepseek-v4.1-flash",
      contextWindow: 1048576,
      provider: "opencode-go",
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
      provider: "opencode-go",
    });
  });

  it("JA_HARNESS_API_KEY がなければ OPENCODE_API_KEY を使う", () => {
    expect(readConfig({ OPENCODE_API_KEY: "other" })).toEqual({
      baseUrl: "https://opencode.ai/zen/go/v1",
      model: "deepseek-v4.1-flash",
      apiKey: "other",
      contextWindow: 1048576,
      provider: "opencode-go",
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

  it("正の整数でなければモデルの上限を使う", () => {
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
    expect(
      readConfig({ JA_HARNESS_MODEL: "kimi-k2.7-code" }).contextWindow,
    ).toBe(262144);
  });

  it("provider は環境変数が設定より優先", () => {
    expect(
      readConfig(
        {
          JA_HARNESS_PROVIDER: "from-env",
          JA_HARNESS_BASE_URL: "https://example.test/v1",
        },
        { provider: "from-settings" },
      ).provider,
    ).toBe("from-env");
    expect(
      readConfig(
        { JA_HARNESS_BASE_URL: "https://example.test/v1" },
        { provider: "from-settings" },
      ).provider,
    ).toBe("from-settings");
  });

  it("opencode-go 以外は料金表の API と環境変数のキーを使う", () => {
    expect(
      readConfig(
        { MOONSHOT_API_KEY: "moon" },
        {
          provider: "moonshot",
          catalog: {
            api: "https://api.moonshot.test/v1/",
            env: ["MOONSHOT_API_KEY"],
          },
        },
      ),
    ).toEqual({
      baseUrl: "https://api.moonshot.test/v1",
      model: "deepseek-v4.1-flash",
      apiKey: "moon",
      contextWindow: 1048576,
      provider: "moonshot",
    });
  });

  it("API の URL が分からなければ止める", () => {
    expect(() => readConfig({}, { provider: "unknown" })).toThrow(
      "unknown の API の URL が分かりません。JA_HARNESS_BASE_URL を設定してください",
    );
  });

  it("x-opencode-session を付ける provider を判定する", () => {
    expect(useOpencodeSession("opencode-go")).toBe(true);
    expect(useOpencodeSession("opencode")).toBe(true);
    expect(useOpencodeSession("moonshot")).toBe(false);
  });
});
