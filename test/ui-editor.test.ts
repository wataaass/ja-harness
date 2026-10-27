import { describe, expect, it } from "vitest";
import { applyKey, type EditorState, renderEditor } from "../src/ui/editor.js";

function state(text: string, cursor = [...text].length): EditorState {
  return { text, cursor };
}

describe("applyKey", () => {
  it("日本語の文字をカーソルの位置に入れる", () => {
    const first = applyKey(state("", 0), { type: "char", text: "日本" });
    expect(first).toEqual({
      state: { text: "日本", cursor: 2 },
    });

    const second = applyKey(
      { text: "あい", cursor: 1 },
      { type: "char", text: "う" },
    );
    expect(second.state).toEqual({ text: "あうい", cursor: 2 });
  });

  it("改行を入れる", () => {
    const result = applyKey({ text: "ab", cursor: 1 }, { type: "newline" });
    expect(result.state).toEqual({ text: "a\nb", cursor: 2 });
  });

  it("Enter は空白だけなら送信せず、文字があれば送信する", () => {
    expect(applyKey(state("   \n", 4), { type: "enter" })).toEqual({
      state: { text: "   \n", cursor: 4 },
    });
    expect(applyKey(state("こんにちは", 5), { type: "enter" })).toEqual({
      state: { text: "こんにちは", cursor: 5 },
      action: "submit",
    });
  });

  it("backspace と delete で文字を消す", () => {
    expect(
      applyKey({ text: "日本", cursor: 1 }, { type: "backspace" }),
    ).toEqual({ state: { text: "本", cursor: 0 } });
    expect(applyKey({ text: "日本", cursor: 0 }, { type: "delete" })).toEqual({
      state: { text: "本", cursor: 0 },
    });
    expect(applyKey(state("", 0), { type: "backspace" })).toEqual({
      state: { text: "", cursor: 0 },
    });
  });

  it("左右の矢印でカーソルを動かす", () => {
    expect(applyKey({ text: "あい", cursor: 1 }, { type: "left" })).toEqual({
      state: { text: "あい", cursor: 0 },
    });
    expect(applyKey({ text: "あい", cursor: 1 }, { type: "right" })).toEqual({
      state: { text: "あい", cursor: 2 },
    });
    expect(applyKey({ text: "あい", cursor: 0 }, { type: "left" })).toEqual({
      state: { text: "あい", cursor: 0 },
    });
  });

  it("行頭と行末は今の行の頭と末にする", () => {
    const base = { text: "あい\nうえお", cursor: 4 };
    expect(applyKey(base, { type: "home" })).toEqual({
      state: { text: "あい\nうえお", cursor: 3 },
    });
    expect(applyKey(base, { type: "end" })).toEqual({
      state: { text: "あい\nうえお", cursor: 6 },
    });
    expect(applyKey(base, { type: "ctrl", key: "a" })).toEqual({
      state: { text: "あい\nうえお", cursor: 3 },
    });
    expect(applyKey(base, { type: "ctrl", key: "e" })).toEqual({
      state: { text: "あい\nうえお", cursor: 6 },
    });
  });

  it("単語の単位でカーソルを動かす", () => {
    const base = { text: "foo bar baz", cursor: 11 };
    expect(applyKey(base, { type: "wordLeft" })).toEqual({
      state: { text: "foo bar baz", cursor: 8 },
    });
    expect(applyKey(base, { type: "wordRight" })).toEqual({
      state: { text: "foo bar baz", cursor: 11 },
    });
    expect(
      applyKey({ text: "foo bar baz", cursor: 0 }, { type: "wordRight" }),
    ).toEqual({ state: { text: "foo bar baz", cursor: 3 } });
  });

  it("Ctrl+W で前の単語を消す", () => {
    expect(
      applyKey({ text: "foo bar", cursor: 7 }, { type: "ctrl", key: "w" }),
    ).toEqual({ state: { text: "foo ", cursor: 4 } });
  });

  it("Ctrl+U と Ctrl+K で行の一部を消す", () => {
    const base = { text: "abc\ndef", cursor: 5 };
    expect(applyKey(base, { type: "ctrl", key: "u" })).toEqual({
      state: { text: "abc\nef", cursor: 4 },
    });
    expect(applyKey(base, { type: "ctrl", key: "k" })).toEqual({
      state: { text: "abc\nd", cursor: 5 },
    });
  });

  it("貼り付けの改行を \\n にそろえて入れる", () => {
    const result = applyKey(state("", 0), {
      type: "paste",
      text: "a\r\nb\rc",
    });
    expect(result.state).toEqual({ text: "a\nb\nc", cursor: 5 });
  });

  it("Ctrl+C は入力を消し、空なら取り消しにする", () => {
    expect(
      applyKey({ text: "abc", cursor: 2 }, { type: "ctrl", key: "c" }),
    ).toEqual({ state: { text: "", cursor: 0 } });
    expect(applyKey(state("", 0), { type: "ctrl", key: "c" })).toEqual({
      state: { text: "", cursor: 0 },
      action: "cancel",
    });
  });

  it("Ctrl+D は空なら終了を頼む", () => {
    expect(applyKey(state("", 0), { type: "ctrl", key: "d" })).toEqual({
      state: { text: "", cursor: 0 },
      action: "exit-request",
    });
    expect(
      applyKey({ text: "abc", cursor: 0 }, { type: "ctrl", key: "d" }),
    ).toEqual({ state: { text: "abc", cursor: 0 } });
  });

  it("操作のキーをそのまま action にする", () => {
    const base = { text: "abc", cursor: 3 };
    expect(applyKey(base, { type: "tab" }).action).toBe("tab");
    expect(applyKey(base, { type: "shiftTab" }).action).toBe("shift-tab");
    expect(applyKey(base, { type: "escape" }).action).toBe("escape");
    expect(applyKey(base, { type: "ctrl", key: "r" }).action).toBe("review");
    expect(applyKey(base, { type: "ctrl", key: "o" }).action).toBe("details");
    expect(applyKey(base, { type: "ctrl", key: "l" }).action).toBe("redraw");
  });

  it("複数行では上下で行を動かす", () => {
    const text = "abc\ndef";
    expect(applyKey({ text, cursor: 5 }, { type: "up" })).toEqual({
      state: { text, cursor: 1 },
    });
    expect(applyKey({ text, cursor: 1 }, { type: "down" })).toEqual({
      state: { text, cursor: 5 },
    });
  });

  it("先頭の行で上、最後の行で下なら履歴に切り替える", () => {
    const text = "abc\ndef";
    expect(applyKey({ text, cursor: 1 }, { type: "up" })).toEqual({
      state: { text, cursor: 1 },
      action: "history-prev",
    });
    expect(applyKey({ text, cursor: 6 }, { type: "down" })).toEqual({
      state: { text, cursor: 6 },
      action: "history-next",
    });
    expect(applyKey({ text: "abc", cursor: 0 }, { type: "up" }).action).toBe(
      "history-prev",
    );
    expect(applyKey({ text: "abc", cursor: 3 }, { type: "down" }).action).toBe(
      "history-next",
    );
  });
});

