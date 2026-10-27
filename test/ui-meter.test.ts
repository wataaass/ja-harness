import { describe, expect, it } from "vitest";
import { renderMeter } from "../src/ui/meter.js";
import { createTheme } from "../src/ui/theme.js";

const plain = createTheme({ env: {}, isTTY: false });

describe("renderMeter", () => {
  it("5段の棒と割合を出す", () => {
    expect(renderMeter(0.87, plain)).toBe("▰▰▰▰▱ 87%");
  });

  it("0と1の端を扱う", () => {
    expect(renderMeter(0, plain)).toBe("▱▱▱▱▱ 0%");
    expect(renderMeter(1, plain)).toBe("▰▰▰▰▰ 100%");
  });

  it("四捨五入して段を決める", () => {
    expect(renderMeter(0.5, plain)).toBe("▰▰▰▱▱ 50%");
    expect(renderMeter(0.49, plain)).toBe("▰▰▱▱▱ 49%");
  });

  it("範囲の外は端に寄せる", () => {
    expect(renderMeter(-1, plain)).toBe("▱▱▱▱▱ 0%");
    expect(renderMeter(2, plain)).toBe("▰▰▰▰▰ 100%");
  });

  it("warn なら棒を注意の色にする", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    expect(renderMeter(0.8, theme, { warn: true })).toContain(
      "\u001B[38;2;224;165;38m",
    );
    expect(renderMeter(0.8, theme)).toContain("\u001B[38;2;91;141;184m");
  });
});
