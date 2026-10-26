import { describe, expect, it } from "vitest";
import { isContextOverflow } from "../src/context/overflow.js";

describe("isContextOverflow", () => {
  it("文脈の長さのエラーに当たる", () => {
    expect(
      isContextOverflow(
        new Error("This model's maximum context length is 8192 tokens"),
      ),
    ).toBe(true);
    expect(
      isContextOverflow(new Error("context_length_exceeded: too large")),
    ).toBe(true);
    expect(isContextOverflow(new Error("The prompt is too long"))).toBe(true);
  });

  it("関係のないエラーには当たらない", () => {
    expect(isContextOverflow(new Error("network is unreachable"))).toBe(false);
    expect(isContextOverflow(new Error("rate limit exceeded"))).toBe(false);
  });

  it("Error でない値には当たらない", () => {
    expect(isContextOverflow("maximum context length")).toBe(false);
    expect(isContextOverflow(undefined)).toBe(false);
    expect(isContextOverflow({ message: "context length" })).toBe(false);
  });
});
