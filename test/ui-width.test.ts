import { describe, expect, it } from "vitest";
import {
  charWidth,
  padEnd,
  stringWidth,
  stripAnsi,
  truncate,
  wrap,
} from "../src/ui/width.js";

describe("charWidth", () => {
  it("日本語の全角は2", () => {
    expect(charWidth("あ".codePointAt(0) ?? 0)).toBe(2);
    expect(charWidth("漢".codePointAt(0) ?? 0)).toBe(2);
  });

  it("半角の英数字は1", () => {
    expect(charWidth("a".codePointAt(0) ?? 0)).toBe(1);
    expect(charWidth("1".codePointAt(0) ?? 0)).toBe(1);
  });

  it("全角記号と絵文字は2", () => {
    expect(charWidth("！".codePointAt(0) ?? 0)).toBe(2);
    expect(charWidth("。".codePointAt(0) ?? 0)).toBe(2);
    expect(charWidth("😀".codePointAt(0) ?? 0)).toBe(2);
  });

  it("結合文字・ゼロ幅・制御文字は0", () => {
    expect(charWidth(0x0301)).toBe(0);
    expect(charWidth(0x200d)).toBe(0);
    expect(charWidth(0x0007)).toBe(0);
    expect(charWidth(0x001b)).toBe(0);
  });
});

describe("stringWidth", () => {
  it("全角を2として数える", () => {
    expect(stringWidth("日本語abc")).toBe(9);
  });

  it("ANSI のエスケープは数えない", () => {
    expect(stringWidth("\u001B[31m赤\u001B[0m")).toBe(2);
  });
});

describe("stripAnsi", () => {
  it("色の指定を取り除く", () => {
    expect(stripAnsi("\u001B[31m赤\u001B[0m")).toBe("赤");
  });
});

describe("truncate", () => {
  it("収まるならそのまま返す", () => {
    expect(truncate("あい", 4)).toBe("あい");
  });

  it("全角の途中では切らない", () => {
    expect(truncate("あいうえお", 7)).toBe("あいう…");
    expect(stringWidth(truncate("あいうえお", 7))).toBe(7);
  });

  it("半角も幅に合わせて切る", () => {
    expect(truncate("hello", 4)).toBe("hel…");
  });

  it("幅が0なら空", () => {
    expect(truncate("hello", 0)).toBe("");
  });

  it("色つきでも幅を数えて切る", () => {
    const result = truncate("\u001B[31mあいう\u001B[0m", 4);
    expect(stripAnsi(result)).toBe("あ…");
    expect(stringWidth(result)).toBe(3);
  });
});

describe("padEnd", () => {
  it("全角を2として右を埋める", () => {
    expect(padEnd("日本", 6)).toBe("日本  ");
    expect(stringWidth(padEnd("日本", 6))).toBe(6);
  });

  it("すでに広ければ触らない", () => {
    expect(padEnd("あい", 2)).toBe("あい");
  });
});

describe("wrap", () => {
  it("全角の幅で折り返す", () => {
    expect(wrap("あいうえお", 4)).toEqual(["あい", "うえ", "お"]);
  });

  it("半角の幅で折り返す", () => {
    expect(wrap("abcde", 3)).toEqual(["abc", "de"]);
  });

  it("改行を残す", () => {
    expect(wrap("あい\nうえ", 4)).toEqual(["あい", "うえ"]);
  });

  it("色は落として折り返す", () => {
    expect(wrap("\u001B[31mあい\u001B[0m", 2)).toEqual(["あ", "い"]);
  });
});
