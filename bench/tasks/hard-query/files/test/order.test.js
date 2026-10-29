import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../src/index.js";

const rows = [
  { id: 1, name: "c", score: 20 },
  { id: 2, name: "a", score: 10 },
  { id: 3, name: "b", score: 20 },
  { id: 4, name: "d", score: null },
];

test("ORDER BY は既定で昇順", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY score").map((row) => row.id),
    [2, 1, 3, 4],
  );
});

test("DESC で降順", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY score DESC").map((row) => row.id),
    [1, 3, 2, 4],
  );
});

test("複数のキーを左から比べる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY score DESC, name ASC").map(
      (row) => row.id,
    ),
    [3, 1, 2, 4],
  );
});

test("NULL は昇順でも最後", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY score ASC").map((row) => row.id),
    [2, 1, 3, 4],
  );
});

test("NULL は降順でも最後", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY score DESC").map((row) => row.id),
    [1, 3, 2, 4],
  );
});

test("SELECT の別名で並べ替えられる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id, score AS value FROM rows ORDER BY value"),
    [
      { id: 2, value: 10 },
      { id: 1, value: 20 },
      { id: 3, value: 20 },
      { id: 4, value: null },
    ],
  );
});

test("LIMIT で件数を絞る", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY id LIMIT 2"),
    [{ id: 1 }, { id: 2 }],
  );
});

test("OFFSET で先頭を飛ばす", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY id LIMIT 2 OFFSET 1"),
    [{ id: 2 }, { id: 3 }],
  );
});

test("LIMIT 0 は空", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY id LIMIT 0"),
    [],
  );
});

test("OFFSET だけでもよい", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY id OFFSET 3"),
    [{ id: 4 }],
  );
});

test("並べ替えは安定", () => {
  const data = [
    { id: 1, key: "a" },
    { id: 2, key: "a" },
    { id: 3, key: "a" },
  ];
  assert.deepEqual(
    query({ data }, "SELECT id FROM data ORDER BY key").map((row) => row.id),
    [1, 2, 3],
  );
});

test("文字列を降順で並べる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT name FROM rows ORDER BY name DESC").map(
      (row) => row.name,
    ),
    ["d", "c", "b", "a"],
  );
});

test("SELECT に無い列でも並べ替えられる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY score DESC").map(
      (row) => row.id,
    ),
    [1, 3, 2, 4],
  );
});

test("LIMIT が行数より大きくても全部返す", () => {
  assert.equal(
    query({ rows }, "SELECT id FROM rows LIMIT 100").length,
    4,
  );
});

test("OFFSET が行数より大きければ空", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows OFFSET 100"),
    [],
  );
});

test("OFFSET を LIMIT より先に書ける", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY id OFFSET 1 LIMIT 2"),
    [{ id: 2 }, { id: 3 }],
  );
});

test("並べ替えのキーが同じなら元の順を保つ", () => {
  const data = [
    { id: 1, k: 1 },
    { id: 2, k: 2 },
    { id: 3, k: 1 },
  ];
  assert.deepEqual(
    query({ data }, "SELECT id FROM data ORDER BY k DESC").map(
      (row) => row.id,
    ),
    [2, 1, 3],
  );
});

test("別名を DESC で並べ替えられる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id, name AS label FROM rows ORDER BY label DESC"),
    [
      { id: 4, label: "d" },
      { id: 1, label: "c" },
      { id: 3, label: "b" },
      { id: 2, label: "a" },
    ],
  );
});

test("テーブル名つきの列で並べ替えられる", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY rows.id DESC LIMIT 2"),
    [{ id: 4 }, { id: 3 }],
  );
});

test("複数のキーで NULL の位置が決まる", () => {
  const data = [
    { id: 1, a: null, b: 2 },
    { id: 2, a: 1, b: null },
    { id: 3, a: 1, b: 1 },
  ];
  assert.deepEqual(
    query({ data }, "SELECT id FROM data ORDER BY a ASC, b ASC").map(
      (row) => row.id,
    ),
    [3, 2, 1],
  );
});

test("LIMIT 0 と OFFSET を一緒に使える", () => {
  assert.deepEqual(
    query({ rows }, "SELECT id FROM rows ORDER BY id LIMIT 0 OFFSET 2"),
    [],
  );
});

test("NULL だけの列を並べ替えても落ちない", () => {
  const data = [{ id: 1, v: null }, { id: 2, v: null }];
  assert.deepEqual(
    query({ data }, "SELECT id FROM data ORDER BY v DESC").map((row) => row.id),
    [1, 2],
  );
});

test("数値の昇順と降順で同じ行が返る", () => {
  const asc = query({ rows }, "SELECT id FROM rows ORDER BY score ASC");
  const desc = query({ rows }, "SELECT id FROM rows ORDER BY score DESC");
  assert.deepEqual(
    asc.map((row) => row.id).sort((a, b) => a - b),
    desc.map((row) => row.id).sort((a, b) => a - b),
  );
});
