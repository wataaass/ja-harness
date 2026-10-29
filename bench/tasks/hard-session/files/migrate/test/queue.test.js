import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JobError,
  createQueue,
  createStore,
  runAll,
} from "../src/index.js";

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

function stop(queue) {
  return new Promise((resolve, reject) => {
    queue.stop((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), "hard-migrate-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("createQueue は空のキューを返す", async () => {
  const queue = await open();
  assert.deepEqual(queue.list(), []);
  assert.equal(queue.concurrency, 1);
});

test("add は pending のジョブを返す", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  const record = await add(queue, "write-file", {
    path: join(dir, "a.txt"),
    content: "hello",
  });
  assert.equal(record.status, "pending");
  assert.equal(record.attempts, 0);
  assert.equal(record.result, null);
  assert.equal(record.error, null);
  assert.equal(typeof record.id, "string");
  assert.equal(record.type, "write-file");
  assert.equal(queue.list().length, 1);
});

test("list の戻り値を書き換えても本体は変わらない", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  await add(queue, "write-file", { path: join(dir, "a.txt"), content: "x" });
  const list = queue.list();
  list[0].status = "done";
  assert.equal(queue.list()[0].status, "pending");
});

test("runAll でジョブが動いてファイルができる", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  const file = join(dir, "a.txt");
  await add(queue, "write-file", { path: file, content: "こんにちは" });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 1);
  assert.equal(summary.failed.length, 0);
  assert.equal(summary.completed[0].status, "done");
  assert.equal(summary.completed[0].attempts, 1);
  assert.equal(await readFile(file, "utf8"), "こんにちは");
});

test("2回目の runAll は動かすジョブが無い", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  await add(queue, "write-file", { path: join(dir, "a.txt"), content: "x" });
  await run(queue);
  const second = await run(queue);
  assert.deepEqual(second.completed, []);
  assert.deepEqual(second.failed, []);
});

test("同時実行が1なら足した順に動く", async (t) => {
  const order = [];
  const jobs = {
    note: (payload, context, callback) => {
      order.push(payload.value);
      process.nextTick(() => callback(null, payload.value));
    },
  };
  const queue = await open({ concurrency: 1, jobs });
  for (const value of ["a", "b", "c"]) {
    await add(queue, "note", { value });
  }
  const summary = await run(queue);
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.equal(summary.completed.length, 3);
});

test("知らない種類の add は JobError", async () => {
  const queue = await open();
  await assert.rejects(
    add(queue, "missing", {}),
    (error) => error instanceof JobError,
  );
  assert.deepEqual(queue.list(), []);
});

test("concurrency が0なら createQueue が失敗する", async () => {
  await assert.rejects(
    open({ concurrency: 0 }),
    (error) => error instanceof JobError,
  );
});

test("stop の後は pending を動かさない", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  await add(queue, "write-file", { path: join(dir, "a.txt"), content: "a" });
  await add(queue, "write-file", { path: join(dir, "b.txt"), content: "b" });
  await stop(queue);
  const summary = await run(queue);
  assert.deepEqual(summary.completed, []);
  assert.equal(queue.list().length, 2);
  assert.ok(queue.list().every((record) => record.status === "pending"));
});

test("保存先が同じなら別のキューで記録を読める", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  const first = await open({ store });
  await add(first, "write-file", {
    path: join(dir, "a.txt"),
    content: "a",
  });
  await add(first, "write-file", {
    path: join(dir, "b.txt"),
    content: "b",
  });

  const second = await open({ store });
  assert.equal(second.list().length, 2);
  assert.ok(second.list().every((record) => record.status === "pending"));
  const summary = await run(second);
  assert.equal(summary.completed.length, 2);
  assert.equal(await readFile(join(dir, "a.txt"), "utf8"), "a");
  assert.equal(await readFile(join(dir, "b.txt"), "utf8"), "b");
});

test("終わったジョブは別のキューでも動かさない", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  const first = await open({ store });
  await add(first, "write-file", { path: join(dir, "a.txt"), content: "x" });
  await run(first);

  const second = await open({ store });
  assert.equal(second.list()[0].status, "done");
  const summary = await run(second);
  assert.deepEqual(summary.completed, []);
});

test("独自のコールバックのジョブを動かせる", async () => {
  const jobs = {
    double: (payload, context, callback) => {
      callback(null, {
        value: payload.value * 2,
        attempt: context.attempt,
      });
    },
  };
  const queue = await open({ jobs });
  await add(queue, "double", { value: 21 });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 1);
  assert.deepEqual(summary.completed[0].result, { value: 42, attempt: 1 });
});

test("ジョブの失敗は summary.failed に入る", async () => {
  const queue = await open({ retry: { attempts: 1 } });
  await add(queue, "write-file", { path: "", content: "x" });
  const summary = await run(queue);
  assert.equal(summary.completed.length, 0);
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.failed[0].status, "failed");
  assert.equal(typeof summary.failed[0].error, "string");
});

