import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../src/index.js";

const sales = [
  { id: 1, city: "東京", kind: "a", amount: 100 },
  { id: 2, city: "大阪", kind: "a", amount: 50 },
  { id: 3, city: "東京", kind: "b", amount: 200 },
  { id: 4, city: "東京", kind: "a", amount: 300 },
  { id: 5, city: "大阪", kind: "b", amount: null },
];

test("集計だけなら全体を1つのグループにする", () => {
  assert.deepEqual(
    query({ sales }, "SELECT COUNT(*) AS n, SUM(amount) AS total FROM sales"),
    [{ n: 5, total: 650 }],
  );
});

test("COUNT(列) は NULL を数えない", () => {
  assert.deepEqual(
    query({ sales }, "SELECT COUNT(amount) AS n FROM sales"),
    [{ n: 4 }],
  );
});

test("AVG・MIN・MAX は NULL を無視する", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT AVG(amount) AS avg, MIN(amount) AS min, MAX(amount) AS max FROM sales",
    ),
    [{ avg: 162.5, min: 50, max: 300 }],
  );
});

test("GROUP BY でまとめる", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, COUNT(*) AS n, SUM(amount) AS total FROM sales GROUP BY city",
    ),
    [
      { city: "東京", n: 3, total: 600 },
      { city: "大阪", n: 2, total: 50 },
    ],
  );
});

test("GROUP BY は複数の列を取れる", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, kind, COUNT(*) AS n FROM sales GROUP BY city, kind",
    ),
    [
      { city: "東京", kind: "a", n: 2 },
      { city: "大阪", kind: "a", n: 1 },
      { city: "東京", kind: "b", n: 1 },
      { city: "大阪", kind: "b", n: 1 },
    ],
  );
});

test("HAVING でグループを絞る", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, COUNT(*) AS n FROM sales GROUP BY city HAVING COUNT(*) > 2",
    ),
    [{ city: "東京", n: 3 }],
  );
});

test("HAVING は集計の結果で比べられる", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, SUM(amount) AS total FROM sales GROUP BY city HAVING SUM(amount) >= 100",
    ),
    [{ city: "東京", total: 600 }],
  );
});

test("ORDER BY で集計の別名を使える", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, SUM(amount) AS total FROM sales GROUP BY city ORDER BY total DESC",
    ),
    [
      { city: "東京", total: 600 },
      { city: "大阪", total: 50 },
    ],
  );
});

test("集計でも ORDER BY は NULL を最後に置く", () => {
  const data = [
    { g: "a", v: 1 },
    { g: "a", v: null },
    { g: "b", v: null },
    { g: "b", v: null },
  ];
  assert.deepEqual(
    query(
      { data },
      "SELECT g, AVG(v) AS avg FROM data GROUP BY g ORDER BY avg DESC",
    ),
    [
      { g: "a", avg: 1 },
      { g: "b", avg: null },
    ],
  );
});

test("空のテーブルで COUNT は0、SUM は null", () => {
  assert.deepEqual(
    query({ data: [] }, "SELECT COUNT(*) AS n, SUM(v) AS s FROM data"),
    [{ n: 0, s: null }],
  );
});

test("NULL もグループのキーになる", () => {
  const data = [
    { g: null, v: 1 },
    { g: null, v: 2 },
    { g: "a", v: 3 },
  ];
  assert.deepEqual(
    query({ data }, "SELECT g, SUM(v) AS s FROM data GROUP BY g"),
    [
      { g: null, s: 3 },
      { g: "a", s: 3 },
    ],
  );
});

test("GROUP BY にない列を出すとエラー", () => {
  assert.throws(
    () =>
      query(
        { sales },
        "SELECT city, kind, COUNT(*) AS n FROM sales GROUP BY city",
      ),
    /GROUP BY/,
  );
});

test("WHERE に集計関数を書くとエラー", () => {
  assert.throws(
    () => query({ sales }, "SELECT city FROM sales WHERE COUNT(*) > 1"),
    /WHERE/,
  );
});

test("数値でない列を SUM するとエラー", () => {
  assert.throws(
    () => query({ sales }, "SELECT SUM(city) AS total FROM sales"),
    /数値/,
  );
});

test("COUNT() はエラー", () => {
  assert.throws(
    () => query({ sales }, "SELECT COUNT() AS n FROM sales"),
    /COUNT/,
  );
});

test("WHERE で絞ってから集計する", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT COUNT(*) AS n, SUM(amount) AS total FROM sales WHERE city = '東京'",
    ),
    [{ n: 3, total: 600 }],
  );
});

