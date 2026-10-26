import { describe, expect, it } from "vitest";
import { rewritePays } from "../src/context/price.js";

describe("rewritePays", () => {
  it("得と損がちょうど等しいときは書き換えない", () => {
    expect(
      rewritePays({
        rewrittenTokens: 100,
        savedTokens: 100,
        callsAhead: 1,
        prices: { input: 2, cachedInput: 1 },
      }),
    ).toBe(false);
  });

  it("得が損より小さければ書き換えない", () => {
    expect(
      rewritePays({
        rewrittenTokens: 1000,
        savedTokens: 100,
        callsAhead: 3,
        prices: { input: 0.3, cachedInput: 0.006 },
      }),
    ).toBe(false);
  });

  it("callsAhead が大きければ書き換える", () => {
    expect(
      rewritePays({
        rewrittenTokens: 100,
        savedTokens: 100,
        callsAhead: 2,
        prices: { input: 2, cachedInput: 1 },
      }),
    ).toBe(true);
  });

  it("cacheWrite を省いたときは input と同じ値として扱う", () => {
    const base = {
      rewrittenTokens: 1000,
      savedTokens: 100,
      callsAhead: 3,
    };
    expect(
      rewritePays({
        ...base,
        prices: { input: 0.3, cachedInput: 0.006 },
      }),
    ).toBe(
      rewritePays({
        ...base,
        prices: { input: 0.3, cachedInput: 0.006, cacheWrite: 0.3 },
      }),
    );
  });

  it("Claude の書き込み料金を入れると境目が変わる", () => {
    const args = {
      rewrittenTokens: 100,
      savedTokens: 100,
      callsAhead: 10,
    };
    expect(
      rewritePays({
        ...args,
        prices: { input: 2, cachedInput: 0.2 },
      }),
    ).toBe(true);
    expect(
      rewritePays({
        ...args,
        prices: { input: 2, cachedInput: 0.2, cacheWrite: 2.5 },
      }),
    ).toBe(false);
  });
});
