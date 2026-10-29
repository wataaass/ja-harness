# 問い合わせエンジンの仕様

この文書は、メモリ上の表に対する小さな SQL 風の問い合わせエンジン
`query(tables, sql)` の動きを決めたもの。今は `SELECT ... FROM ... WHERE ...`
だけが動くが、最終的には並べ替え、件数の制限、集計まで扱う。

## 1. 公開する形

```js
import { query } from "./src/index.js";

const rows = query(
  {
    users: [
      { id: 1, name: "花子", age: 30, city: "東京" },
      { id: 2, name: "太郎", age: 20, city: "大阪" },
    ],
  },
  "SELECT name FROM users WHERE age >= 20 ORDER BY name",
);
```

`query(tables, sql)` の形は変えない。

- `tables`: テーブル名をキーにしたオブジェクト。値は行の配列。
  行はプロパティを持つふつうのオブジェクト。
- `sql`: 問い合わせの文字列。空文字は `QueryError`。
- 戻り値: 行の配列。行は `SELECT` で指定した列を持つ新しいオブジェクト。

`tables` は書き換えない。戻り値の行を書き換えても元の行は変わらない。

## 2. 文法

```text
SELECT select_list
FROM table_name
[ WHERE expression ]
[ GROUP BY column [, column ...] ]
[ HAVING expression ]
[ ORDER BY expression [ ASC | DESC ] [, ...] ]
[ LIMIT non_negative_integer [ OFFSET non_negative_integer ] ]
[ OFFSET non_negative_integer ]
[ ; ]
```

- キーワードは大文字と小文字を区別しない。
- 列名とテーブル名は大文字と小文字を区別する。
- 改行や空白の量は自由。
- 最後のセミコロンは省略できる。
- `JOIN`、副問い合わせ、`DISTINCT`、`INSERT` などは扱わない。
- `FROM` に書けるテーブルは1つだけ。

## 3. 字句

### 3.1 名前

英字か `_` で始まり、英数字と `_` が続く。予約語と同じつづりの列名は
使えない。

列は `name` でも `table.name` でも書ける。`table.name` の `table` は
`FROM` に書いたテーブル名と一致していなければならない。

### 3.2 数値

`0`、`42`、`1.5` のような10進数。符号は単項の `-` で付ける。
`-3` は数値の `-3` として扱う。

### 3.3 文字列

シングルクォートで囲む。中のシングルクォートは2つ続けて書く。

```sql
SELECT * FROM users WHERE name = 'O''Brien'
```

これは `O'Brien` と比較する。バックスラッシュに特別な意味はない。
閉じ忘れは `QueryError`。

### 3.4 その他の値

- `NULL`: null。
- `TRUE` / `FALSE`: 真偽値。
- `*`: `SELECT *` と `COUNT(*)` でだけ使える。

## 4. 式

### 4.1 比較

`=`、`!=`、`<>`、`<`、`<=`、`>`、`>=` を使える。
`!=` と `<>` は同じ意味。

比較の結果は真偽値。**どちらかの値が `NULL` のとき、比較は必ず偽**に
なる。`NULL = NULL` も偽、`NULL != 5` も偽。

数値どうしは数値として比べる。文字列どうしは文字コードの順で比べる。
違う種類の値は、数値、文字列、真偽値の順に並ぶものとして比べる。

`=` と `!=` は同じ種類で同じ値のときだけ等しい。型が違えば等しくない。

### 4.2 論理

`AND`、`OR`、`NOT` を使える。`AND` は `OR` より強く結びつく。
`NOT` は比較より強く結びつく。丸括弧で順序を変えられる。

```sql
-- a = 1 かつ b = 2、または c = 3
WHERE a = 1 AND b = 2 OR c = 3
```

真偽は次の値で決める。

- 偽: `false`、`null`、`undefined`、`0`、`NaN`、空文字、空の配列
- 真: それ以外

`AND` と `OR` は左から短絡してよい。戻り値は真偽値。

## 5. SELECT

`SELECT *` は元の行の列をすべて出す。列の順は元の行のキーの順。

`SELECT name, age AS years` のように `AS` で別名を付けられる。
別名を付けた列は、戻り値の行ではその名前になる。

別名を付けなかった場合の列名は次のとおり。

| 式 | 列名 |
| --- | --- |
| `name` | `name` |
| `table.name` | `name` |
| `COUNT(*)` | `count` |
| `SUM(score)` | `sum` |
| その他の式 | 式を元の形に戻した文字列 |

同じ列名が複数ある場合は、後ろの列が前の列を上書きする。

## 6. GROUP BY と集計

### 6.1 集計関数

次の5つを使える。関数名は大文字と小文字を区別しない。

| 関数 | 意味 |
| --- | --- |
| `COUNT(*)` | 行の数 |
| `COUNT(expr)` | `expr` が `NULL` でない行の数 |
| `SUM(expr)` | `NULL` でない値の合計 |
| `AVG(expr)` | `NULL` でない値の平均 |
| `MIN(expr)` | `NULL` でない値の最小 |
| `MAX(expr)` | `NULL` でない値の最大 |

- `COUNT` の引数は1つ。`COUNT()` は誤り。
- `SUM`、`AVG`、`MIN`、`MAX` の引数は1つで、`*` は使えない。
- `SUM` と `AVG` は数値だけを受け付ける。文字列などがあれば
  `QueryError`。
- `MIN` と `MAX` は数値でも文字列でもよい。
- 対象の行が無い、または全部 `NULL` のとき、`COUNT` は `0`、
  それ以外は `null` を返す。
