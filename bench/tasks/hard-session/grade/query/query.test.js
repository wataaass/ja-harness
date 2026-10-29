import test from "node:test";
import assert from "node:assert/strict";
import { query, QueryError } from "../../query/src/index.js";

const users = [
  { id: 1, name: "Alice", city: "Tokyo", age: 30, score: 10 },
  { id: 2, name: "Bob", city: "Osaka", age: 20, score: null },
  { id: 3, name: "Cara", city: "Tokyo", age: 30, score: 30 },
  { id: 4, name: "Dan", city: "Osaka", age: null, score: 5 },
  { id: 5, name: "Eve", city: "Tokyo", age: 25, score: null },
];

function ids(sql, tables = { users }) {
  return query(tables, sql).map((row) => row.id);
}

test("SELECT * は全列を返す", () => {
  assert.deepEqual(query({ users }, "SELECT * FROM users"), users);
});

test("列と別名を指定できる", () => {
  assert.deepEqual(
    query({ users }, "SELECT id, name AS label FROM users WHERE id = 1"),
    [{ id: 1, label: "Alice" }],
  );
});

test("WHERE で数値と文字列を比べられる", () => {
  assert.deepEqual(ids("SELECT id FROM users WHERE age >= 25 AND city = 'Tokyo'"), [
    1, 3, 5,
  ]);
});

test("AND は OR より強く結びつく", () => {
  assert.deepEqual(
    ids("SELECT id FROM users WHERE city = 'Tokyo' OR city = 'Osaka' AND age = 20"),
    [1, 2, 3, 5],
  );
});

test("丸括弧と NOT で条件を組み立てられる", () => {
  assert.deepEqual(
    ids("SELECT id FROM users WHERE NOT (city = 'Tokyo' OR age = 20)"),
    [4],
  );
});

test("文字列内の '' はクォート1つになる", () => {
  const data = [{ name: "O'Brien" }, { name: "Smith" }];
  assert.deepEqual(
    query({ data }, "SELECT name FROM data WHERE name = 'O''Brien'"),
    [{ name: "O'Brien" }],
  );
});

test("NULL との = は偽", () => {
  assert.deepEqual(ids("SELECT id FROM users WHERE score = NULL"), []);
});

test("NULL との != も偽", () => {
  assert.deepEqual(ids("SELECT id FROM users WHERE score != 10"), [3, 4]);
});

test("NULL との大小比較は偽", () => {
  assert.deepEqual(ids("SELECT id FROM users WHERE score > 5"), [1, 3]);
});

test("ORDER BY の昇順では NULL が最後", () => {
  assert.deepEqual(ids("SELECT id FROM users ORDER BY score ASC"), [
    4, 1, 3, 2, 5,
  ]);
});

test("ORDER BY の降順でも NULL が最後", () => {
  assert.deepEqual(ids("SELECT id FROM users ORDER BY score DESC"), [
    3, 1, 4, 2, 5,
  ]);
});

test("複数の並べ替えキーを左から使う", () => {
  assert.deepEqual(ids("SELECT id FROM users ORDER BY city DESC, name ASC"), [
    1, 3, 5, 2, 4,
  ]);
});

test("SELECT の別名で並べ替えられる", () => {
  assert.deepEqual(
    ids("SELECT id, age AS years FROM users ORDER BY years ASC, id DESC"),
    [2, 5, 3, 1, 4],
  );
});

test("SELECT に無い列でも並べ替えられる", () => {
  assert.deepEqual(
    query({ users }, "SELECT name FROM users ORDER BY id DESC LIMIT 2"),
    [{ name: "Eve" }, { name: "Dan" }],
  );
});

test("LIMIT と OFFSET を一緒に使える", () => {
  assert.deepEqual(ids("SELECT id FROM users ORDER BY id LIMIT 2 OFFSET 1"), [
    2, 3,
  ]);
});

test("OFFSET を LIMIT より先に書ける", () => {
  assert.deepEqual(ids("SELECT id FROM users ORDER BY id OFFSET 1 LIMIT 2"), [
    2, 3,
  ]);
});

test("LIMIT 0 は空になる", () => {
  assert.deepEqual(query({ users }, "SELECT id FROM users LIMIT 0"), []);
});

test("OFFSET が行数より大きければ空になる", () => {
  assert.deepEqual(query({ users }, "SELECT id FROM users OFFSET 99"), []);
});

test("COUNT(*) は全行を数える", () => {
  assert.deepEqual(query({ users }, "SELECT COUNT(*) AS n FROM users"), [
    { n: 5 },
  ]);
});

test("COUNT(列) は NULL を数えない", () => {
  assert.deepEqual(query({ users }, "SELECT COUNT(score) AS n FROM users"), [
    { n: 3 },
  ]);
});

test("SUM と AVG は NULL を無視する", () => {
  assert.deepEqual(
    query({ users }, "SELECT SUM(score) AS total, AVG(score) AS average FROM users"),
    [{ total: 45, average: 15 }],
  );
});

test("MIN と MAX は数値でも文字列でも使える", () => {
  assert.deepEqual(
    query({ users }, "SELECT MIN(score) AS low, MAX(score) AS high FROM users"),
    [{ low: 5, high: 30 }],
  );
  assert.deepEqual(
    query({ users }, "SELECT MIN(city) AS first, MAX(city) AS last FROM users"),
    [{ first: "Osaka", last: "Tokyo" }],
  );
});

