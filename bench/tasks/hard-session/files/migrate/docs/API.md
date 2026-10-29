# ジョブ実行の仕組み API

小さなジョブ実行の仕組みの公開 API。ジョブはファイルを書く、コピーする、
変換する、消す、といった短い処理で、キューが順番と同時実行数を見ながら
動かす。依存パッケージは無く、Node.js 22 以降で動く。

今の実装はコールバックで書かれている。公開している関数は、コールバックを
渡されたときは今までどおりに動き、渡されなかったときは Promise を返す形に
そろえる。この文書では、まず今のコールバックの形を説明する。

## 1. 読み込み

```js
import {
  createQueue,
  createStore,
  createMemoryStore,
  runAll,
} from "./src/index.js";
```

## 2. createQueue(options, callback)

キューの本体を作る。保存先から前回のジョブを読み込むため、結果は
コールバックで返る。`callback(error, queue)` は必須。失敗したら `error`、
成功したら `queue` を受け取る。コールバックを省略した場合は Promise を
返す。この対応はこれから入れる。

```js
const queue = await new Promise((resolve, reject) => {
  createQueue({ concurrency: 2 }, (error, value) => {
    if (error) reject(error);
    else resolve(value);
  });
});
```

`options` は省略できる。

| 項目 | 既定 | 意味 |
| --- | --- | --- |
| `store` | メモリ | ジョブの記録を残す場所 |
| `jobs` | 組み込みの4種類 | ジョブ名から関数への対応表 |
| `concurrency` | `1` | 同時に動かすジョブの最大数 |
| `retry` | 下記 | やり直しの設定 |
| `clock` | 実時間 | 時計とタイマー |
| `logger` | 何もしない | `info` / `warn` / `error` を受ける |

`concurrency` は1以上の整数。`jobs` に同じ名前を書くと組み込みのジョブを
置き換えられる。

### 2.1 retry

| 項目 | 既定 | 意味 |
| --- | --- | --- |
| `attempts` | `3` | 初回を含めた最大の実行回数 |
| `delayMs` | `100` | 1回目のやり直しまでの待ち時間 |
| `factor` | `2` | やり直すたびに待ち時間を掛ける数 |
| `maxDelayMs` | `30000` | 待ち時間の上限 |

失敗した回数を `n`（1から数える）とすると、次の実行までの待ち時間は
`delayMs * factor ** (n - 1)` を `maxDelayMs` で切った値になる。

- 1回目に失敗した後: `delayMs`
- 2回目に失敗した後: `delayMs * factor`
- 3回目に失敗した後: `delayMs * factor * factor`

`attempts` 回失敗したら、そのジョブは失敗として記録する。

### 2.2 clock

テストで時間を待たないように、時計とタイマーを差し替えられる。

```js
const clock = {
  now: () => 0,
  setTimeout: (callback, ms) => {
    // ms 後に callback を呼ぶ。戻り値はタイマーの番号。
    return 1;
  },
  clearTimeout: (handle) => {
    // handle のタイマーを止める。
  },
};
```

`now()` はジョブの `createdAt` と `updatedAt` に使う。`setTimeout` は
リトライの待ち時間に使う。`clearTimeout` はキューを止めたときなどに使う。
省略すると `Date.now` とグローバルの `setTimeout` を使う。

### 2.3 store

`store` はジョブの記録を読み書きする。次の3つの関数を持つ。

```js
store.load((error, state) => {});
store.save(state, (error) => {});
store.clear((error) => {});
```

`state` は `{ records: [...] }` の形。`createMemoryStore()` はプロセスが
終わるまで記録を残す。`createStore(directory)` は `directory/state.json`
に JSON で残す。`load` は `{ records: [] }` から始まる。

## 3. queue

`createQueue` が返すキューの本体。

### 3.1 queue.add(type, payload, callback)

