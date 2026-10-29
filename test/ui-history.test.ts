import { describe, expect, it } from "vitest";
import { createHistory } from "../src/ui/history.js";

describe("createHistory", () => {
  it("前の入力と次の入力をたどる", () => {
    const history = createHistory();
    history.push("一つ目");
    history.push("二つ目");

    expect(history.prev("書きかけ")).toBe("二つ目");
    expect(history.prev("書きかけ")).toBe("一つ目");
    expect(history.prev("書きかけ")).toBe("一つ目");
    expect(history.next()).toBe("二つ目");
    expect(history.next()).toBe("書きかけ");
    expect(history.next()).toBe("書きかけ");
  });

  it("続けて同じ入力は足さない", () => {
    const history = createHistory();
    history.push("同じ");
    history.push("同じ");
    history.push("次");

    expect(history.prev("")).toBe("次");
    expect(history.prev("")).toBe("同じ");
    expect(history.prev("")).toBe("同じ");
  });

  it("たどる途中で今の入力を残す", () => {
    const history = createHistory();
    history.push("前");

    expect(history.prev("途中")).toBe("前");
    expect(history.next()).toBe("途中");
  });

  it("上限を超えたら古い入力を捨てる", () => {
    const history = createHistory(2);
    history.push("一");
    history.push("二");
    history.push("三");

    expect(history.prev("")).toBe("三");
    expect(history.prev("")).toBe("二");
    expect(history.prev("")).toBe("二");
  });

  it("入力がなければ今の入力をそのまま返す", () => {
    const history = createHistory();
    expect(history.prev("そのまま")).toBe("そのまま");
    expect(history.next()).toBe("");
  });

  it("新しく送るとたどる位置を戻す", () => {
    const history = createHistory();
    history.push("前");
    expect(history.prev("途中")).toBe("前");
    history.push("新");
    expect(history.prev("今")).toBe("新");
  });
});
