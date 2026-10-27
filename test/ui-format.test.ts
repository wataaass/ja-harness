import { describe, expect, it } from "vitest";
import {
  formatCost,
  formatTokens,
  formatTurnSummary,
} from "../src/ui/format.js";

describe("formatCost", () => {
  it("小さい料金は有効数字2桁程度で出す", () => {
    expect(formatCost(0.0004)).toBe("0.0004ドル");
    expect(formatCost(0.012)).toBe("0.012ドル");
    expect(formatCost(0.003)).toBe("0.003ドル");
    expect(formatCost(0.000412)).toBe("0.00041ドル");
  });

  it("1以上は短く出す", () => {
    expect(formatCost(1.2)).toBe("1.2ドル");
    expect(formatCost(1)).toBe("1ドル");
    expect(formatCost(12.345)).toBe("12ドル");
    expect(formatCost(123.4)).toBe("123ドル");
  });

  it("0はそのまま", () => {
    expect(formatCost(0)).toBe("0ドル");
  });
});

describe("formatTokens", () => {
  it("1000未満はそのまま", () => {
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(0)).toBe("0");
  });

  it("1000以上は k で出す", () => {
    expect(formatTokens(1000)).toBe("1k");
    expect(formatTokens(4100)).toBe("4.1k");
    expect(formatTokens(15300)).toBe("15.3k");
  });

  it("100万以上は M で出す", () => {
    expect(formatTokens(1_000_000)).toBe("1M");
    expect(formatTokens(1_200_000)).toBe("1.2M");
  });
});

describe("formatTurnSummary", () => {
  it("トークン・料金・キャッシュを1行にする", () => {
    expect(
      formatTurnSummary({ tokens: 4100, cost: 0.0004, cacheRatio: 0.87 }),
    ).toBe("今回 4.1k トークン・0.0004ドル・キャッシュ 87%");
  });
});
