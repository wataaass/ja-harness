import { describe, expect, it } from "vitest";
import { renderCard } from "../src/ui/card.js";
import { createTheme } from "../src/ui/theme.js";
import { stringWidth } from "../src/ui/width.js";

const plain = createTheme({ env: {}, isTTY: false });

describe("renderCard", () => {
  it("幅60以上では角丸の枠で囲む", () => {
    const lines = renderCard({
      title: "編集の案  src/app.ts  1/2",
      body: [
        "- if (err) return;",
        '+ if (err) throw new AppError("読み込みに失敗しました", {',
        "+   cause: err,",
        "+ });",
      ],
      footer: "Enter 採用  Esc 却下  a このファイルは全部  e 理由を書く",
      width: 60,
      theme: plain,
    });
    expect(lines[0]?.startsWith("╭─ 編集の案")).toBe(true);
    expect(lines[0]?.endsWith("╮")).toBe(true);
    expect(lines.at(-1)?.startsWith("╰─ Enter 採用")).toBe(true);
    expect(lines.at(-1)?.endsWith("╯")).toBe(true);
  });

  it("全行の右端が同じ幅になる", () => {
    const lines = renderCard({
      title: "編集の案  src/app.ts  1/2",
      body: [
        "- if (err) return;",
        '+ if (err) throw new AppError("読み込みに失敗しました", {',
        "+   cause: err,",
      ],
      footer: "Enter 採用  Esc 却下",
      width: 60,
      theme: plain,
    });
    for (const line of lines) {
      expect(stringWidth(line)).toBe(60);
    }
  });

  it("色つきでも全行の右端が同じ幅になる", () => {
    const theme = createTheme({ env: { COLORTERM: "truecolor" }, isTTY: true });
    const lines = renderCard({
      title: "計画の文書",
      body: ["日本語の本文です"],
      footer: "Enter 承認",
      width: 64,
      theme,
    });
    for (const line of lines) {
      expect(stringWidth(line)).toBe(64);
    }
    expect(lines[0]).toContain("38;2;91;141;184");
  });

  it("見出しが空なら上の辺は線だけにする", () => {
    const lines = renderCard({
      title: "",
      body: ["本文"],
      width: 60,
      theme: plain,
    });
    expect(lines[0]).toBe(`╭${"─".repeat(58)}╮`);
    expect(stringWidth(lines[0] ?? "")).toBe(60);
  });

  it("長い見出しと footer は切り詰めて角の前に空白を残さない", () => {
    const lines = renderCard({
      title: "あ".repeat(100),
      body: ["本文"],
      footer: "い".repeat(100),
      width: 60,
      theme: plain,
    });
    for (const line of lines) {
      expect(stringWidth(line)).toBe(60);
    }
    expect(lines[0]).toContain("…");
    expect(lines.at(-1)).toContain("…");
    expect(lines[0]).not.toMatch(/ ╮$/);
    expect(lines.at(-1)).not.toMatch(/ ╯$/);
  });

  it("footer がなければ下の辺は線だけ", () => {
    const lines = renderCard({
      title: "見出し",
      body: ["本文"],
      width: 60,
      theme: plain,
    });
    expect(lines.at(-1)).toBe(`╰${"─".repeat(58)}╯`);
  });

  it("長い本文は切り詰めて右端をそろえる", () => {
    const lines = renderCard({
      title: "見出し",
      body: ["あ".repeat(100)],
      width: 60,
      theme: plain,
    });
    expect(lines[1]).toContain("…");
    expect(stringWidth(lines[1] ?? "")).toBe(60);
  });

  it("幅60未満では枠をやめて左の線だけにする", () => {
    const lines = renderCard({
      title: "見出し",
      body: ["本文の行"],
      footer: "Enter 採用",
      width: 40,
      theme: plain,
    });
    expect(lines).toEqual(["│ 見出し", "│ 本文の行", "│ Enter 採用"]);
    expect(lines.join("\n")).not.toContain("╭");
  });

  it("幅0なら空", () => {
    expect(
      renderCard({ title: "見出し", body: [], width: 0, theme: plain }),
    ).toEqual([]);
  });
});
