import { describe, expect, it } from "vitest";
import { renderStatus } from "../src/ui/status.js";
import { createTheme } from "../src/ui/theme.js";
import { stringWidth, stripAnsi } from "../src/ui/width.js";

const plain = createTheme({ env: {}, isTTY: false });

function status(overrides: Record<string, unknown> = {}) {
  return renderStatus({
    mode: "Agent",
    permission: "Confirm",
    model: "deepseek-v4.1-flash",
    effort: "high",
    contextRatio: 0.12,
    cost: 0.003,
    cacheRatio: 0.87,
    theme: plain,
    width: 200,
    ...overrides,
  });
}

describe("renderStatus", () => {
  it("モード・権限・モデル・Context・料金・メーターを並べる", () => {
    expect(status()).toBe(
      " Agent  Confirm  deepseek-v4.1-flash（high）  Context 12%  $0.003 ▰▰▰▰▱ 87%",
    );
  });

  it("effort がなければモデル名だけ", () => {
    expect(status({ effort: undefined })).toContain(
      "  deepseek-v4.1-flash  Context",
    );
  });

  it("待ちがあれば件数を足す", () => {
    expect(status({ queued: 1 })).toContain("Confirm  Queued 1  deepseek");
  });

  it("幅が足りなければモデル名を先に省く", () => {
    const line = status({ width: 55 });
    expect(stripAnsi(line)).not.toContain("deepseek");
    expect(stripAnsi(line)).toContain("Confirm");
    expect(stringWidth(line)).toBeLessThanOrEqual(55);
  });

  it("それでも足りなければ権限も省く", () => {
    const line = status({ width: 30 });
    expect(stripAnsi(line)).not.toContain("deepseek");
    expect(stripAnsi(line)).not.toContain("Confirm");
    expect(stringWidth(line)).toBeLessThanOrEqual(30);
  });

  it("1%未満の Context は <1% と出す", () => {
    expect(status({ contextRatio: 0.004 })).toContain("Context <1%");
  });

  it("Context が0なら 0% と出す", () => {
    expect(status({ contextRatio: 0 })).toContain("Context 0%");
  });

  it("小さい料金も有効数字2桁程度で出す", () => {
    expect(status({ cost: 0.0004 })).toContain("$0.0004");
  });

  it("モードだけ差し色にする", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    const line = status({ theme });
    expect(line).toContain("\u001B[38;2;91;141;184mAgent");
    expect(line).toContain("deepseek-v4.1-flash（high）");
  });

  it("warn をメーターに渡す", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    const line = status({ theme, warn: true });
    expect(line).toContain("\u001B[38;2;224;165;38m▰▰▰▰▱");
  });
});
