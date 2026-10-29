import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JobError,
  createMemoryStore,
  createQueue,
  createStore,
  runAll,
} from "../src/index.js";

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), "hard-migrate-promise-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("createQueue はコールバック無しで Promise を返す", async () => {
  const queue = await createQueue();
  assert.deepEqual(queue.list(), []);
});

test("add はコールバック無しで記録を返す", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  const record = await queue.add("write-file", {
    path: join(dir, "a.txt"),
    content: "x",
  });
  assert.equal(record.status, "pending");
  assert.equal(queue.list().length, 1);
});

test("queue.runAll は Promise で summary を返す", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 1);
  assert.equal(await readFile(join(dir, "a.txt"), "utf8"), "x");
});

test("モジュールの runAll も Promise を返す", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const summary = await runAll(queue);
  assert.equal(summary.completed.length, 1);
});

test("stop は Promise を返す", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  await queue.stop();
  const summary = await queue.runAll();
  assert.deepEqual(summary.completed, []);
  assert.equal(queue.list()[0].status, "pending");
});

test("コールバックで作ったキューでも Promise で足せる", async (t) => {
  const dir = await temp(t);
  const queue = await new Promise((resolve, reject) => {
    createQueue((error, value) => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
  const record = await queue.add("write-file", {
    path: join(dir, "a.txt"),
    content: "x",
  });
  assert.equal(record.status, "pending");
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 1);
});

test("コールバックのジョブを Promise のキューで動かせる", async () => {
  const jobs = {
    twice: (payload, context, callback) => {
      process.nextTick(() => callback(null, payload.value * 2));
    },
  };
  const queue = await createQueue({ jobs });
  await queue.add("twice", { value: 4 });
  const summary = await queue.runAll();
  assert.equal(summary.completed[0].result, 8);
});

test("Promise を返すジョブを動かせる", async () => {
  const jobs = {
    asyncJob: async (payload, context) => {
      return { value: payload.value + 1, attempt: context.attempt };
    },
  };
  const queue = await createQueue({ jobs });
  await queue.add("asyncJob", { value: 1 });
  const summary = await queue.runAll();
  assert.deepEqual(summary.completed[0].result, { value: 2, attempt: 1 });
});

test("Promise のジョブが失敗すると failed に入る", async () => {
  const jobs = {
    bad: async () => {
      throw new Error("だめ");
    },
  };
  const queue = await createQueue({ jobs, retry: { attempts: 1 } });
  await queue.add("bad", {});
  const summary = await queue.runAll();
  assert.equal(summary.failed.length, 1);
  assert.match(summary.failed[0].error, /だめ/);
});

test("知らない種類の add は Promise が拒否される", async () => {
  const queue = await createQueue();
  await assert.rejects(queue.add("missing", {}), JobError);
});

test("おかしい retry は createQueue が拒否される", async () => {
  await assert.rejects(createQueue({ retry: { attempts: 0 } }), JobError);
});

test("メモリの store を Promise で読み書きできる", async () => {
  const store = createMemoryStore();
  const state = { records: [{ id: "a", status: "pending" }] };
  await store.save(state);
  const loaded = await store.load();
  assert.deepEqual(loaded, state);
  await store.clear();
  assert.deepEqual(await store.load(), { records: [] });
});

test("メモリの store をコールバックでも読み書きできる", async () => {
  const store = createMemoryStore();
  await new Promise((resolve, reject) => {
    store.save({ records: [{ id: "b" }] }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  const loaded = await new Promise((resolve, reject) => {
    store.load((error, state) => {
      if (error) {
        reject(error);
      } else {
        resolve(state);
      }
    });
  });
  assert.deepEqual(loaded, { records: [{ id: "b" }] });
});

test("ファイルの store を Promise で読み書きできる", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  assert.deepEqual(await store.load(), { records: [] });
  await store.save({ records: [{ id: "c" }] });
  assert.deepEqual(await store.load(), { records: [{ id: "c" }] });
  await store.clear();
  assert.deepEqual(await store.load(), { records: [] });
});

test("add を並行に呼んでもジョブが欠けない", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue({ concurrency: 4 });
  await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      queue.add("write-file", {
        path: join(dir, `${index}.txt`),
        content: String(index),
      }),
    ),
  );
  assert.equal(queue.list().length, 10);
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 10);
});

