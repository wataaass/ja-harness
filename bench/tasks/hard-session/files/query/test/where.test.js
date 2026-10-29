import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../src/index.js";

const rows = [
  { id: 1, a: 1, b: "x", note: null },
  { id: 2, a: 2, b: "x", note: 5 },
  { id: 3, a: 2, b: "y", note: null },
  { id: 4, a: 3, b: "y", note: 7 },
];

test("AND は OR より強く結びつく", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE a = 1 OR a = 2 AND b = 'y'"),
    [{ id: 1 }, { id: 3 }],
  );
});

test("丸括弧で優先順位を変えられる", () => {
  assert.deepEqual(
    query(
      { rows },
      "SELECT id FROM rows WHERE (a = 1 OR a = 2) AND b = 'x'",
    ),
    [{ id: 1 }, { id: 2 }],
  );
});

test("NOT は比較の結果を反転する", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE NOT a = 1"),
    [{ id: 2 }, { id: 3 }, { id: 4 }],
  );
});

test("文字列の中の '' は1つのクォート", () => {
  const data = [{ name: "O'Brien" }, { name: "Smith" }];
  assert.deepEqual(
    query({ data }, "SELECT name FROM data WHERE name = 'O''Brien'"),
    [{ name: "O'Brien" }],
  );
});

test("NULL との = は偽", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE note = NULL"),
    [],
  );
});

test("NULL との != も偽", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE note != 5"),
    [{ id: 4 }],
  );
});

test("NULL との大小比較は偽", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE note > 1"),
    [{ id: 2 }, { id: 4 }],
  );
});

test("NULL は比較以外の条件で偽になる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE note"),
    [{ id: 2 }, { id: 4 }],
  );
});

test("負の数と比較できる", () => {
  const data = [{ n: -3 }, { n: 0 }, { n: 2 }];
  assert.deepEqual(
    query({ data }, "SELECT n FROM data WHERE n >= -3"),
    [{ n: -3 }, { n: 0 }, { n: 2 }],
  );
});

test("文字列どうしは文字コード順で比べる", () => {
  const data = [{ s: "a" }, { s: "b" }, { s: "c" }];
  assert.deepEqual(
    query({ data }, "SELECT s FROM data WHERE s < 'c'"),
    [{ s: "a" }, { s: "b" }],
  );
});

test("OR を3つ以上つなげられる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE a = 1 OR a = 3 OR b = 'z'"),
    [{ id: 1 }, { id: 4 }],
  );
});

test("NOT と AND を組み合わせられる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE NOT (a = 2 AND b = 'x')"),
    [{ id: 1 }, { id: 3 }, { id: 4 }],
  );
});

test("SELECT で取り出した文字列にクォートを保つ", () => {
  const data = [{ name: "O'Brien" }];
  assert.equal(
    query({ data }, "SELECT name FROM data")[0].name,
    "O'Brien",
  );
});

test("NULL = NULL も偽", () => {
  const data = [{ id: 1, v: null }];
  assert.deepEqual(
    query({ data }, "SELECT id FROM data WHERE v = NULL"),
    [],
  );
});

test("数値と文字列が混ざる列でも比較できる", () => {
  const data = [{ v: 1 }, { v: 2 }, { v: 3 }];
  assert.deepEqual(
    query({ data }, "SELECT v FROM data WHERE v = 2.0"),
    [{ v: 2 }],
  );
});

test("丸括弧の入れ子を読める", () => {
  assert.deepEqual(
    query(
      { rows },
      "SELECT id FROM rows WHERE ((a = 1 OR a = 3) AND (b = 'x' OR b = 'y'))",
    ),
    [{ id: 1 }, { id: 4 }],
  );
});

test("条件が偽のリテラルなら空", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE FALSE"),
    [],
  );
});

test("NOT を2回重ねられる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE NOT NOT a = 1"),
    [{ id: 1 }],
  );
});

test("NULL リテラルを比較に使える", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE NULL = NULL"),
    [],
  );
});

test("文字列のエスケープと他の条件を組み合わせる", () => {
  const data = [
    { name: "O'Brien", city: "東京" },
    { name: "O'Brien", city: "大阪" },
    { name: "Smith", city: "東京" },
  ];
  assert.deepEqual(
    query(
      { data },
      "SELECT city FROM data WHERE name = 'O''Brien' AND city = '東京'",
    ),
    [{ city: "東京" }],
  );
});

test("比較の左右に列とリテラルを置ける", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows WHERE 3 = a"),
    [{ id: 4 }],
  );
});

test("AND と OR の組み合わせを丸括弧なしで読む", () => {
  assert.deepEqual(
    query(
      { rows },
      "SELECT id FROM rows WHERE a = 3 AND b = 'x' OR a = 1",
    ),
    [{ id: 1 }],
  );
});

test("否定した比較を AND でつなぐ", () => {
  assert.deepEqual(
    query(
      { rows },
      "SELECT id FROM rows WHERE NOT a = 1 AND b = 'y'",
    ),
    [{ id: 3 }, { id: 4 }],
  );
});