test("GROUP BY でグループごとに数える", () => {
  assert.deepEqual(
    query(
      { users },
      "SELECT city, COUNT(*) AS n FROM users GROUP BY city",
    ),
    [
      { city: "Tokyo", n: 3 },
      { city: "Osaka", n: 2 },
    ],
  );
});

test("GROUP BY と集計を組み合わせられる", () => {
  assert.deepEqual(
    query(
      { users },
      "SELECT city, COUNT(score) AS n, SUM(score) AS total, AVG(score) AS average FROM users GROUP BY city",
    ),
    [
      { city: "Tokyo", n: 2, total: 40, average: 20 },
      { city: "Osaka", n: 1, total: 5, average: 5 },
    ],
  );
});

test("複数の列でグループ化できる", () => {
  const data = [
    { dept: "a", role: "x", v: 1 },
    { dept: "a", role: "y", v: 2 },
    { dept: "b", role: "x", v: 3 },
    { dept: "a", role: "x", v: 4 },
  ];
  assert.deepEqual(
    query(
      { data },
      "SELECT dept, role, COUNT(*) AS n, SUM(v) AS total FROM data GROUP BY dept, role",
    ),
    [
      { dept: "a", role: "x", n: 2, total: 5 },
      { dept: "a", role: "y", n: 1, total: 2 },
      { dept: "b", role: "x", n: 1, total: 3 },
    ],
  );
});

test("HAVING は集計の結果でグループを絞る", () => {
  assert.deepEqual(
    query(
      { users },
      "SELECT city, COUNT(*) AS n FROM users GROUP BY city HAVING COUNT(*) >= 3",
    ),
    [{ city: "Tokyo", n: 3 }],
  );
});

test("HAVING で SUM を使える", () => {
  assert.deepEqual(
    query(
      { users },
      "SELECT city, SUM(score) AS total FROM users GROUP BY city HAVING SUM(score) > 10",
    ),
    [{ city: "Tokyo", total: 40 }],
  );
});

test("GROUP BY が無くても HAVING と集計を使える", () => {
  assert.deepEqual(
    query({ users }, "SELECT COUNT(*) AS n FROM users HAVING COUNT(*) > 10"),
    [],
  );
});

test("空のテーブルの集計は COUNT が0でほかは null", () => {
  assert.deepEqual(
    query(
      { data: [] },
      "SELECT COUNT(*) AS n, SUM(v) AS s, AVG(v) AS a, MIN(v) AS lo, MAX(v) AS hi FROM data",
    ),
    [{ n: 0, s: null, a: null, lo: null, hi: null }],
  );
});

test("NULL もグループのキーになる", () => {
  const data = [
    { g: null, v: 1 },
    { g: null, v: 2 },
    { g: "x", v: 3 },
  ];
  assert.deepEqual(
    query({ data }, "SELECT g, SUM(v) AS total FROM data GROUP BY g"),
    [
      { g: null, total: 3 },
      { g: "x", total: 3 },
    ],
  );
});

test("集計の既定の列名は関数名", () => {
  assert.deepEqual(
    query(
      { users },
      "SELECT COUNT(*), SUM(score), AVG(score), MIN(score), MAX(score) FROM users",
    ),
    [{ count: 5, sum: 45, avg: 15, min: 5, max: 30 }],
  );
});

test("無いテーブルは QueryError", () => {
  assert.throws(() => query({ users }, "SELECT * FROM missing"), QueryError);
});

test("無い列は QueryError", () => {
  assert.throws(() => query({ users }, "SELECT missing FROM users"), QueryError);
  assert.throws(
    () => query({ users }, "SELECT id FROM users WHERE missing = 1"),
    QueryError,
  );
});

test("WHERE の集計関数は QueryError", () => {
  assert.throws(
    () => query({ users }, "SELECT id FROM users WHERE COUNT(*) > 1"),
    QueryError,
  );
});

test("GROUP BY にない列の出力は QueryError", () => {
  assert.throws(
    () =>
      query(
        { users },
        "SELECT city, name, COUNT(*) AS n FROM users GROUP BY city",
      ),
    QueryError,
  );
});

test("SUM に数値でない列を渡すと QueryError", () => {
  assert.throws(
    () => query({ users }, "SELECT SUM(name) AS total FROM users"),
    QueryError,
  );
});

test("集計関数の入れ子は QueryError", () => {
  assert.throws(
    () => query({ users }, "SELECT SUM(COUNT(*)) AS x FROM users"),
    QueryError,
  );
});

test("LIMIT と OFFSET は0以上の整数だけ", () => {
  assert.throws(() => query({ users }, "SELECT id FROM users LIMIT -1"), QueryError);
  assert.throws(() => query({ users }, "SELECT id FROM users LIMIT 1.5"), QueryError);
  assert.throws(() => query({ users }, "SELECT id FROM users OFFSET -2"), QueryError);
});

test("使えない関数と COUNT() は QueryError", () => {
  assert.throws(() => query({ users }, "SELECT NOPE(id) AS x FROM users"), QueryError);
  assert.throws(() => query({ users }, "SELECT COUNT() AS n FROM users"), QueryError);
});

test("元のテーブルを書き換えない", () => {
  const data = [{ id: 1, name: "a" }];
  const before = JSON.stringify(data);
  const rows = query({ data }, "SELECT * FROM data");
  rows[0].name = "changed";
  assert.equal(JSON.stringify(data), before);
});
