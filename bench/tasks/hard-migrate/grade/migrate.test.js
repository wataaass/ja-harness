import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JobError,
  createMemoryStore,
  createQueue,
  createStore,
  retryDelay,
  runAll,
} from "../src/index.js";

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), "hard-migrate-grade-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function immediateClock() {
  const delays = [];
  let now = 0;
  return {
    delays,
    now: () => {
      now += 1;
      return now;
    },
    setTimeout: (callback, ms) => {
      delays.push(ms);
      callback();
      return delays.length;
    },
    clearTimeout: () => {},
  };
}

function makeLogger() {
  const warn = [];
  const error = [];
  return {
    info: () => {},
    warn: (message) => warn.push(message),
    error: (message) => error.push(message),
    warnMessages: warn,
    errorMessages: error,
  };
}

function failingStore() {
  return {
    load(callback) {
      if (typeof callback === "function") {
        callback(null, { records: [] });
        return undefined;
      }
      return Promise.resolve({ records: [] });
    },
    save(state, callback) {
      const error = new Error("保存できない");
      if (typeof callback === "function") {
        callback(error);
        return undefined;
      }
      return Promise.reject(error);
    },
    clear(callback) {
      if (typeof callback === "function") {
        callback(null);
        return undefined;
      }
      return Promise.resolve();
    },
  };
}

test("createQueue は Promise を返す", async () => {
  const queue = await createQueue();
  assert.deepEqual(queue.list(), []);
});

test("createQueue はコールバックでも使える", async () => {
  const queue = await new Promise((resolve, reject) => {
    createQueue((error, value) => (error ? reject(error) : resolve(value)));
  });
  assert.deepEqual(queue.list(), []);
});

test("queue.add は Promise で記録を返す", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  const record = await queue.add("write-file", {
    path: join(dir, "a.txt"),
    content: "x",
  });
  assert.equal(record.status, "pending");
  assert.equal(typeof record.id, "string");
});

test("queue.add はコールバックでも使える", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  const record = await new Promise((resolve, reject) => {
    queue.add(
      "write-file",
      { path: join(dir, "a.txt"), content: "x" },
      (error, value) => (error ? reject(error) : resolve(value)),
    );
  });
  assert.equal(record.status, "pending");
});

test("queue.runAll は Promise で summary を返す", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 1);
  assert.equal(await readFile(join(dir, "a.txt"), "utf8"), "x");
});

test("モジュールの runAll はコールバックで使える", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const summary = await new Promise((resolve, reject) => {
    runAll(queue, (error, value) => (error ? reject(error) : resolve(value)));
  });
  assert.equal(summary.completed.length, 1);
});

test("モジュールの runAll は Promise でも使える", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const summary = await runAll(queue);
  assert.equal(summary.completed.length, 1);
});

test("queue.stop は Promise を返し pending を残す", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  await queue.stop();
  const summary = await queue.runAll();
  assert.deepEqual(summary.completed, []);
  assert.equal(queue.list()[0].status, "pending");
});

test("コールバックのキューと Promise のメソッドを混ぜられる", async (t) => {
  const dir = await temp(t);
  const queue = await new Promise((resolve, reject) => {
    createQueue((error, value) => (error ? reject(error) : resolve(value)));
  });
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 1);
});

test("コールバックのジョブを動かせる", async () => {
  const jobs = {
    double: (payload, context, callback) => {
      callback(null, payload.value * 2);
    },
  };
  const queue = await createQueue({ jobs });
  await queue.add("double", { value: 5 });
  const summary = await queue.runAll();
  assert.equal(summary.completed[0].result, 10);
});

test("Promise のジョブを動かせる", async () => {
  const jobs = {
    asyncDouble: async (payload) => payload.value * 2,
  };
  const queue = await createQueue({ jobs });
  await queue.add("asyncDouble", { value: 6 });
  const summary = await queue.runAll();
  assert.equal(summary.completed[0].result, 12);
});

test("知らない種類のジョブは JobError", async () => {
  const queue = await createQueue();
  await assert.rejects(queue.add("missing", {}), JobError);
});

test("おかしい concurrency は JobError", async () => {
  await assert.rejects(createQueue({ concurrency: 0 }), JobError);
  await assert.rejects(createQueue({ concurrency: 1.5 }), JobError);
});

test("retryDelay は 1回目から倍々になる", () => {
  assert.equal(retryDelay(1, { delayMs: 100, factor: 2 }), 100);
  assert.equal(retryDelay(2, { delayMs: 100, factor: 2 }), 200);
  assert.equal(retryDelay(3, { delayMs: 100, factor: 2 }), 400);
});

test("retryDelay は上限で切る", () => {
  assert.equal(
    retryDelay(4, { delayMs: 100, factor: 3, maxDelayMs: 500 }),
    500,
  );
});

