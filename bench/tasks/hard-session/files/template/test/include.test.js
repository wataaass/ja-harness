import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/index.js";

test("include は部分テンプレートを差し込む", () => {
  assert.equal(
    render('A{% include "part" %}B', {}, { templates: { part: "-" } }),
    "A-B",
  );
});

test("include の中でも同じ変数が見える", () => {
  assert.equal(
    render(
      '{% include "hello" %}',
      { name: "花子" },
      { templates: { hello: "こんにちは {{ name }}" } },
    ),
    "こんにちは 花子",
  );
});

test("for の中の include では loop も見える", () => {
  const templates = { row: "{{ loop.index }}:{{ item }} " };
  assert.equal(
    render('{% for item in xs %}{% include "row" %}{% endfor %}', {
      xs: ["a", "b"],
    }, { templates }),
    "1:a 2:b ",
  );
});

test("無い include はエラー", () => {
  assert.throws(
    () => render('{% include "nope" %}', {}),
    /nope/,
  );
});

test("include の深さの上限を超えるとエラー", () => {
  const templates = {
    b: '{% include "a" %}',
    a: "A",
  };
  assert.throws(
    () =>
      render('{% include "b" %}', {}, { templates, maxIncludeDepth: 1 }),
    /深すぎ/,
  );
  assert.equal(
    render('{% include "b" %}', {}, { templates, maxIncludeDepth: 2 }),
    "A",
  );
});

test("{%- と -%} は前後の空白を落とす", () => {
  const template = "A\n{%- if ok -%}\nB\n{%- endif -%}\nC";
  assert.equal(render(template, { ok: true }), "ABC");
});

test("- を付けなければ空白は残る", () => {
  const template = "A\n{% if ok %}\nB\n{% endif %}\nC";
  assert.equal(render(template, { ok: true }), "A\n\nB\n\nC");
});

test("閉じていないタグは行番号つきのエラー", () => {
  assert.throws(
    () => render("a\nb {{ name ", { name: "x" }),
    (error) => error.name === "TemplateError" && error.line === 2,
  );
});

test("endif が無ければエラー", () => {
  assert.throws(
    () => render("a\n{% if ok %}", { ok: true }),
    (error) => error.name === "TemplateError" && error.line === 2,
  );
});

test("endfor が無ければエラー", () => {
  assert.throws(
    () => render("{% for x in xs %}{{ x }}", { xs: [1] }),
    /endfor/,
  );
});

test("知らないタグはエラー", () => {
  assert.throws(() => render("{% nope %}", {}), /nope/);
});

test("知らないフィルターは行番号つきのエラー", () => {
  assert.throws(
    () => render("a\n{{ x | nope }}", { x: 1 }),
    (error) => error.name === "TemplateError" && error.line === 2,
  );
});

test("include は入れ子にできる", () => {
  const templates = {
    outer: '{% include "inner" %}!',
    inner: "{{ name }}",
  };
  assert.equal(
    render('{% include "outer" %}', { name: "花子" }, { templates }),
    "花子!",
  );
});

test("maxIncludeDepth が 0 なら include できない", () => {
  assert.throws(
    () =>
      render('{% include "p" %}', {}, { templates: { p: "x" }, maxIncludeDepth: 0 }),
    /深すぎ/,
  );
});

test("無い include は行番号も持つ", () => {
  assert.throws(
    () => render('a\n{% include "nope" %}', {}),
    (error) =>
      error.name === "TemplateError" &&
      error.line === 2 &&
      error.message.includes("nope"),
  );
});

test("テンプレートを渡さなければ include はエラー", () => {
  assert.throws(() => render('{% include "p" %}', {}), /p/);
});

test("空白の調整はタグと変数の両方に使える", () => {
  const template = "A\n{{- a -}}\n{%- if ok -%}\nB\n{%- endif -%}\n";
  assert.equal(render(template, { a: "x", ok: true }), "AxB");
});
