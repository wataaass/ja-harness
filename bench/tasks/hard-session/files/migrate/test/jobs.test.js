import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQueue } from "../src/index.js";

function open(options = {}) {
  return new Promise((resolve, reject) => {
    createQueue(options, (error, queue) => {
      if (error) {
        reject(error);
      } else {
        resolve(queue);
      }
    });
  });
}

function add(queue, type, payload) {
  return new Promise((resolve, reject) => {
    queue.add(type, payload, (error, record) => {
      if (error) {
        reject(error);
      } else {
        resolve(record);
      }
    });
  });
}

function run(queue) {
  return new Promise((resolve, reject) => {
    queue.runAll((error, summary) => {
      if (error) {
        reject(error);
      } else {
        resolve(summary);
      }
    });
  });
}

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), "hard-migrate-jobs-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("write-file は親フォルダを作って書く", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a", "b", "c.txt");
  const queue = await open();
  await add(queue, "write-file", { path: file, content: "こんにちは" });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 1);
  assert.equal(await readFile(file, "utf8"), "こんにちは");
  assert.equal(summary.completed[0].result.path, file);
  assert.equal(summary.completed[0].result.bytes, 15);
});

test("write-file は path が無いと失敗する", async () => {
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "write-file", { path: "", content: "x" });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
  assert.match(summary.failed[0].error, /path/);
});

test("write-file は content が無いと失敗する", async (t) => {
  const dir = await temp(t);
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "write-file", { path: join(dir, "a.txt") });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
  assert.match(summary.failed[0].error, /content/);
});

test("copy-file はファイルを写す", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out", "copy.txt");
  await writeFile(source, "abc", "utf8");
  const queue = await open();
  await add(queue, "copy-file", { source, target });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 1);
  assert.equal(await readFile(target, "utf8"), "abc");
  assert.deepEqual(summary.completed[0].result, { source, target });
});

test("copy-file は元が無いと失敗する", async (t) => {
  const dir = await temp(t);
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "copy-file", {
    source: join(dir, "missing.txt"),
    target: join(dir, "out.txt"),
  });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
});

test("transform-file は既定で大文字にする", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "Hello", "utf8");
  const queue = await open();
  await add(queue, "transform-file", { source, target });
  const summary = await run(queue);
  assert.equal(await readFile(target, "utf8"), "HELLO");
  assert.equal(summary.completed[0].result.mode, "upper");
});

test("transform-file は小文字にできる", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "Hello", "utf8");
  const queue = await open();
  await add(queue, "transform-file", { source, target, mode: "lower" });
  await run(queue);
  assert.equal(await readFile(target, "utf8"), "hello");
});

test("transform-file は前後の空白を消せる", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "  hello  \n", "utf8");
  const queue = await open();
  await add(queue, "transform-file", { source, target, mode: "trim" });
  await run(queue);
  assert.equal(await readFile(target, "utf8"), "hello");
});

test("transform-file の mode が変なら失敗する", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  await writeFile(source, "x", "utf8");
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "transform-file", {
    source,
    target: join(dir, "out.txt"),
    mode: "reverse",
  });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
  assert.match(summary.failed[0].error, /mode/);
});

test("transform-file は元が無いと失敗する", async (t) => {
  const dir = await temp(t);
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "transform-file", {
    source: join(dir, "missing.txt"),
    target: join(dir, "out.txt"),
  });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
});

test("delete-file はファイルを消す", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a.txt");
  await writeFile(file, "x", "utf8");
  const queue = await open();
  await add(queue, "delete-file", { path: file });
  const summary = await run(queue);
  assert.equal(summary.completed[0].result.removed, true);
  await assert.rejects(readFile(file, "utf8"));
});

test("delete-file は無いファイルを既定で成功にする", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  await add(queue, "delete-file", { path: join(dir, "missing.txt") });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 1);
  assert.equal(summary.completed[0].result.removed, false);
});

test("delete-file は missingOk が false なら失敗する", async (t) => {
  const dir = await temp(t);
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "delete-file", {
    path: join(dir, "missing.txt"),
    missingOk: false,
  });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
});

test("4種類のジョブをつなげて動かせる", async (t) => {
  const dir = await temp(t);
  const a = join(dir, "a.txt");
  const b = join(dir, "b.txt");
  const c = join(dir, "c.txt");
  const d = join(dir, "d.txt");
  const queue = await open({ concurrency: 1 });
  await add(queue, "write-file", { path: a, content: "Hello" });
  await add(queue, "copy-file", { source: a, target: b });
  await add(queue, "transform-file", { source: b, target: c, mode: "lower" });
  await add(queue, "transform-file", { source: c, target: d, mode: "upper" });
  await add(queue, "delete-file", { path: b });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 5);
  assert.equal(summary.failed.length, 0);
  assert.equal(await readFile(a, "utf8"), "Hello");
  assert.equal(await readFile(c, "utf8"), "hello");
  assert.equal(await readFile(d, "utf8"), "HELLO");
  await assert.rejects(readFile(b, "utf8"));
});

