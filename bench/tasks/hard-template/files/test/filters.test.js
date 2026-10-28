import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/index.js";

test("upper と lower", () => {
  assert.equal(render("{{ name | upper }}", { name: "Alice" }), "ALICE");
  assert.equal(render("{{ name | lower }}", { name: "Alice" }), "alice");
});

test("フィルターは左から順に掛かる", () => {
  assert.equal(
    render("{{ name | upper | truncate(3) }}", { name: "Alice" }),
    "ALI…",
  );
});

test("default は無い値と空文字に使う", () => {
  assert.equal(render("{{ a | default('x') }}", {}), "x");
  assert.equal(render("{{ a | default('x') }}", { a: null }), "x");
  assert.equal(render("{{ a | default('x') }}", { a: "" }), "x");
});

test("default は 0 と false を置き換えない", () => {
  assert.equal(render("{{ a | default('x') }}", { a: 0 }), "0");
  assert.equal(render("{{ a | default('x') }}", { a: false }), "false");
});

test("join は区切りを指定できる", () => {
  assert.equal(render("{{ xs | join(', ') }}", { xs: ["a", "b"] }), "a, b");
  assert.equal(render("{{ xs | join('-') }}", { xs: [1, 2, 3] }), "1-2-3");
});

test("join の区切りを省略するとカンマと空白", () => {
  assert.equal(render("{{ xs | join }}", { xs: ["a", "b"] }), "a, b");
});

test("truncate は長いときだけ切って … を付ける", () => {
  assert.equal(
    render("{{ title | truncate(5) }}", { title: "abcdefg" }),
    "abcde…",
  );
  assert.equal(
    render("{{ title | truncate(10) }}", { title: "abc" }),
    "abc",
  );
});

test("truncate(0) は先頭に … だけを残す", () => {
  assert.equal(render("{{ title | truncate(0) }}", { title: "abc" }), "…");
});

test("length は文字列・配列・オブジェクトの長さ", () => {
  assert.equal(render("{{ a | length }}", { a: "abc" }), "3");
  assert.equal(render("{{ a | length }}", { a: [1, 2] }), "2");
  assert.equal(render("{{ a | length }}", { a: { x: 1, y: 2 } }), "2");
});

test("trim は前後の空白を落とす", () => {
  assert.equal(render("[{{ a | trim }}]", { a: "  x  " }), "[x]");
});

test("replace はすべて置き換える", () => {
  assert.equal(
    render("{{ a | replace('a', 'b') }}", { a: "banana" }),
    "bbnbnb",
  );
});

test("capitalize は先頭だけを大文字にする", () => {
  assert.equal(render("{{ a | capitalize }}", { a: "ALICE" }), "Alice");
});

test("escape フィルターは明示的にエスケープする", () => {
  assert.equal(
    render("{{ a | escape }}", { a: "<b>" }),
    "&lt;b&gt;",
  );
});

test("default のあとに別のフィルターを続けられる", () => {
  assert.equal(
    render("{{ a | default('x') | upper }}", {}),
    "X",
  );
});

test("空の配列の join は空文字", () => {
  assert.equal(render("[{{ a | join(',') }}]", { a: [] }), "[]");
});

test("truncate は長さと同じなら切らない", () => {
  assert.equal(render("{{ a | truncate(3) }}", { a: "abc" }), "abc");
});

test("replace の置く文字は省略できる", () => {
  assert.equal(render("{{ a | replace('-') }}", { a: "a-b-c" }), "abc");
});

test("length は数では 0", () => {
  assert.equal(render("{{ a | length }}", { a: 42 }), "0");
});

test("capitalize は空文字でもエラーにしない", () => {
  assert.equal(render("[{{ a | capitalize }}]", { a: "" }), "[]");
});

test("join の結果も出力でエスケープされる", () => {
  assert.equal(
    render("{{ xs | join(',') }}", { xs: ["<a>", "<b>"] }),
    "&lt;a&gt;,&lt;b&gt;",
  );
});
