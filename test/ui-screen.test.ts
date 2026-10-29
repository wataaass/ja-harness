import { describe, expect, it } from "vitest";
import { createScreen } from "../src/ui/screen.js";
import { stringWidth, stripAnsi } from "../src/ui/width.js";

function setup(columns = 20) {
  const output = {
    text: "",
    columns,
    write(s: string) {
      output.text += s;
    },
  };
  return { output, screen: createScreen(output) };
}

describe("createScreen", () => {
  it("下の領域を書いてカーソルを指定の位置へ動かす", () => {
    const { output, screen } = setup();
    screen.setBottom(["abc", "def"], { row: 1, col: 1 });
    expect(output.text).toBe("abc\r\ndef\r\x1b[1C");
  });

  it("描き直すときは前の下の領域を消す", () => {
    const { output, screen } = setup();
    screen.setBottom(["abc", "def"], { row: 1, col: 1 });
    output.text = "";
    screen.setBottom(["xy"]);
    expect(output.text).toBe("\x1b[1A\r\x1b[Jxy");
  });

  it("print は下の領域を消して履歴に書き、下の領域を戻す", () => {
    const { output, screen } = setup();
    screen.setBottom(["xy"]);
    output.text = "";
    screen.print(["hello", "world"]);
    expect(output.text).toBe("\r\x1b[Jhello\r\nworld\r\nxy");
  });

  it("幅を超える行は切り詰める", () => {
    const { output, screen } = setup(6);
    screen.setBottom(["あいうえお"]);
    expect(stripAnsi(output.text)).toContain("…");
    const first = stripAnsi(output.text).split("\r\n")[0] ?? "";
    expect(stringWidth(first)).toBeLessThanOrEqual(6);
  });

  it("resize で幅を読み直して描き直す", () => {
    const { output, screen } = setup(20);
    screen.setBottom(["あいうえおかきくけこ"]);
    output.text = "";
    output.columns = 6;
    screen.resize();
    const first = stripAnsi(output.text).split("\r\n")[0] ?? "";
    expect(stringWidth(first)).toBeLessThanOrEqual(6);
    expect(first).toContain("…");
  });

  it("clearBottom は下の領域を消す", () => {
    const { output, screen } = setup();
    screen.setBottom(["abc", "def"], { row: 0, col: 0 });
    output.text = "";
    screen.clearBottom();
    expect(output.text).toBe("\r\x1b[J");
  });

  it("close は下の領域を消してから改行して終える", () => {
    const { output, screen } = setup();
    screen.setBottom(["abc", "def"], { row: 0, col: 0 });
    output.text = "";
    screen.close();
    expect(output.text).toBe("\r\x1b[J\r\n");
  });
});
