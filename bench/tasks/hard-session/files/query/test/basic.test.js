import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../src/index.js";

const people = [
  { id: 1, name: "花子", age: 30, city: "東京" },
  { id: 2, name: "太郎", age: 20, city: "大阪" },
  { id: 3, name: "次郎", age: 40, city: "東京" },
];

test("全列をそのまま返す", () => {
  assert.deepEqual(query({ people }, "SELECT * FROM people"), people);
});

test("指定した列だけを返す", () => {
  assert.deepEqual(query({ people }, "SELECT name, age FROM people"), [
    { name: "花子", age: 30 },
    { name: "太郎", age: 20 },
    { name: "次郎", age: 40 },
  ]);
});

test("AS で別名を付けられる", () => {
  assert.deepEqual(query({ people }, "SELECT name AS label FROM people"), [
    { label: "花子" },
    { label: "太郎" },
    { label: "次郎" },
  ]);
});

test("数値の比較で絞り込む", () => {
  assert.deepEqual(query({ people }, "SELECT name FROM people WHERE age >= 30"), [
    { name: "花子" },
    { name: "次郎" },
  ]);
});

test("文字列の比較で絞り込む", () => {
  assert.deepEqual(
    query({ people }, "SELECT name FROM people WHERE city = '大阪'"),
    [{ name: "太郎" }],
  );
});

test("テーブル名つきの列を書ける", () => {
  assert.deepEqual(
    query({ people }, "SELECT people.name FROM people WHERE people.id = 2"),
    [{ name: "太郎" }],
  );
});

test("AND で2つの条件をつなぐ", () => {
  assert.deepEqual(
    query(
      { people },
      "SELECT id FROM people WHERE age >= 20 AND city = '東京'",
    ),
    [{ id: 1 }, { id: 3 }],
  );
});

test("キーワードの大文字小文字を区別しない", () => {
  assert.deepEqual(
    query({ people }, "select name from people where age = 20"),
    [{ name: "太郎" }],
  );
});

test("元の配列と行を書き換えない", () => {
  const tables = { people: people.map((row) => ({ ...row })) };
  const before = JSON.stringify(tables);
  const rows = query(tables, "SELECT * FROM people");
  rows[0].name = "changed";
  assert.equal(JSON.stringify(tables), before);
});

test("末尾のセミコロンを許す", () => {
  assert.equal(
    query({ people }, "SELECT name FROM people;").length,
    3,
  );
});

test("空のテーブルは空の配列", () => {
  assert.deepEqual(query({ empty: [] }, "SELECT * FROM empty"), []);
});

test("真偽値のリテラルを条件に使える", () => {
  const data = [
    { id: 1, active: true },
    { id: 2, active: false },
  ];
  assert.deepEqual(
    query({ data }, "SELECT id FROM data WHERE active = TRUE"),
    [{ id: 1 }],
  );
  assert.deepEqual(
    query({ data }, "SELECT id FROM data WHERE active = FALSE"),
    [{ id: 2 }],
  );
});

test("小数を比較できる", () => {
  const data = [{ v: 1.5 }, { v: 2.25 }, { v: 2.5 }];
  assert.deepEqual(
    query({ data }, "SELECT v FROM data WHERE v < 2.5"),
    [{ v: 1.5 }, { v: 2.25 }],
  );
});

test("列の順は指定した順になる", () => {
  const rows = query({ people }, "SELECT age, name FROM people WHERE id = 1");
  assert.deepEqual(Object.keys(rows[0]), ["age", "name"]);
});

test("行に無い列は null になる", () => {
  const data = [{ id: 1 }, { id: 2, memo: "x" }];
  assert.deepEqual(query({ data }, "SELECT id, memo FROM data"), [
    { id: 1, memo: null },
    { id: 2, memo: "x" },
  ]);
});

test("同じ別名は後ろの列で上書きする", () => {
  const data = [{ a: 1, b: 2 }];
  assert.deepEqual(query({ data }, "SELECT a AS v, b AS v FROM data"), [
    { v: 2 },
  ]);
});

test("空のテーブルでも WHERE は動く", () => {
  assert.deepEqual(
    query({ data: [] }, "SELECT * FROM data WHERE x = 1"),
    [],
  );
});

test("SELECT にリテラルを書ける", () => {
  assert.deepEqual(
    query({ people }, "SELECT id, 'fixed' AS label FROM people WHERE id = 1"),
    [{ id: 1, label: "fixed" }],
  );
});

test("改行を含む SQL を読める", () => {
  const sql = [
    "SELECT name",
    "FROM people",
    "WHERE age >= 20",
    "  AND city = '東京'",
  ].join("\n");
  assert.deepEqual(query({ people }, sql), [{ name: "花子" }, { name: "次郎" }]);
});

test("SELECT NULL は null を返す", () => {
  assert.deepEqual(
    query({ people }, "SELECT NULL AS value FROM people WHERE id = 1"),
    [{ value: null }],
  );
});

test("列名にアンダースコアを使える", () => {
  const data = [{ user_name: "a" }, { user_name: "b" }];
  assert.deepEqual(
    query({ data }, "SELECT user_name FROM data WHERE user_name = 'b'"),
    [{ user_name: "b" }],
  );
});

test("SELECT の列に式の別名を付けられる", () => {
  const data = [{ n: 2 }, { n: 4 }];
  assert.deepEqual(
    query({ data }, "SELECT n AS value FROM data WHERE n = 4"),
    [{ value: 4 }],
  );
});

test("同じ行を2回かけても結果は変わらない", () => {
  const sql = "SELECT name FROM people WHERE age >= 30 ORDER BY name";
  assert.deepEqual(query({ people }, sql), query({ people }, sql));
});
