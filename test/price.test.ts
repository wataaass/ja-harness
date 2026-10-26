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
});