test("モジュールの runAll も同じように動く", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  await add(queue, "write-file", { path: join(dir, "a.txt"), content: "x" });
  const summary = await new Promise((resolve, reject) => {
    runAll(queue, (error, value) => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
  assert.equal(summary.completed.length, 1);
});

test("同じキューに何度もジョブを足せる", async (t) => {
  const dir = await temp(t);
  const queue = await open({ concurrency: 2 });
  for (let index = 0; index < 8; index += 1) {
    await add(queue, "write-file", {
      path: join(dir, `${index}.txt`),
      content: String(index),
    });
  }
  const summary = await run(queue);
  assert.equal(summary.completed.length, 8);
  for (let index = 0; index < 8; index += 1) {
    assert.equal(await readFile(join(dir, `${index}.txt`), "utf8"), String(index));
  }
});

test("同時に動く数が concurrency を超えない", async () => {
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
  const queue = await open({ concurrency: 2, jobs });
  for (let index = 0; index < 6; index += 1) {
    await add(queue, "slow", { id: index });
  }
  const summary = await run(queue);
  assert.equal(summary.completed.length, 6);
  assert.ok(maxActive <= 2, `同時実行数が ${maxActive} になった`);
});

test("concurrency 3 でも上限を守る", async () => {
  let active = 0;
  let maxActive = 0;
  const jobs = {
    slow: (payload, context, callback) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => {
        active -= 1;
        callback(null, payload.id);
      }, 3);
    },
  };
  const queue = await open({ concurrency: 3, jobs });
  for (let index = 0; index < 9; index += 1) {
    await add(queue, "slow", { id: index });
  }
  await run(queue);
  assert.ok(maxActive <= 3, `同時実行数が ${maxActive} になった`);
});

test("add は payload をそのまま記録する", async (t) => {
  const dir = await temp(t);
  const queue = await open();
  const payload = { path: join(dir, "a.txt"), content: "x" };
  const record = await add(queue, "write-file", payload);
  assert.deepEqual(record.payload, payload);
  assert.deepEqual(queue.list()[0].payload, payload);
});

test("独自ジョブの context にキューと記録が入る", async () => {
  let seen;
  const jobs = {
    inspect: (payload, context, callback) => {
      seen = context;
      callback(null, payload);
    },
  };
  const queue = await open({ jobs });
  await add(queue, "inspect", { value: 1 });
  await run(queue);
  assert.equal(seen.job.type, "inspect");
  assert.equal(seen.attempt, 1);
  assert.equal(seen.queue, queue);
  assert.equal(seen.clock, queue.clock);
});

test("失敗したジョブの状態も保存される", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  const first = await open({ store, retry: { attempts: 1 } });
  await add(first, "write-file", { path: "", content: "x" });
  await run(first);
  const second = await open({ store });
  const records = second.list();
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "failed");
  const summary = await run(second);
  assert.deepEqual(summary.completed, []);
});

test("stop は動いているジョブを最後まで動かす", async () => {
  const order = [];
  const jobs = {
    first: (payload, context, callback) => {
      order.push("first");
      context.queue.stop(() => {});
      setTimeout(() => {
        order.push("first-done");
        callback(null, "first");
      }, 2);
    },
    second: (payload, context, callback) => {
      order.push("second");
      callback(null, "second");
    },
  };
  const queue = await open({ concurrency: 1, jobs });
  await add(queue, "first", {});
  await add(queue, "second", {});
  const summary = await run(queue);
  assert.deepEqual(order, ["first", "first-done"]);
  assert.equal(summary.completed.length, 1);
  assert.equal(queue.list().filter((record) => record.status === "pending").length, 1);
});

test("保存に失敗した add は記録を戻す", async () => {
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
  const queue = await open({ store: failingStore() });
  await assert.rejects(
    add(queue, "write-file", { path: "a.txt", content: "x" }),
    /保存できない/,
  );
  assert.deepEqual(queue.list(), []);
});

test("jobs で組み込みのジョブを置き換えられる", async (t) => {
  const dir = await temp(t);
  const file = join(dir, "a.txt");
  const jobs = {
    "write-file": (payload, context, callback) => {
      callback(null, { replaced: true, path: payload.path });
    },
  };
  const queue = await open({ jobs });
  await add(queue, "write-file", { path: file, content: "x" });
  const summary = await run(queue);
  assert.deepEqual(summary.completed[0].result, {
    replaced: true,
    path: file,
  });
  await assert.rejects(readFile(file, "utf8"));
});

test("retry を省略しても既定の回数だけ動く", async () => {
  let calls = 0;
  const jobs = {
    bad: (payload, context, callback) => {
      calls += 1;
      callback(new Error("失敗"));
    },
  };
  const clock = {
    now: () => 0,
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout: () => {},
  };
  const queue = await open({ jobs, clock });
  await add(queue, "bad", {});
  const summary = await run(queue);
  assert.equal(calls, 3);
  assert.equal(summary.failed[0].attempts, 3);
});

test("pending が無ければ runAll はすぐ終わる", async () => {
  const queue = await open();
  const summary = await run(queue);
  assert.deepEqual(summary, { completed: [], failed: [] });
});

test("add は保存してから戻る", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  const queue = await open({ store });
  await add(queue, "write-file", {
    path: join(dir, "a.txt"),
    content: "x",
  });
  const text = await readFile(join(dir, "store", "state.json"), "utf8");
  const state = JSON.parse(text);
  assert.equal(state.records.length, 1);
  assert.equal(state.records[0].status, "pending");
});

test("止めたキューを新しいキューで再開できる", async (t) => {
  const dir = await temp(t);
  const store = createStore(join(dir, "store"));
  const first = await open({ store });
  await add(first, "write-file", {
    path: join(dir, "a.txt"),
    content: "x",
  });
  await stop(first);
  const empty = await run(first);
  assert.deepEqual(empty.completed, []);

  const second = await open({ store });
  const summary = await run(second);
  assert.equal(summary.completed.length, 1);
  assert.equal(await readFile(join(dir, "a.txt"), "utf8"), "x");
});
