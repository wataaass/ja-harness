import { describe, expect, it } from "vitest";
import { renderGreeting } from "../src/ui/greeting.js";
import { createTheme } from "../src/ui/theme.js";
import { stringWidth } from "../src/ui/width.js";

const plain = createTheme({ env: {}, isTTY: false });

describe("renderGreeting", () => {
  it("名前・版・モデル・作業フォルダを1行目に出す", () => {
    const lines = renderGreeting({
      version: "0.1",
      model: "deepseek-v4.1-flash",
      effort: "high",
      cwd: "/home/user/work/app",
      home: "/home/user",
      theme: plain,
      width: 80,
    });
    expect(lines[0]).toBe(
      " ja-harness 0.1   deepseek-v4.1-flash（high）   ~/work/app",
    );
  });

  it("前回がなければ2行目は案内だけ", () => {
    const lines = renderGreeting({
      version: "0.1",
      model: "deepseek-v4.1-flash",
      cwd: "/tmp",
      theme: plain,
      width: 80,
    });
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(" /help で使い方");
  });

  it("前回の料金とキャッシュを2行目に出す", () => {
    const lines = renderGreeting({
      version: "0.1",
      model: "deepseek-v4.1-flash",
      effort: "high",
      cwd: "/home/user/work/app",
      home: "/home/user",
      last: { cost: 0.012, cacheRatio: 0.91 },
      theme: plain,
      width: 80,
    });
    expect(lines[1]).toBe(
      " 前回のセッション 0.012ドル・キャッシュ 91%   /help で使い方",
    );
  });

  it("home と同じ場所なら ~ にする", () => {
    const lines = renderGreeting({
      version: "0.1",
      model: "m",
      cwd: "/home/user",
      home: "/home/user",
      theme: plain,
      width: 80,
    });
    expect(lines[0]).toContain("~");
    expect(lines[0]).not.toContain("/home/user");
  });

  it("home の外ならそのまま出す", () => {
    const lines = renderGreeting({
      version: "0.1",
      model: "m",
      cwd: "/var/tmp",
      home: "/home/user",
      theme: plain,
      width: 80,
    });
    expect(lines[0]).toContain("/var/tmp");
  });

  it("幅を超えたら切り詰める", () => {
    const lines = renderGreeting({
      version: "0.1",
      model: "非常に長いモデル名",
      cwd: "/home/user/work/app",
      home: "/home/user",
      last: { cost: 12.345, cacheRatio: 0.5 },
      theme: plain,
      width: 20,
    });
    for (const line of lines) {
      expect(stringWidth(line)).toBeLessThanOrEqual(20);
    }
  });
});
