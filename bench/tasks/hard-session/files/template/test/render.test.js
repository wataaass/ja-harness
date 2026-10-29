import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/index.js";

test("文字と変数をそのまま出す", () => {
  assert.equal(
    render("こんにちは {{ name }} さん", { name: "花子" }),
    "こんにちは 花子 さん",
  );
});

test("ドットで中をたどる", () => {
  assert.equal(
    render("{{ user.profile.name }}", {
      user: { profile: { name: "太郎" } },
    }),
    "太郎",
  );
});

test("無い名前は空文字になる", () => {
  assert.equal(render("[{{ missing }}]", {}), "[]");
  assert.equal(render("[{{ user.name }}]", { user: {} }), "[]");
  assert.equal(render("[{{ user.name }}]", {}), "[]");
});

test("数と真偽値を出す", () => {
  assert.equal(
    render("{{ count }} {{ ok }}", { count: 3, ok: true }),
    "3 true",
  );
});

test("配列はカンマでつなぐ", () => {
  assert.equal(render("{{ tags }}", { tags: ["a", "b"] }), "a, b");
});

test("null と undefined は空文字", () => {
  assert.equal(render("[{{ a }}][{{ b }}]", { a: null }), "[][]");
});

test("変数は HTML をエスケープする", () => {
  assert.equal(
    render("{{ text }}", { text: '<b>&"\'' }),
    "&lt;b&gt;&amp;&quot;&#39;",
  );
});

test("safe を通すとエスケープしない", () => {
  assert.equal(
    render("{{ text | safe }}", { text: "<b>太字</b>" }),
    "<b>太字</b>",
  );
});

test("escape を切るとエスケープしない", () => {
  assert.equal(
    render("{{ text }}", { text: "<b>" }, { escape: false }),
    "<b>",
  );
});

test("safe の値を二重にエスケープしない", () => {
  assert.equal(
    render("{{ text | safe | escape }}", { text: "<b>" }),
    "&lt;b&gt;",
  );
});

test("テンプレートが文字列でなければエラー", () => {
  assert.throws(() => render(123, {}), TypeError);
});

test("オブジェクトは JSON をエスケープして出す", () => {
  assert.equal(render("{{ o }}", { o: { a: 1 } }), "{&quot;a&quot;:1}");
});

test("同じ変数を何度でも使える", () => {
  assert.equal(
    render("{{ a }}-{{ a }}-{{ a }}", { a: "x" }),
    "x-x-x",
  );
});

test("文字の空白と改行はそのまま残す", () => {
  assert.equal(render("a\n b\tc\n", {}), "a\n b\tc\n");
});

test("変数の印でも空白を調整できる", () => {
  assert.equal(render("A\n{{- a -}}\nB", { a: "x" }), "AxB");
});

test("data を省略できる", () => {
  assert.equal(render("[{{ a }}]"), "[]");
});

test("数はそのまま、0 も出す", () => {
  assert.equal(render("[{{ n }}]", { n: 0 }), "[0]");
});

test("深い場所の配列もたどれる", () => {
  assert.equal(
    render("{{ a.b }}", { a: { b: ["x", "y"] } }),
    "x, y",
  );
});

test("safe を通した配列は文字のまま出る", () => {
  assert.equal(
    render("{{ xs | join(', ') | safe }}", { xs: ["<a>", "<b>"] }),
    "<a>, <b>",
  );
});