test("ジョブの結果はそれぞれの記録に入る", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a.txt");
  const queue = await open();
  await add(queue, "write-file", { path: file, content: "abc" });
  await add(queue, "delete-file", { path: file });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 2);
  assert.equal(summary.completed[0].result.bytes, 3);
  assert.equal(summary.completed[1].result.removed, true);
  assert.equal(summary.completed[0].error, null);
  assert.equal(summary.completed[1].error, null);
});

test("write-file は encoding を指定できる", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a.txt");
  const queue = await open();
  await add(queue, "write-file", {
    path: file,
    content: "abc",
    encoding: "utf8",
  });
  const summary = await run(queue);
  assert.equal(summary.completed[0].result.bytes, 3);
  assert.equal(await readFile(file, "utf8"), "abc");
});

test("失敗したジョブがあっても次のジョブは動く", async (t) => {
  const dir = await temp(t);
  const good = join(dir, "good.txt");
  const queue = await open({
    concurrency: 1,
    retry: { attempts: 1 },
  });
  await add(queue, "write-file", { path: "", content: "bad" });
  await add(queue, "write-file", { path: good, content: "good" });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.completed.length, 1);
  assert.equal(await readFile(good, "utf8"), "good");
});

test("copy-file は既にあるファイルを上書きする", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "new", "utf8");
  await writeFile(target, "old", "utf8");
  const queue = await open();
  await add(queue, "copy-file", { source, target });
  await run(queue);
  assert.equal(await readFile(target, "utf8"), "new");
});

test("copy-file は target が無いと失敗する", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  await writeFile(source, "x", "utf8");
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "copy-file", { source, target: "" });
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
  assert.match(summary.failed[0].error, /target/);
});

test("transform-file の結果にバイト数が入る", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "abc", "utf8");
  const queue = await open();
  await add(queue, "transform-file", { source, target });
  const summary = await run(queue);
  assert.equal(summary.completed[0].result.bytes, 3);
});

test("transform-file は target の親フォルダを作る", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "a", "b", "out.txt");
  await writeFile(source, "hello", "utf8");
  const queue = await open();
  await add(queue, "transform-file", {
    source,
    target,
    mode: "upper",
  });
  await run(queue);
  assert.equal(await readFile(target, "utf8"), "HELLO");
});

test("delete-file の missingOk が false ならメッセージが入る", async (t) => {
  const dir = await temp(t);
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "delete-file", {
    path: join(dir, "missing.txt"),
    missingOk: false,
  });
  const summary = await run(queue);
  assert.match(summary.failed[0].error, /消せません/);
});

test("delete-file の結果の path は絶対パス", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a.txt");
  await writeFile(file, "x", "utf8");
  const queue = await open();
  await add(queue, "delete-file", { path: file });
  const summary = await run(queue);
  assert.equal(summary.completed[0].result.path, file);
});

test("payload がオブジェクトでないと失敗する", async () => {
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "write-file", 1);
  const summary = await run(queue);
  assert.equal(summary.failed.length, 1);
  assert.match(summary.failed[0].error, /オブジェクト/);
});

test("同じジョブを複数回足してそれぞれ動く", async (t) => {
  const dir = await temp(t);
  const queue = await open({ concurrency: 2 });
  await add(queue, "write-file", { path: join(dir, "a.txt"), content: "a" });
  await add(queue, "write-file", { path: join(dir, "b.txt"), content: "b" });
  await add(queue, "delete-file", { path: join(dir, "a.txt") });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 3);
  assert.equal(await readFile(join(dir, "b.txt"), "utf8"), "b");
});

test("write-file の bytes は UTF-8 の長さ", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  await add(queue, "write-file", {
    path: join(dir, "a.txt"),
    content: "あa",
  });
  const summary = await run(queue);
  assert.equal(summary.completed[0].result.bytes, 4);
});

test("copy-file の結果は絶対パス", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "x", "utf8");
  const queue = await open();
  await add(queue, "copy-file", { source, target });
  const summary = await run(queue);
  assert.equal(summary.completed[0].result.source, source);
  assert.equal(summary.completed[0].result.target, target);
});

test("delete-file は消した後の状態を返す", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a.txt");
  await writeFile(file, "x", "utf8");
  const queue = await open();
  await add(queue, "delete-file", { path: file });
  const summary = await run(queue);
  assert.equal(summary.completed[0].status, "done");
  assert.equal(summary.completed[0].result.removed, true);
});
