import { describe, expect, it } from "vitest";
import {
  type DecoderState,
  decodeKeys,
  emptyDecoderState,
  flushEscape,
} from "../src/ui/keys.js";

function decode(chunk: string, state?: DecoderState) {
  return decodeKeys(chunk, state);
}

describe("decodeKeys", () => {
  it("日本語の文字をまとめて文字のキーにする", () => {
    expect(decode("日本語").keys).toEqual([{ type: "char", text: "日本語" }]);
  });

  it("Enter と Ctrl+J を区別する", () => {
    expect(decode("\r").keys).toEqual([{ type: "enter" }]);
    expect(decode("\n").keys).toEqual([{ type: "newline" }]);
  });

  it("Shift+Enter の2つの列を改行にする", () => {
    expect(decode("\x1b[13;2u").keys).toEqual([{ type: "newline" }]);
    expect(decode("\x1b[27;2;13~").keys).toEqual([{ type: "newline" }]);
  });

  it("編集に使うキーを読む", () => {
    expect(decode("\x7f").keys).toEqual([{ type: "backspace" }]);
    expect(decode("\x1b[3~").keys).toEqual([{ type: "delete" }]);
    expect(decode("\x1b[A").keys).toEqual([{ type: "up" }]);
    expect(decode("\x1b[B").keys).toEqual([{ type: "down" }]);
    expect(decode("\x1b[C").keys).toEqual([{ type: "right" }]);
    expect(decode("\x1b[D").keys).toEqual([{ type: "left" }]);
    expect(decode("\x1b[H").keys).toEqual([{ type: "home" }]);
    expect(decode("\x1b[F").keys).toEqual([{ type: "end" }]);
    expect(decode("\x1b[1~").keys).toEqual([{ type: "home" }]);
    expect(decode("\x1b[4~").keys).toEqual([{ type: "end" }]);
  });

  it("Alt や Ctrl を押した矢印を単語の移動にする", () => {
    expect(decode("\x1b[1;3D").keys).toEqual([{ type: "wordLeft" }]);
    expect(decode("\x1b[1;5C").keys).toEqual([{ type: "wordRight" }]);
    expect(decode("\x1b[1;7D").keys).toEqual([{ type: "wordLeft" }]);
    expect(decode("\x1b[1;2C").keys).toEqual([{ type: "right" }]);
  });

  it("Tab と Shift+Tab を読む", () => {
    expect(decode("\t").keys).toEqual([{ type: "tab" }]);
    expect(decode("\x1b[Z").keys).toEqual([{ type: "shiftTab" }]);
  });

  it("Ctrl のキーを読む", () => {
    expect(decode("\x03").keys).toEqual([{ type: "ctrl", key: "c" }]);
    expect(decode("\x04").keys).toEqual([{ type: "ctrl", key: "d" }]);
    expect(decode("\x12").keys).toEqual([{ type: "ctrl", key: "r" }]);
    expect(decode("\x0f").keys).toEqual([{ type: "ctrl", key: "o" }]);
    expect(decode("\x01").keys).toEqual([{ type: "ctrl", key: "a" }]);
    expect(decode("\x05").keys).toEqual([{ type: "ctrl", key: "e" }]);
    expect(decode("\x0b").keys).toEqual([{ type: "ctrl", key: "k" }]);
    expect(decode("\x15").keys).toEqual([{ type: "ctrl", key: "u" }]);
    expect(decode("\x17").keys).toEqual([{ type: "ctrl", key: "w" }]);
    expect(decode("\x0c").keys).toEqual([{ type: "ctrl", key: "l" }]);
  });

  it("単独の ESC はすぐには確定せず、flush で確定する", () => {
    const first = decode("\x1b");
    expect(first.keys).toEqual([]);
    expect(first.state.pending).toBe("\x1b");
    expect(flushEscape(first.state).keys).toEqual([{ type: "escape" }]);
  });

  it("ESC と矢印の列が chunk をまたいでも読める", () => {
    const first = decode("\x1b[");
    expect(first.keys).toEqual([]);
    const second = decode("A", first.state);
    expect(second.keys).toEqual([{ type: "up" }]);
    expect(second.state.pending).toBe("");
  });

  it("ブラケット貼り付けの中身を chunk をまたいでも読める", () => {
    const first = decode("\x1b[200~日本");
    expect(first.keys).toEqual([]);
    const second = decode("語\r\nです\x1b[201~", first.state);
    expect(second.keys).toEqual([{ type: "paste", text: "日本語\r\nです" }]);
  });

  it("貼り付けの始まりが chunk をまたいでも読める", () => {
    const first = decode("\x1b[20");
    expect(first.keys).toEqual([]);
    const second = decode("0~貼り付け\x1b[201~", first.state);
    expect(second.keys).toEqual([{ type: "paste", text: "貼り付け" }]);
  });

  it("貼り付けの終わりと後ろの文字を続けて読む", () => {
    const result = decode("\x1b[200~abc\x1b[201~xyz");
    expect(result.keys).toEqual([
      { type: "paste", text: "abc" },
      { type: "char", text: "xyz" },
    ]);
  });

  it("知らないエスケープの列は捨てる", () => {
    expect(decode("\x1b[99~").keys).toEqual([]);
    expect(decode("\x1b[?25l").keys).toEqual([]);
    expect(decode("\x1ba").keys).toEqual([]);
  });

  it("何もない chunk では状態を変えない", () => {
    const state = emptyDecoderState();
    expect(decode("", state).keys).toEqual([]);
    expect(decode("", state).state).toEqual(state);
  });
});
