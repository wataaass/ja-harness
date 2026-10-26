import { describe, expect, it } from "vitest";
import { formatVersion } from "../src/version.js";

describe("formatVersion", () => {
  it("名前とバージョンを返す", () => {
    expect(formatVersion()).toBe("ja-harness 0.0.1");
  });
});