test("文字列の MIN と MAX", () => {
  assert.deepEqual(
    query({ sales }, "SELECT MIN(city) AS min, MAX(city) AS max FROM sales"),
    [{ min: "大阪", max: "東京" }],
  );
});

test("HAVING で GROUP BY の列を使える", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, COUNT(*) AS n FROM sales GROUP BY city HAVING city = '大阪'",
    ),
    [{ city: "大阪", n: 2 }],
  );
});

test("GROUP BY が無くても HAVING に集計を書ける", () => {
  assert.deepEqual(
    query({ sales }, "SELECT COUNT(*) AS n FROM sales HAVING COUNT(*) > 100"),
    [],
  );
});

test("全部 NULL の COUNT(列) は0", () => {
  const data = [{ v: null }, { v: null }];
  assert.deepEqual(
    query({ data }, "SELECT COUNT(v) AS n FROM data"),
    [{ n: 0 }],
  );
});

test("GROUP BY の列を ORDER BY に使える", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, COUNT(*) AS n FROM sales GROUP BY city ORDER BY city DESC",
    ),
    [
      { city: "東京", n: 3 },
      { city: "大阪", n: 2 },
    ],
  );
});

test("ORDER BY に集計関数をそのまま書ける", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, COUNT(*) AS n FROM sales GROUP BY city ORDER BY COUNT(*) DESC",
    ),
    [
      { city: "東京", n: 3 },
      { city: "大阪", n: 2 },
    ],
  );
});

test("GROUP BY にテーブル名つきの列を書ける", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT sales.city, COUNT(*) AS n FROM sales GROUP BY sales.city",
    ),
    [
      { city: "東京", n: 3 },
      { city: "大阪", n: 2 },
    ],
  );
});

test("空のテーブルの SUM は null", () => {
  assert.deepEqual(
    query({ data: [] }, "SELECT SUM(v) AS s FROM data"),
    [{ s: null }],
  );
});

test("GROUP BY にない列を HAVING で使うとエラー", () => {
  assert.throws(
    () =>
      query(
        { sales },
        "SELECT city, COUNT(*) AS n FROM sales GROUP BY city HAVING kind = 'a'",
      ),
    /GROUP BY/,
  );
});

test("集計関数の入れ子はエラー", () => {
  assert.throws(
    () => query({ sales }, "SELECT SUM(COUNT(*)) AS x FROM sales"),
    /集計/,
  );
});

test("負の数を合計できる", () => {
  const data = [{ v: -5 }, { v: 3 }, { v: 2 }];
  assert.deepEqual(
    query({ data }, "SELECT SUM(v) AS total, AVG(v) AS avg FROM data"),
    [{ total: 0, avg: 0 }],
  );
});

test("WHERE と GROUP BY と HAVING を一緒に使う", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT kind, COUNT(*) AS n, SUM(amount) AS total FROM sales WHERE city = '東京' GROUP BY kind HAVING SUM(amount) > 300 ORDER BY kind",
    ),
    [{ kind: "a", n: 2, total: 400 }],
  );
});

test("2つの列でグループ化して片方で並べ替える", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, kind, COUNT(*) AS n FROM sales GROUP BY city, kind ORDER BY n DESC, city ASC",
    ),
    [
      { city: "東京", kind: "a", n: 2 },
      { city: "大阪", kind: "a", n: 1 },
      { city: "大阪", kind: "b", n: 1 },
      { city: "東京", kind: "b", n: 1 },
    ],
  );
});

test("HAVING で複数の集計を組み合わせる", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT city, COUNT(*) AS n FROM sales GROUP BY city HAVING COUNT(*) >= 2 AND SUM(amount) >= 50",
    ),
    [
      { city: "東京", n: 3 },
      { city: "大阪", n: 2 },
    ],
  );
});

test("COUNT(*) は WHERE の後ろの行を数える", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT COUNT(*) AS n FROM sales WHERE kind = 'b'",
    ),
    [{ n: 2 }],
  );
});

test("グループの件数と合計を同時に出す", () => {
  assert.deepEqual(
    query(
      { sales },
      "SELECT kind, COUNT(*) AS n, SUM(amount) AS total FROM sales GROUP BY kind ORDER BY kind",
    ),
    [
      { kind: "a", n: 3, total: 450 },
      { kind: "b", n: 2, total: 200 },
    ],
  );
});

test("1行だけのグループでも集計できる", () => {
  const data = [{ g: "x", v: 7 }];
  assert.deepEqual(
    query({ data }, "SELECT g, COUNT(*) AS n, SUM(v) AS s FROM data GROUP BY g"),
    [{ g: "x", n: 1, s: 7 }],
  );
});