describe("renderEditor", () => {
  it("全角を幅2として折り返す", () => {
    expect(renderEditor({ text: "あいうえお", cursor: 5 }, 4)).toEqual({
      lines: ["あい", "うえ", "お"],
      cursorRow: 2,
      cursorCol: 2,
    });
  });

  it("改行を保って折り返す", () => {
    expect(renderEditor({ text: "ab\ncd", cursor: 4 }, 3)).toEqual({
      lines: ["ab", "cd"],
      cursorRow: 1,
      cursorCol: 1,
    });
  });

  it("折り返しの途中のカーソルを正しく出す", () => {
    expect(renderEditor({ text: "あいう", cursor: 1 }, 4)).toEqual({
      lines: ["あい", "う"],
      cursorRow: 0,
      cursorCol: 2,
    });
  });

  it("全角だけで幅が埋まるときも1行に収める", () => {
    expect(renderEditor({ text: "あい", cursor: 2 }, 4)).toEqual({
      lines: ["あい"],
      cursorRow: 0,
      cursorCol: 4,
    });
  });

  it("空の入力でも1行を返す", () => {
    expect(renderEditor({ text: "", cursor: 0 }, 10)).toEqual({
      lines: [""],
      cursorRow: 0,
      cursorCol: 0,
    });
  });
});
