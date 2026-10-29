import test from "node:test";
import assert from "node:assert/strict";
import { render, TemplateError } from "../../template/src/index.js";

test("変数を出す", () => {
  assert.equal(render("{{ name }}", { name: "花子" }), "花子");
});

test("ドットで深い値までたどる", () => {
  assert.equal(
    render("{{ a.b.c }}", { a: { b: { c: 7 } } }),
    "7",
  );
});

test("無い名前は空文字", () => {
  assert.equal(render("[{{ a.b }}]", {}), "[]");
  assert.equal(render("[{{ a.b }}]", { a: null }), "[]");
});

test("数・真偽値・null の表示", () => {
  assert.equal(
    render("{{ n }} {{ t }} {{ f }} {{ z }}", {
      n: 1.5,
      t: true,
      f: false,
      z: null,
    }),
    "1.5 true false ",
  );
});

test("配列はカンマでつなぐ", () => {
  assert.equal(render("{{ xs }}", { xs: [1, "a"] }), "1, a");
});

test("オブジェクトは JSON で出す", () => {
  assert.equal(render("{{ o }}", { o: { a: 1 } }), "{&quot;a&quot;:1}");
});

test("if は真偽で切り替える", () => {
  assert.equal(render("{% if a %}Y{% endif %}", { a: 1 }), "Y");
  assert.equal(render("{% if a %}Y{% endif %}", { a: 0 }), "");
});

test("elif と else は上から順に選ぶ", () => {
  const t = "{% if n == 1 %}一{% elif n == 2 %}二{% else %}他{% endif %}";
  assert.equal(render(t, { n: 1 }), "一");
  assert.equal(render(t, { n: 2 }), "二");
  assert.equal(render(t, { n: 9 }), "他");
});

test("比較の演算子をすべて使える", () => {
  assert.equal(render("{% if a < b %}1{% endif %}", { a: 1, b: 2 }), "1");
  assert.equal(render("{% if a <= b %}2{% endif %}", { a: 2, b: 2 }), "2");
  assert.equal(render("{% if a > b %}3{% endif %}", { a: 3, b: 2 }), "3");
  assert.equal(render("{% if a >= b %}4{% endif %}", { a: 3, b: 3 }), "4");
  assert.equal(render("{% if a != b %}5{% endif %}", { a: 1, b: 2 }), "5");
});

test("and / or / not が動く", () => {
  assert.equal(render("{% if a and b %}Y{% endif %}", { a: 1, b: 1 }), "Y");
  assert.equal(render("{% if a or b %}Y{% endif %}", { a: 0, b: 1 }), "Y");
  assert.equal(render("{% if not a %}Y{% endif %}", { a: 0 }), "Y");
});

test("かっこで条件をまとめる", () => {
  assert.equal(
    render("{% if (a or b) and c %}Y{% endif %}", {
      a: false,
      b: true,
      c: true,
    }),
    "Y",
  );
});

test("空の配列・オブジェクト・文字列は偽", () => {
  const t = "{% if a %}Y{% else %}N{% endif %}";
  assert.equal(render(t, { a: [] }), "N");
  assert.equal(render(t, { a: {} }), "N");
  assert.equal(render(t, { a: "" }), "N");
  assert.equal(render(t, { a: "0" }), "Y");
  assert.equal(render(t, { a: -1 }), "Y");
});

test("for は順番に出す", () => {
  assert.equal(
    render("{% for x in xs %}[{{ x }}]{% endfor %}", { xs: ["a", "b"] }),
    "[a][b]",
  );
});

test("loop の番号が使える", () => {
  assert.equal(
    render("{% for x in xs %}{{ loop.index }}/{{ loop.index0 }}/{{ loop.length }};{% endfor %}", {
      xs: ["a", "b", "c"],
    }),
    "1/0/3;2/1/3;3/2/3;",
  );
});

test("loop.first と loop.last が使える", () => {
  assert.equal(
    render("{% for x in xs %}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %}{{ x }}{% endfor %}", {
      xs: ["a", "b", "c"],
    }),
    "FabLc",
  );
});

test("空の配列では else を出す", () => {
  assert.equal(
    render("{% for x in xs %}{{ x }}{% else %}空{% endfor %}", { xs: [] }),
    "空",
  );
});

test("for は入れ子にできる", () => {
  assert.equal(
    render(
      "{% for x in xs %}{% for y in x %}{{ y }}{% endfor %}|{% endfor %}",
      { xs: [[1, 2], [3]] },
    ),
    "12|3|",
  );
});

test("for の値が無ければ else を出す", () => {
  assert.equal(
    render("{% for x in xs %}{{ x }}{% else %}無{% endfor %}", {}),
    "無",
  );
});

test("for の値が配列でなければエラー", () => {
  assert.throws(
    () => render("{% for x in xs %}{{ x }}{% endfor %}", { xs: "abc" }),
    TemplateError,
  );
});

test("upper と lower と連鎖", () => {
  assert.equal(render("{{ a | upper }}", { a: "ab" }), "AB");
  assert.equal(render("{{ a | lower }}", { a: "AB" }), "ab");
  assert.equal(
    render("{{ a | lower | capitalize }}", { a: "ALICE" }),
    "Alice",
  );
});