test("一時的な失敗のあと成功する", async () => {
  const clock = immediateClock();
  const attempts = [];
  const jobs = {
    flaky: async (payload, context) => {
      attempts.push(context.attempt);
      if (attempts.length < 3) {
        throw new Error(`失敗${attempts.length}`);
      }
      return "ok";
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 3, delayMs: 100, factor: 2, maxDelayMs: 1000 },
  });
  await queue.add("flaky", {});
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 1);
  assert.equal(summary.completed[0].attempts, 3);
  assert.equal(summary.completed[0].result, "ok");
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.deepEqual(clock.delays, [100, 200]);
});

test("最後まで失敗すると failed になる", async () => {
  const clock = immediateClock();
  const log = makeLogger();
  const jobs = {
    bad: async () => {
      throw new Error("いつも失敗");
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    logger: log,
    retry: { attempts: 3, delayMs: 50, factor: 2 },
  });
  await queue.add("bad", {});
  const summary = await queue.runAll();
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.failed[0].status, "failed");
  assert.equal(summary.failed[0].attempts, 3);
  assert.match(summary.failed[0].error, /いつも失敗/);
  assert.equal(log.warnMessages.length, 2);
  assert.equal(log.errorMessages.length, 1);
});

test("attempts が1なら待たずに失敗する", async () => {
  const clock = immediateClock();
  const queue = await createQueue({
    clock,
    jobs: {
      bad: async () => {
        throw new Error("1回だけ");
      },
    },
    retry: { attempts: 1, delayMs: 100 },
  });
  await queue.add("bad", {});
  const summary = await queue.runAll();
  assert.equal(summary.failed[0].attempts, 1);
  assert.deepEqual(clock.delays, []);
});

test("リトライで context.attempt が増える", async () => {
  const clock = immediateClock();
  const attempts = [];
  const queue = await createQueue({
    clock,
    jobs: {
      count: async (payload, context) => {
        attempts.push(context.attempt);
        if (context.attempt < 3) {
          throw new Error("もう一度");
        }
        return context.attempt;
      },
    },
    retry: { attempts: 3, delayMs: 10, factor: 2 },
  });
  await queue.add("count", {});
  await queue.runAll();
  assert.deepEqual(attempts, [1, 2, 3]);
});

test("同期で投げるコールバックのジョブもやり直す", async () => {
  const clock = immediateClock();
  let calls = 0;
  const jobs = {
    syncFail: (payload, context, callback) => {
      calls += 1;
      if (calls < 2) {
        throw new Error("同期の失敗");
      }
      callback(null, "ok");
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 2, delayMs: 20, factor: 2 },
  });
  await queue.add("syncFail", {});
  const summary = await queue.runAll();
  assert.equal(calls, 2);
  assert.equal(summary.completed[0].result, "ok");
  assert.deepEqual(clock.delays, [20]);
});

test("concurrency 2 を超えて動かさない", async () => {
  let active = 0;
  let maxActive = 0;
  const jobs = {
    slow: (payload, context, callback) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => {
        active -= 1;
        callback(null, payload.id);
      }, 5);
    },
  };
  const queue = await createQueue({ concurrency: 2, jobs });
  for (let index = 0; index < 7; index += 1) {
    await queue.add("slow", { id: index });
  }
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 7);
  assert.ok(maxActive <= 2, `同時実行数が ${maxActive} になった`);
});

test("concurrency 3 を超えて動かさない", async () => {
  let active = 0;
  let maxActive = 0;
  const jobs = {
    slow: async (payload, context) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
      return payload.id;
    },
  };
  const queue = await createQueue({ concurrency: 3, jobs });
  for (let index = 0; index < 10; index += 1) {
    await queue.add("slow", { id: index });
  }
  await queue.runAll();
  assert.ok(maxActive <= 3, `同時実行数が ${maxActive} になった`);
});

test("メモリの store で待っているジョブを別のキューで動かせる", async (t) => {
  const dir = await temp(t);
  const store = createMemoryStore();
  const first = await createQueue({ store });
  await first.add("write-file", { path: join(dir, "a.txt"), content: "a" });
  await first.add("write-file", { path: join(dir, "b.txt"), content: "b" });

  const second = await createQueue({ store });
  assert.equal(second.list().length, 2);
  const summary = await second.runAll();
  assert.equal(summary.completed.length, 2);
  assert.equal(await readFile(join(dir, "a.txt"), "utf8"), "a");
});

test("ファイルの store で終わったジョブは再実行しない", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  const first = await createQueue({ store });
  await first.add("write-file", { path: join(dir, "a.txt"), content: "a" });
  await first.runAll();

  const second = await createQueue({ store });
  assert.equal(second.list()[0].status, "done");
  const summary = await second.runAll();
  assert.deepEqual(summary.completed, []);
});

test("メモリの store はコールバックでも読める", async () => {
  const store = createMemoryStore();
  await store.save({ records: [{ id: "x" }] });
  const state = await new Promise((resolve, reject) => {
    store.load((error, value) => (error ? reject(error) : resolve(value)));
  });
  assert.deepEqual(state, { records: [{ id: "x" }] });
});

test("ファイルの store は Promise で読み書きできる", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  assert.deepEqual(await store.load(), { records: [] });
  await store.save({ records: [{ id: "y" }] });
  assert.deepEqual(await store.load(), { records: [{ id: "y" }] });
  await store.clear();
  assert.deepEqual(await store.load(), { records: [] });
});