- 集計関数の入れ子は扱わない。

集計関数は `SELECT`、`HAVING`、`ORDER BY` に書ける。`WHERE` には
書けない。

### 6.2 GROUP BY

`GROUP BY city` は `city` の値が同じ行をまとめる。グループの順は、
元の行で最初に現れた順。

`GROUP BY` には列名だけを書ける。式や集計関数は書けない。
複数の列を指定すると、その組み合わせでまとめる。

`GROUP BY` を書いたとき、`SELECT` と `ORDER BY` に出せる集計関数の
外側の列は、`GROUP BY` に書いた列だけ。それ以外の列を出すと
`QueryError`。

```sql
SELECT city, COUNT(*) AS n, SUM(score) AS total
FROM users
GROUP BY city
```

### 6.3 集計だけの問い合わせ

`GROUP BY` が無くても、`SELECT`、`HAVING`、`ORDER BY` のどれかに
集計関数があれば、全体を1つのグループとして扱う。

```sql
SELECT COUNT(*) AS n, AVG(age) AS average FROM users
```

このとき、集計関数の外側に列を書くと `QueryError`。

### 6.4 HAVING

`HAVING` はグループをまとめた後に絞り込む。集計関数と `GROUP BY` の
列を使える。

```sql
SELECT city, COUNT(*) AS n
FROM users
GROUP BY city
HAVING COUNT(*) >= 2
```

`GROUP BY` も集計関数も無いのに `HAVING` を書くと `QueryError`。
`WHERE` はグループ化の前に、1行ずつ絞り込む。

## 7. ORDER BY

`ORDER BY age DESC, name ASC` のように、複数のキーを左から順に比べる。
向きを省略すると `ASC`。

- `ASC`: 小さい順。
- `DESC`: 大きい順。
- **`NULL` は向きに関係なく最後**に置く。
- 同じ値どうしの順は、元の行の順（安定）とする。

`ORDER BY` には列、`SELECT` の別名、集計関数を書ける。別名と同じ名前の
列がある場合は別名を優先する。`GROUP BY` があるときは、集計関数の
外側では `GROUP BY` の列だけを使える。

## 8. LIMIT と OFFSET

`LIMIT n` は先頭から `n` 行だけ返す。`OFFSET m` は先頭の `m` 行を
飛ばす。`ORDER BY` がある場合は並べ替えた後に適用する。

- `n` と `m` は0以上の整数。小数や負の数は `QueryError`。
- `LIMIT 0` は空の配列。
- `OFFSET` だけを書ける。`LIMIT` と `OFFSET` はどちらの順でもよい。
- 返せる行が足りなければ、あるだけ返す。

## 9. エラー

文法の誤り、無いテーブル、無い列、使えない関数、集計の使い方の誤りは
`QueryError` を投げる。`QueryError` は `Error` を継承し、`name` は
`"QueryError"`。メッセージは日本語で、どの位置が悪いか分かるようにする。

行が1つも無いテーブルでは列の有無を確かめられない。その場合は列名の
検査をせず、条件に合う行が無いものとして空の配列を返す。

## 10. 例

```js
const tables = {
  orders: [
    { id: 1, customer: "花子", amount: 1200, status: "paid" },
    { id: 2, customer: "太郎", amount: 800, status: "paid" },
    { id: 3, customer: "花子", amount: 500, status: "canceled" },
  ],
};

query(tables, "SELECT customer, SUM(amount) AS total FROM orders WHERE status = 'paid' GROUP BY customer ORDER BY total DESC");
// => [{ customer: "花子", total: 1200 }, { customer: "太郎", total: 800 }]

query(tables, "SELECT * FROM orders ORDER BY amount DESC LIMIT 2 OFFSET 1");
// => 2行目と3行目を金額の大きい順で

query(tables, "SELECT COUNT(*) AS n FROM orders WHERE customer = '次郎'");
// => [{ n: 0 }]
```

`WHERE` の比較で `NULL` を特別扱いしないこと、`AND` と `OR` の
優先順位、文字列内の `''` の扱いは、過去に不具合の報告がある。

## 11. 評価の順序

問い合わせは次の順に処理する。この順序は結果に影響する。

1. `FROM` のテーブルを読む。
2. `WHERE` で1行ずつ絞り込む。
3. `GROUP BY` があればグループにまとめる。集計関数だけの問い合わせでは
   全体を1つのグループにする。
4. `HAVING` でグループを絞り込む。
5. `SELECT` の式を評価して列を作る。
6. `ORDER BY` で並べ替える。
7. `OFFSET` と `LIMIT` を適用する。

`WHERE` はグループを作る前に動くので、集計関数を書けない。
`HAVING` はグループを作った後に動くので、集計関数を書ける。

## 12. よくある書き方

```js
// 列を選ぶ
query(tables, "SELECT id, name FROM users");

// 条件で絞る
query(tables, "SELECT id FROM users WHERE age >= 20 AND city = '東京'");

// 並べ替えて先頭だけ取る
query(tables, "SELECT name FROM users ORDER BY age DESC LIMIT 10");

// グループごとに数える
query(
  tables,
  "SELECT city, COUNT(*) AS n FROM users GROUP BY city HAVING COUNT(*) > 1",
);

// 全体の合計
query(tables, "SELECT SUM(amount) AS total FROM orders");
```

`ORDER BY` の `ASC` は省略できる。`LIMIT` と `OFFSET` は整数だけ。
文字列はシングルクォートで囲み、中のクォートは2つ重ねる。