test("runAll を続けて2回呼べる", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  const first = await queue.runAll();
  const second = await queue.runAll();
  assert.equal(first.completed.length, 1);
  assert.deepEqual(second.completed, []);
});

test("ファイルの store をコールバックでも使える", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  await new Promise((resolve, reject) => {
    store.save({ records: [{ id: "x" }] }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  const state = await new Promise((resolve, reject) => {
    store.load((error, value) => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
  assert.deepEqual(state, { records: [{ id: "x" }] });
});

test("保存に失敗すると add の Promise が拒否される", async () => {
  const store = {
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
  const queue = await createQueue({ store });
  await assert.rejects(
    queue.add("write-file", { path: "a.txt", content: "x" }),
    /保存できない/,
  );
  assert.deepEqual(queue.list(), []);
});

test("Promise のジョブに context が渡る", async () => {
  let seen;
  const jobs = {
    inspect: async (payload, context) => {
      seen = context;
      return payload;
    },
  };
  const queue = await createQueue({ jobs });
  await queue.add("inspect", { value: 3 });
  await queue.runAll();
  assert.equal(seen.job.type, "inspect");
  assert.equal(seen.attempt, 1);
  assert.equal(seen.queue, queue);
});

test("コールバックのジョブも context.attempt を受け取る", async () => {
  const attempts = [];
  const jobs = {
    inspect: (payload, context, callback) => {
      attempts.push(context.attempt);
      callback(null, context.attempt);
    },
  };
  const queue = await createQueue({ jobs });
  await queue.add("inspect", {});
  const summary = await queue.runAll();
  assert.deepEqual(attempts, [1]);
  assert.equal(summary.completed[0].result, 1);
});

test("runAll の後に足したジョブも次の runAll で動く", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue({ concurrency: 1 });
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "a" });
  const first = await queue.runAll();
  await queue.add("write-file", { path: join(dir, "b.txt"), content: "b" });
  const second = await queue.runAll();
  assert.equal(first.completed.length, 1);
  assert.equal(second.completed.length, 1);
  assert.equal(await readFile(join(dir, "b.txt"), "utf8"), "b");
});

test("stop の後でも記録は読める", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue();
  await queue.add("write-file", { path: join(dir, "a.txt"), content: "x" });
  await queue.stop();
  const records = queue.list();
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "pending");
});

test("失敗したジョブは Promise の summary に入る", async () => {
  const jobs = {
    fail: async () => {
      throw new Error("失敗しました");
    },
  };
  const queue = await createQueue({ jobs, retry: { attempts: 2, delayMs: 0 } });
  await queue.add("fail", {});
  const summary = await queue.runAll();
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.failed[0].attempts, 2);
  assert.match(summary.failed[0].error, /失敗しました/);
});

test("store を差し替えてもキューの動作は同じ", async () => {
  const store = createMemoryStore();
  const queue = await createQueue({ store });
  await queue.add("delete-file", { path: "/tmp/hard-migrate-not-there" });
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 1);
  const state = await store.load();
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].status, "done");
});

test("おかしい jobs は createQueue が拒否される", async () => {
  await assert.rejects(createQueue({ jobs: null }), JobError);
});

test("store.clear は Promise でもコールバックでも動く", async () => {
  const store = createMemoryStore();
  await store.save({ records: [{ id: "a" }] });
  await store.clear();
  assert.deepEqual(await store.load(), { records: [] });
  await store.save({ records: [{ id: "b" }] });
  await new Promise((resolve, reject) => {
    store.clear((error) => (error ? reject(error) : resolve()));
  });
  assert.deepEqual(await store.load(), { records: [] });
});

test("同じ Promise のキューを何度も使える", async (t) => {
  const dir = await temp(t);
  const queue = await createQueue({ concurrency: 2 });
  for (let round = 0; round < 3; round += 1) {
    await queue.add("write-file", {
      path: join(dir, `${round}.txt`),
      content: String(round),
    });
    const summary = await queue.runAll();
    assert.equal(summary.completed.length, 1);
  }
  assert.equal(await readFile(join(dir, "2.txt"), "utf8"), "2");
});
