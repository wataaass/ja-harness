import { describe, expect, it } from "vitest";
import { renderStatus } from "../src/ui/status.js";
import { createTheme } from "../src/ui/theme.js";
import { stringWidth, stripAnsi } from "../src/ui/width.js";

const plain = createTheme({ env: {}, isTTY: false });

function status(overrides: Record<string, unknown> = {}) {
  return renderStatus({
    mode: "実行",
    permission: "確認する",
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
  it("モード・権限・モデル・文脈・料金・メーターを並べる", () => {
    expect(status()).toBe(
      " 実行  確認する  deepseek-v4.1-flash（high）  文脈 12%  0.003ドル ▰▰▰▰▱ 87%",
    );
  });

  it("effort がなければモデル名だけ", () => {
    expect(status({ effort: undefined })).toContain(
      "  deepseek-v4.1-flash  文脈",
    );
  });

  it("待ちがあれば件数を足す", () => {
    expect(status({ queued: 1 })).toContain("確認する  待ち 1件  deepseek");
  });

  it("幅が足りなければモデル名を先に省く", () => {
    const line = status({ width: 55 });
    expect(stripAnsi(line)).not.toContain("deepseek");
    expect(stripAnsi(line)).toContain("確認する");
    expect(stringWidth(line)).toBeLessThanOrEqual(55);
  });

  it("それでも足りなければ権限も省く", () => {
    const line = status({ width: 30 });
    expect(stripAnsi(line)).not.toContain("deepseek");
    expect(stripAnsi(line)).not.toContain("確認する");
    expect(stringWidth(line)).toBeLessThanOrEqual(30);
  });

  it("1%未満の文脈は <1% と出す", () => {
    expect(status({ contextRatio: 0.004 })).toContain("文脈 <1%");
  });

  it("文脈が0なら 0% と出す", () => {
    expect(status({ contextRatio: 0 })).toContain("文脈 0%");
  });

  it("小さい料金も有効数字2桁程度で出す", () => {
    expect(status({ cost: 0.0004 })).toContain("0.0004ドル");
  });

  it("モードだけ差し色にする", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    const line = status({ theme });
    expect(line).toContain("\u001B[38;2;91;141;184m実行");
    expect(line).toContain("deepseek-v4.1-flash（high）");
  });

  it("warn をメーターに渡す", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    const line = status({ theme, warn: true });
    expect(line).toContain("\u001B[38;2;224;165;38m▰▰▰▰▱");
  });
});