test("write-file は親フォルダを作って書く", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a", "b", "c.txt");
  const queue = await createQueue();
  await queue.add("write-file", { path: file, content: "こんにちは" });
  const summary = await queue.runAll();
  assert.equal(await readFile(file, "utf8"), "こんにちは");
  assert.equal(summary.completed[0].result.path, file);
  assert.equal(summary.completed[0].result.bytes, 15);
});

test("copy-file は写して結果を返す", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out", "copy.txt");
  await writeFile(source, "abc", "utf8");
  const queue = await createQueue();
  await queue.add("copy-file", { source, target });
  const summary = await queue.runAll();
  assert.equal(await readFile(target, "utf8"), "abc");
  assert.deepEqual(summary.completed[0].result, { source, target });
});

test("transform-file は既定で大文字にする", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "Hello", "utf8");
  const queue = await createQueue();
  await queue.add("transform-file", { source, target });
  const summary = await queue.runAll();
  assert.equal(await readFile(target, "utf8"), "HELLO");
  assert.equal(summary.completed[0].result.mode, "upper");
});

test("transform-file は小文字にできる", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "Hello", "utf8");
  const queue = await createQueue();
  await queue.add("transform-file", { source, target, mode: "lower" });
  await queue.runAll();
  assert.equal(await readFile(target, "utf8"), "hello");
});

test("transform-file は前後の空白を消せる", async (t) => {
  const dir = await temp(t);
  const source = join(dir, "in.txt");
  const target = join(dir, "out.txt");
  await writeFile(source, "  hello  \n", "utf8");
  const queue = await createQueue();
  await queue.add("transform-file", { source, target, mode: "trim" });
  await queue.runAll();
  assert.equal(await readFile(target, "utf8"), "hello");
});

test("delete-file は無いファイルを既定で成功にする", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("delete-file", { path: join(dir, "missing.txt") });
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 1);
  assert.equal(summary.completed[0].result.removed, false);
});

test("delete-file は missingOk が false なら失敗する", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue({
    retry: { attempts: 1 },
  });
  await queue.add("delete-file", {
    path: join(dir, "missing.txt"),
    missingOk: false,
  });
  const summary = await queue.runAll();
  assert.equal(summary.failed.length, 1);
  assert.match(summary.failed[0].error, /消せません/);
});

test("4種類のジョブをつなげて動かせる", async (t) => {
  const dir = await temp(t);
  const a = join(dir, "a.txt");
  const b = join(dir, "b.txt");
  const c = join(dir, "c.txt");
  const queue = await createQueue({ concurrency: 1 });
  await queue.add("write-file", { path: a, content: "Hello" });
  await queue.add("copy-file", { source: a, target: b });
  await queue.add("transform-file", { source: b, target: c, mode: "lower" });
  await queue.add("delete-file", { path: b });
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 4);
  assert.equal(await readFile(a, "utf8"), "Hello");
  assert.equal(await readFile(c, "utf8"), "hello");
  await assert.rejects(readFile(b, "utf8"));
});

test("失敗しても後ろのジョブは動く", async (t) => {
  const dir = await temp(t);
  const good = join(dir, "good.txt");
  const queue = await createQueue({
    concurrency: 1,
    retry: { attempts: 1 },
  });
  await queue.add("write-file", { path: "", content: "bad" });
  await queue.add("write-file", { path: good, content: "good" });
  const summary = await queue.runAll();
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.completed.length, 1);
  assert.equal(await readFile(good, "utf8"), "good");
});

test("保存に失敗した add は記録を戻す", async () => {
  const queue = await createQueue({ store: failingStore() });
  await assert.rejects(
    queue.add("write-file", { path: "a.txt", content: "x" }),
    /保存できない/,
  );
  assert.deepEqual(queue.list(), []);
});

test("リトライの警告に待ち時間が入る", async () => {
  const clock = immediateClock();
  const log = makeLogger();
  let calls = 0;
  const queue = await createQueue({
    clock,
    logger: log,
    jobs: {
      flaky: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("あと1回");
        }
        return "ok";
      },
    },
    retry: { attempts: 2, delayMs: 75, factor: 2 },
  });
  await queue.add("flaky", {});
  await queue.runAll();
  assert.equal(log.warnMessages.length, 1);
  assert.match(log.warnMessages[0], /75ms/);
});

test("jobs で組み込みのジョブを置き換えられる", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a.txt");
  const queue = await createQueue({
    jobs: {
      "write-file": async () => "replaced",
    },
  });
  await queue.add("write-file", { path: file, content: "x" });
  const summary = await queue.runAll();
  assert.equal(summary.completed[0].result, "replaced");
  await assert.rejects(readFile(file, "utf8"));
});

test("終わったジョブは2回目の runAll で動かない", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const first = await queue.runAll();
  const second = await queue.runAll();
  assert.equal(first.completed.length, 1);
  assert.deepEqual(second.completed, []);
  assert.deepEqual(second.failed, []);
});
