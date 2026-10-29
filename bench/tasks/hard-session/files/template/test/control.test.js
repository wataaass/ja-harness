import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../src/index.js";

test("if は真のときだけ出す", () => {
  assert.equal(render("{% if ok %}yes{% endif %}", { ok: true }), "yes");
  assert.equal(render("{% if ok %}yes{% endif %}", { ok: false }), "");
});

test("else と elif を順に見る", () => {
  const template =
    "{% if n > 10 %}大{% elif n > 5 %}中{% else %}小{% endif %}";
  assert.equal(render(template, { n: 11 }), "大");
  assert.equal(render(template, { n: 7 }), "中");
  assert.equal(render(template, { n: 1 }), "小");
});

test("比較と and / or / not", () => {
  assert.equal(
    render("{% if a == 1 and b == 2 %}ok{% endif %}", { a: 1, b: 2 }),
    "ok",
  );
  assert.equal(
    render("{% if a == 1 or b == 2 %}ok{% endif %}", { a: 0, b: 2 }),
    "ok",
  );
  assert.equal(render("{% if not a %}none{% endif %}", { a: 0 }), "none");
});

test("空の値は偽として扱う", () => {
  assert.equal(render("{% if a %}yes{% else %}no{% endif %}", { a: [] }), "no");
  assert.equal(
    render("{% if a %}yes{% else %}no{% endif %}", { a: {} }),
    "no",
  );
  assert.equal(
    render("{% if a %}yes{% else %}no{% endif %}", { a: "0" }),
    "yes",
  );
});

test("かっこで条件をまとめる", () => {
  assert.equal(
    render("{% if (a or b) and c %}ok{% endif %}", {
      a: false,
      b: true,
      c: true,
    }),
    "ok",
  );
});

test("for は配列を順に出す", () => {
  assert.equal(
    render("{% for x in xs %}[{{ x }}]{% endfor %}", { xs: ["a", "b"] }),
    "[a][b]",
  );
});

test("loop の番号と端が使える", () => {
  const template =
    "{% for x in xs %}{{ loop.index }}{{ loop.index0 }}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %}{% endfor %}";
  assert.equal(render(template, { xs: ["a", "b", "c"] }), "10F2132L");
});

test("loop.length を使える", () => {
  assert.equal(
    render("{% for x in xs %}{{ loop.length }}{% endfor %}", {
      xs: ["a", "b"],
    }),
    "22",
  );
});

test("空の配列は else を出す", () => {
  assert.equal(
    render("{% for x in xs %}{{ x }}{% else %}空{% endfor %}", { xs: [] }),
    "空",
  );
});

test("for の中でも外の変数が見える", () => {
  assert.equal(
    render("{% for x in xs %}{{ prefix }}{{ x }}{% endfor %}", {
      xs: [1, 2],
      prefix: "-",
    }),
    "-1-2",
  );
});

test("for は入れ子にできる", () => {
  assert.equal(
    render(
      "{% for x in xs %}{% for y in x %}{{ y }}{% endfor %}{% endfor %}",
      { xs: [[1, 2], [3]] },
    ),
    "123",
  );
});

test("for の値が配列でなければエラー", () => {
  assert.throws(() => render("{% for x in a %}{{ x }}{% endfor %}", { a: 1 }));
});

test("文字の比較は文字の順で行う", () => {
  assert.equal(
    render("{% if a > b %}Y{% else %}N{% endif %}", { a: "b", b: "a" }),
    "Y",
  );
});

test("配列どうしも中身で比べる", () => {
  assert.equal(
    render("{% if a == b %}Y{% else %}N{% endif %}", {
      a: [1, 2],
      b: [1, 2],
    }),
    "Y",
  );
});

test("for の中のオブジェクトの値もたどれる", () => {
  assert.equal(
    render("{% for x in xs %}{{ x.name }};{% endfor %}", {
      xs: [{ name: "a" }, { name: "b" }],
    }),
    "a;b;",
  );
});

test("入れ子の for でも loop が使える", () => {
  assert.equal(
    render(
      "{% for x in xs %}{% for y in x %}{{ loop.index }}{{ y }}{% endfor %}{% endfor %}",
      { xs: [[1, 2], [3]] },
    ),
    "112213",
  );
});

test("偽で else が無ければ何も出さない", () => {
  assert.equal(render("A{% if ok %}Y{% endif %}B", { ok: false }), "AB");
});

test("not は空の配列にも効く", () => {
  assert.equal(
    render("{% if not a %}empty{% endif %}", { a: [] }),
    "empty",
  );
});

test("深い名前を条件に使える", () => {
  assert.equal(
    render("{% if a.b.c %}Y{% else %}N{% endif %}", {
      a: { b: { c: 1 } },
    }),
    "Y",
  );
});