test("default は無い値だけを置き換える", () => {
  assert.equal(render("{{ a | default('x') }}", {}), "x");
  assert.equal(render("{{ a | default('x') }}", { a: null }), "x");
  assert.equal(render("{{ a | default('x') }}", { a: "" }), "x");
  assert.equal(render("{{ a | default('x') }}", { a: 0 }), "0");
  assert.equal(render("{{ a | default('x') }}", { a: false }), "false");
});

test("join は区切りを変えられる", () => {
  assert.equal(render("{{ a | join }}", { a: ["x", "y"] }), "x, y");
  assert.equal(render("{{ a | join(' / ') }}", { a: [1, 2] }), "1 / 2");
});

test("truncate は長いときだけ切る", () => {
  assert.equal(render("{{ a | truncate(3) }}", { a: "abcdef" }), "abc…");
  assert.equal(render("{{ a | truncate(10) }}", { a: "abc" }), "abc");
  assert.equal(render("{{ a | truncate(0) }}", { a: "abc" }), "…");
});

test("length は型ごとの長さ", () => {
  assert.equal(render("{{ a | length }}", { a: "abcd" }), "4");
  assert.equal(render("{{ a | length }}", { a: [1, 2, 3] }), "3");
  assert.equal(render("{{ a | length }}", { a: { x: 1 } }), "1");
});

test("trim / replace / capitalize", () => {
  assert.equal(render("[{{ a | trim }}]", { a: "  a  " }), "[a]");
  assert.equal(render("{{ a | replace('a', 'z') }}", { a: "aba" }), "zbz");
  assert.equal(render("{{ a | capitalize }}", { a: "JOHN" }), "John");
});

test("safe はエスケープを止める", () => {
  assert.equal(
    render("{{ a | safe }}", { a: "<i>x</i>" }),
    "<i>x</i>",
  );
});

test("escape は1回だけエスケープする", () => {
  assert.equal(render("{{ a }}", { a: "<b>" }), "&lt;b&gt;");
  assert.equal(render("{{ a | escape }}", { a: "<b>" }), "&lt;b&gt;");
  assert.equal(
    render("{{ a | safe | escape }}", { a: "<b>" }),
    "&lt;b&gt;",
  );
});

test("escape: false で自動エスケープを切る", () => {
  assert.equal(
    render("{{ a }}", { a: "<b>" }, { escape: false }),
    "<b>",
  );
});

test("include は同じ変数を使って差し込む", () => {
  assert.equal(
    render(
      'A{% include "p" %}B',
      { name: "花子" },
      { templates: { p: "{{ name }}" } },
    ),
    "A花子B",
  );
});

test("for の中の include は loop を見られる", () => {
  assert.equal(
    render(
      '{% for item in xs %}{% include "row" %}{% endfor %}',
      { xs: ["a", "b"] },
      { templates: { row: "{{ loop.index }}{{ item }}" } },
    ),
    "1a2b",
  );
});

test("無い include は名前つきのエラー", () => {
  assert.throws(
    () => render('{% include "missing" %}', {}),
    (error) =>
      error instanceof TemplateError && error.message.includes("missing"),
  );
});

test("include の深さの上限", () => {
  const templates = { b: '{% include "a" %}', a: "x" };
  assert.throws(
    () =>
      render('{% include "b" %}', {}, { templates, maxIncludeDepth: 1 }),
    TemplateError,
  );
  assert.equal(
    render('{% include "b" %}', {}, { templates, maxIncludeDepth: 2 }),
    "x",
  );
});

test("空白の調整が効く", () => {
  assert.equal(
    render("A\n{%- if ok -%}\nB\n{%- endif -%}\nC", { ok: true }),
    "ABC",
  );
  assert.equal(render("A\n{{- a -}}\nB", { a: "x" }), "AxB");
});

test("空白の調整をしなければ残る", () => {
  assert.equal(
    render("A\n{% if ok %}\nB\n{% endif %}\nC", { ok: true }),
    "A\n\nB\n\nC",
  );
});

test("閉じていない印は行番号つき", () => {
  assert.throws(
    () => render("a\nb {{ x ", {}),
    (error) => error instanceof TemplateError && error.line === 2,
  );
});

test("endif と endfor が無ければ行番号つき", () => {
  assert.throws(
    () => render("a\n{% if x %}", { x: 1 }),
    (error) =>
      error instanceof TemplateError &&
      error.line === 2 &&
      error.message.includes("行 2"),
  );
  assert.throws(
    () => render("{% for x in xs %}{{ x }}", { xs: [] }),
    (error) =>
      error instanceof TemplateError && error.message.includes("endfor"),
  );
});

test("知らないタグとフィルターは行番号つき", () => {
  assert.throws(
    () => render("{% nope %}", {}),
    (error) => error instanceof TemplateError && error.line === 1,
  );
  assert.throws(
    () => render("a\n{{ x | nope }}", { x: 1 }),
    (error) =>
      error instanceof TemplateError &&
      error.line === 2 &&
      error.message.includes("nope"),
  );
});

test("for の形・include の名前・フィルターの引数は検査する", () => {
  assert.throws(() => render("{% for x %}{% endfor %}", {}), TemplateError);
  assert.throws(
    () => render('{% include name %}', { name: "p" }),
    TemplateError,
  );
  assert.throws(
    () => render("{{ x | truncate('a') }}", { x: "abc" }),
    TemplateError,
  );
  assert.throws(
    () => render("{{ x | join(', ') }}", { x: "abc" }),
    TemplateError,
  );
});
