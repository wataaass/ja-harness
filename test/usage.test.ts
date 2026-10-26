import { describe, expect, it } from "vitest";
import { formatUsage } from "../src/cli/usage.js";
import type { Usage } from "../src/llm/types.js";

function usage(overrides: Partial<Usage> = {}): Usage {
  return {
    input: 0,
    cachedInput: 0,
    output: 0,
    reasoning: 0,
    ...overrides,
  };
}

describe("formatUsage", () => {
  it("例の形で出す", () => {
    expect(
      formatUsage(
        usage({
          input: 12345,
          cachedInput: 10000,
          output: 678,
          cost: 0.00123,
        }),
      ),
    ).toBe("入力 12,345（キャッシュ 10,000・81%）・出力 678・$0.0012");
  });

  it("input が 0 なら率は 0", () => {
    expect(formatUsage(usage({ input: 0, cachedInput: 0, output: 0 }))).toBe(
      "入力 0（キャッシュ 0・0%）・出力 0",
    );
  });

  it("cost がなければ金額を出さない", () => {
    expect(formatUsage(usage({ input: 1, cachedInput: 0, output: 2 }))).toBe(
      "入力 1（キャッシュ 0・0%）・出力 2",
    );
  });

  it("大きな数を3桁ごとに区切る", () => {
    expect(
      formatUsage(
        usage({
          input: 1_234_567,
          cachedInput: 1_000_000,
          output: 8_901_234,
          cost: 12.34567,
        }),
      ),
    ).toBe(
      "入力 1,234,567（キャッシュ 1,000,000・81%）・出力 8,901,234・$12.3457",
    );
  });
});
