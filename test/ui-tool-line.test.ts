import { describe, expect, it } from "vitest";
import { createTheme } from "../src/ui/theme.js";
import { formatToolLine, toolMark } from "../src/ui/tool-line.js";
import { stringWidth, stripAnsi } from "../src/ui/width.js";

const plain = createTheme({ env: {}, isTTY: false });

describe("toolMark", () => {
  it("道具ごとの日本語1文字を返す", () => {
    expect(toolMark("read")).toBe("読");
    expect(toolMark("list")).toBe("覧");
    expect(toolMark("grep")).toBe("探");
    expect(toolMark("edit")).toBe("編");
    expect(toolMark("write")).toBe("作");
    expect(toolMark("shell")).toBe("実");
    expect(toolMark("plan")).toBe("計");
    expect(toolMark("ask")).toBe("問");
  });

  it("知らない道具は・", () => {
    expect(toolMark("other")).toBe("・");
  });
});

describe("formatToolLine", () => {
  it("道具の文字と要約を1行にまとめる", () => {
    expect(
      formatToolLine({
        name: "read",
        summary: "src/app.ts（120行）",
        theme: plain,
        width: 80,
      }),
    ).toBe(" 読  src/app.ts（120行）");
  });

  it("detail を後ろに薄く付ける", () => {
    expect(
      formatToolLine({
        name: "grep",
        summary: '"AppError" 3件',
        detail: "0.2秒",
        theme: plain,
        width: 80,
      }),
    ).toBe(' 探  "AppError" 3件  0.2秒');
  });

  it("失敗なら ✕ を付けて失敗の色にする", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    const line = formatToolLine({
      name: "read",
      summary: "src/app.ts",
      failed: true,
      theme,
      width: 80,
    });
    expect(stripAnsi(line)).toBe(" ✕読  src/app.ts");
    expect(line).toContain("\u001B[38;2;201;51;58m");
  });

  it("幅を超えたら切り詰める", () => {
    const line = formatToolLine({
      name: "read",
      summary: "とても長いファイル名のファイルを読みました",
      theme: plain,
      width: 12,
    });
    expect(stringWidth(line)).toBeLessThanOrEqual(12);
    expect(line.endsWith("…")).toBe(true);
  });
});
