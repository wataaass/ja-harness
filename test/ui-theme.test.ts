import { describe, expect, it } from "vitest";
import { createTheme } from "../src/ui/theme.js";

describe("createTheme", () => {
  it("NO_COLOR があれば色なし", () => {
    const theme = createTheme({
      env: { NO_COLOR: "1", COLORTERM: "truecolor" },
      isTTY: true,
    });
    expect(theme.accent("あ")).toBe("あ");
    expect(theme.dim("あ")).toBe("あ");
    expect(theme.add("あ")).toBe("あ");
    expect(theme.remove("あ")).toBe("あ");
    expect(theme.warn("あ")).toBe("あ");
    expect(theme.error("あ")).toBe("あ");
    expect(theme.bold("あ")).toBe("あ");
  });

  it("NO_COLOR が空でも色なし", () => {
    const theme = createTheme({ env: { NO_COLOR: "" }, isTTY: true });
    expect(theme.accent("あ")).toBe("あ");
  });

  it("isTTY が false なら色なし", () => {
    const theme = createTheme({
      env: { COLORTERM: "truecolor" },
      isTTY: false,
    });
    expect(theme.accent("あ")).toBe("あ");
  });

  it("COLORTERM が truecolor なら24ビットの暗い藍", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    expect(theme.accent("あ")).toContain("\u001B[38;2;91;141;184m");
  });

  it("明るい背景なら明るい藍にする", () => {
    const theme = createTheme({
      env: { COLORTERM: "24bit", COLORFGBG: "0;15" },
      isTTY: true,
    });
    expect(theme.accent("あ")).toContain("\u001B[38;2;22;94;131m");
  });

  it("COLORFGBG の背景が暗ければ暗い藍", () => {
    const theme = createTheme({
      env: { COLORTERM: "truecolor", COLORFGBG: "15;0" },
      isTTY: true,
    });
    expect(theme.accent("あ")).toContain("\u001B[38;2;91;141;184m");
  });

  it("dark の指定は COLORFGBG より優先する", () => {
    const theme = createTheme({
      env: { COLORTERM: "truecolor", COLORFGBG: "0;15" },
      isTTY: true,
      dark: true,
    });
    expect(theme.accent("あ")).toContain("\u001B[38;2;91;141;184m");
  });

  it("truecolor でなければ256色にする", () => {
    const theme = createTheme({ env: {}, isTTY: true });
    expect(theme.accent("あ").startsWith("\u001B[38;5;")).toBe(true);
    expect(theme.accent("あ")).not.toContain("38;2;");
  });

  it("意味の色を24ビットで出す", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    expect(theme.add("あ")).toContain("\u001B[38;2;93;174;139m");
    expect(theme.remove("あ")).toContain("\u001B[38;2;217;119;107m");
    expect(theme.warn("あ")).toContain("\u001B[38;2;224;165;38m");
    expect(theme.error("あ")).toContain("\u001B[38;2;201;51;58m");
  });

  it("薄い文字と太字は端末の指定を使う", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    expect(theme.dim("あ")).toContain("\u001B[2m");
    expect(theme.bold("あ")).toContain("\u001B[1m");
  });
});