ジョブを1つ足す。`type` は `jobs` にある名前。無い名前は `JobError`。
`payload` はジョブに渡す値。`callback(error, job)` は足せたらジョブの記録を
返す。足した時点の `status` は `"pending"`。保存に失敗したら記録を戻して
`error` を返す。コールバックを省略した場合は記録を Promise で返す。

```js
queue.add(
  "write-file",
  { path: "out/a.txt", content: "hello" },
  (error, job) => {
    if (error) {
      return;
    }
    console.log(job.id);
  },
);
```

### 3.2 queue.runAll(callback)

まだ動いていないジョブを全部動かす。`summary` は
`{ completed: [job, ...], failed: [job, ...] }`。どちらも終わった順に入る。
`runAll` の前に `status` が `"pending"` だったものだけを対象にし、すでに
`"done"` か `"failed"` のジョブは動かさない。コールバックを省略した場合は
`summary` を Promise で返す。

```js
queue.runAll((error, summary) => {
  if (error) {
    return;
  }
  console.log(summary.completed.length, summary.failed.length);
});
```

### 3.3 queue.stop(callback)

新しいジョブを動かすのをやめる。すでに動いているジョブは最後まで動く。
止めた後ろに残った `"pending"` のジョブは、次に `runAll` を呼んでも
`stopped` が残っているため動かない。同じ `store` から新しいキューを
作ると続きから動かせる。コールバックを省略した場合は Promise を返す。

### 3.4 queue.list()

記録の一覧を足した順で返す。戻り値は記録の浅いコピー。

## 4. runAll(queue, callback)

`queue.runAll` を呼ぶだけの関数。コールバックを省略した場合は Promise を
返す。

## 5. ジョブの記録

```js
{
  id: "b1f0...",          // 重複しない文字列
  type: "write-file",     // ジョブの種類
  payload: { ... },       // add で渡した値
  status: "pending",      // pending / running / done / failed
  attempts: 0,            // 実行した回数
  result: null,           // 成功したときの戻り値
  error: null,            // 失敗したときのメッセージ
  createdAt: 0,           // clock.now() の値
  updatedAt: 0,           // 最後に変えたときの clock.now() の値
}
```

`runAll` の実行中は `"running"`、成功したら `"done"`、失敗したら
`"failed"` になる。`attempts` はリトライを含めた実行回数。

## 6. ジョブの関数

```js
function myJob(payload, context, callback) {
  // context.job      今のジョブの記録
  // context.attempt  今回が何回目か（1から）
  // context.clock    キューの clock
  // context.logger   キューの logger
  // context.queue    キューの本体
  callback(null, { ok: true });
}
```

失敗は `callback(error)` で返す。中で例外を投げても失敗として扱う。
`(payload, context)` の2引数で Promise を返すジョブも動かせる。

## 7. 組み込みのジョブ

- `write-file`: `{ path, content, encoding? }`。親フォルダを作り、結果は
  `{ path, bytes }`。`path` は絶対パス。
- `copy-file`: `{ source, target }`。結果は `{ source, target }`。
- `transform-file`: `{ source, target, mode? }`。`mode` は `"upper"`、
  `"lower"`、`"trim"`。省略すると `"upper"`。結果は
  `{ source, target, mode, bytes }`。
- `delete-file`: `{ path, missingOk? }`。`missingOk` の既定は `true`。
  結果は `{ path, removed }`。

## 8. エラー

公開している関数のエラーは `JobError`。`message` は日本語で、`cause` に
元のエラーが入ることがある。ジョブの失敗は `runAll` の `summary.failed`
に入り、`runAll` そのものは失敗しない。キューを作れない、保存できない、
といった仕組み全体の失敗だけが `runAll` の `error` になる。

## 9. 保存と再開

同じ `store` から新しくキューを作ると、前回の記録を読み込む。
`status` が `"pending"` のジョブが残っていれば、そのキューで `runAll`
すると続きから動く。`createStore` は JSON を書き換えるので、同じ保存先を
使うキューは同時に作らない。
