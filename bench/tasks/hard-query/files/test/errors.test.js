import test from "node:test";
import assert from "node:assert/strict";
import { query, QueryError } from "../src/index.js";

const tables = { t: [{ a: 1 }] };

test("無いテーブルは QueryError", () => {
  assert.throws(() => query(tables, "SELECT * FROM missing"), QueryError);
});

test("無い列は QueryError", () => {
  assert.throws(() => query(tables, "SELECT missing FROM t"), QueryError);
  assert.throws(() => query(tables, "SELECT a FROM t WHERE missing = 1"), QueryError);
});

test("文法の誤りは QueryError", () => {
  assert.throws(() => query(tables, "SELECT FROM t"), QueryError);
  assert.throws(() => query(tables, "SELECT a t"), QueryError);
});

test("空の SQL は QueryError", () => {
  assert.throws(() => query(tables, ""), QueryError);
  assert.throws(() => query(tables, "   "), QueryError);
});

test("SQL が文字列でないと QueryError", () => {
  assert.throws(() => query(tables, 1), QueryError);
});

test("tables がオブジェクトでないと QueryError", () => {
  assert.throws(() => query([], "SELECT * FROM t"), QueryError);
  assert.throws(() => query(null, "SELECT * FROM t"), QueryError);
});

test("使えない関数は QueryError", () => {
  assert.throws(() => query(tables, "SELECT NOPE(a) AS x FROM t"), QueryError);
});

test("LIMIT に負の数は使えない", () => {
  assert.throws(() => query(tables, "SELECT a FROM t LIMIT -1"), QueryError);
});

test("LIMIT に小数は使えない", () => {
  assert.throws(() => query(tables, "SELECT a FROM t LIMIT 1.5"), QueryError);
});

test("列の後ろの余分な語は QueryError", () => {
  assert.throws(() => query(tables, "SELECT a FROM t extra"), QueryError);
});

test("閉じていない文字列は QueryError", () => {
  assert.throws(() => query(tables, "SELECT a FROM t WHERE a = 'x"), QueryError);
});

test("QueryError の名前", () => {
  try {
    query(tables, "SELECT * FROM missing");
    assert.fail("エラーにならなかった");
  } catch (error) {
    assert.equal(error.name, "QueryError");
  }
});

test("ORDER BY の無い列は QueryError", () => {
  assert.throws(
    () => query(tables, "SELECT a FROM t ORDER BY missing"),
    QueryError,
  );
});

test("OFFSET に負の数は使えない", () => {
  assert.throws(() => query(tables, "SELECT a FROM t OFFSET -1"), QueryError);
});

test("OFFSET に小数は使えない", () => {
  assert.throws(() => query(tables, "SELECT a FROM t OFFSET 1.5"), QueryError);
});

test("LIMIT の重複は QueryError", () => {
  assert.throws(
    () => query(tables, "SELECT a FROM t LIMIT 1 LIMIT 2"),
    QueryError,
  );
});

test("使えない文字は QueryError", () => {
  assert.throws(() => query(tables, "SELECT a FROM t WHERE a # 1"), QueryError);
});

test("GROUP BY に式は書けない", () => {
  assert.throws(
    () => query(tables, "SELECT a FROM t GROUP BY a + 1"),
    QueryError,
  );
});

test("HAVING だけでは使えない", () => {
  assert.throws(
    () => query(tables, "SELECT a FROM t HAVING a = 1"),
    QueryError,
  );
});

test("集計関数の引数が2つなら QueryError", () => {
  assert.throws(
    () => query(tables, "SELECT COUNT(a, a) AS n FROM t"),
    QueryError,
  );
});

test("SUM に * は使えない", () => {
  assert.throws(
    () => query(tables, "SELECT SUM(*) AS total FROM t"),
    QueryError,
  );
});

test("閉じていない丸括弧は QueryError", () => {
  assert.throws(
    () => query(tables, "SELECT a FROM t WHERE (a = 1"),
    QueryError,
  );
});

test("SELECT の後ろが空なら QueryError", () => {
  assert.throws(() => query(tables, "SELECT FROM t"), QueryError);
});

test("WHERE の条件が無ければ QueryError", () => {
  assert.throws(() => query(tables, "SELECT a FROM t WHERE"), QueryError);
});

test("SELECT の末尾のカンマは QueryError", () => {
  assert.throws(() => query(tables, "SELECT a, FROM t"), QueryError);
});

test("ORDER BY のキーが無ければ QueryError", () => {
  assert.throws(() => query(tables, "SELECT a FROM t ORDER BY"), QueryError);
});

test("GROUP BY の列が無ければ QueryError", () => {
  assert.throws(() => query(tables, "SELECT a FROM t GROUP BY"), QueryError);
});

test("SELECT * と他の列は一緒に書けない", () => {
  assert.throws(() => query(tables, "SELECT *, a FROM t"), QueryError);
});

test("JOIN は扱わない", () => {
  assert.throws(
    () => query(tables, "SELECT a FROM t JOIN u ON t.a = u.a"),
    QueryError,
  );
});

test("FROM が無ければ QueryError", () => {
  assert.throws(() => query(tables, "SELECT a"), QueryError);
});

test("集計関数を WHERE に書くと QueryError", () => {
  assert.throws(
    () => query(tables, "SELECT a FROM t WHERE SUM(a) > 1"),
    QueryError,
  );
});
