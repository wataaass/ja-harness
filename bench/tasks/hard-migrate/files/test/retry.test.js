import test from "node:test";
import assert from "node:assert/strict";
import {
  JobError,
  createQueue,
  normalizeRetry,
  retryDelay,
  shouldRetry,
} from "../src/index.js";

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

function logger() {
  const info = [];
  const warn = [];
  const error = [];
  return {
    info: (message) => info.push(message),
    warn: (message) => warn.push(message),
    error: (message) => error.push(message),
    infoMessages: info,
    warnMessages: warn,
    errorMessages: error,
  };
}

test("retryDelay は1回目の失敗で delayMs を返す", () => {
  assert.equal(retryDelay(1, { delayMs: 100, factor: 2 }), 100);
});

test("retryDelay は失敗するたびに factor を掛ける", () => {
  assert.equal(retryDelay(2, { delayMs: 100, factor: 2 }), 200);
  assert.equal(retryDelay(3, { delayMs: 100, factor: 2 }), 400);
});

test("retryDelay は maxDelayMs で切る", () => {
  assert.equal(
    retryDelay(4, { delayMs: 100, factor: 3, maxDelayMs: 1000 }),
    1000,
  );
});

test("一時的な失敗のあと成功する", async () => {
  const clock = immediateClock();
  const calls = [];
  const jobs = {
    flaky: async (payload, context) => {
      calls.push(context.attempt);
      if (calls.length < 3) {
        throw new Error(`失敗${calls.length}`);
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
  assert.equal(summary.failed.length, 0);
  assert.equal(summary.completed[0].attempts, 3);
  assert.equal(summary.completed[0].result, "ok");
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(clock.delays, [100, 200]);
});

test("attempts 回失敗すると failed になる", async () => {
  const clock = immediateClock();
  const log = logger();
  const jobs = {
    bad: async () => {
      throw new Error("いつも失敗");
    },
  };
  const queue = await createQueue({
    clock,
    logger: log,
    jobs,
    retry: { attempts: 3, delayMs: 50, factor: 2, maxDelayMs: 1000 },
  });
  await queue.add("bad", {});
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 0);
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.failed[0].status, "failed");
  assert.match(summary.failed[0].error, /いつも失敗/);
  assert.equal(summary.failed[0].attempts, 3);
  assert.deepEqual(clock.delays, [50, 100]);
  assert.equal(log.warnMessages.length, 2);
  assert.equal(log.errorMessages.length, 1);
});

test("attempts が1ならやり直さない", async () => {
  const clock = immediateClock();
  let calls = 0;
  const jobs = {
    bad: async () => {
      calls += 1;
      throw new Error("1回だけ");
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 1, delayMs: 100, factor: 2 },
  });
  await queue.add("bad", {});
  const summary = await queue.runAll();
  assert.equal(calls, 1);
  assert.equal(summary.failed.length, 1);
  assert.deepEqual(clock.delays, []);
});

test("待ち時間の上限を守る", async () => {
  const clock = immediateClock();
  const jobs = {
    bad: async () => {
      throw new Error("失敗");
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 3, delayMs: 100, factor: 10, maxDelayMs: 250 },
  });
  await queue.add("bad", {});
  await queue.runAll();
  assert.deepEqual(clock.delays, [100, 250]);
});

test("同期で例外を投げるコールバックのジョブもやり直す", async () => {
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
    retry: { attempts: 2, delayMs: 10, factor: 2 },
  });
  await queue.add("syncFail", {});
  const summary = await queue.runAll();
  assert.equal(calls, 2);
  assert.equal(summary.completed[0].result, "ok");
  assert.deepEqual(clock.delays, [10]);
});

test("コールバックで失敗を返すジョブもやり直す", async () => {
  const clock = immediateClock();
  let calls = 0;
  const jobs = {
    callbackFail: (payload, context, callback) => {
      calls += 1;
      if (calls < 2) {
        callback(new Error("コールバックの失敗"));
      } else {
        callback(null, "ok");
      }
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 2, delayMs: 20, factor: 2 },
  });
  await queue.add("callbackFail", {});
  const summary = await queue.runAll();
  assert.equal(calls, 2);
  assert.equal(summary.completed[0].result, "ok");
  assert.deepEqual(clock.delays, [20]);
});

test("Promise を拒否するジョブもやり直す", async () => {
  const clock = immediateClock();
  let calls = 0;
  const jobs = {
    reject: async () => {
      calls += 1;
      if (calls < 2) {
        throw new Error("拒否");
      }
      return "ok";
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 2, delayMs: 30, factor: 2 },
  });
  await queue.add("reject", {});
  await queue.runAll();
  assert.equal(calls, 2);
  assert.deepEqual(clock.delays, [30]);
});

test("ジョブごとにリトライの回数を数える", async () => {
  const clock = immediateClock();
  const counts = new Map();
  const jobs = {
    once: async (payload) => {
      const count = (counts.get(payload.id) ?? 0) + 1;
      counts.set(payload.id, count);
      if (count === 1) {
        throw new Error("1回だけ失敗");
      }
      return payload.id;
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    concurrency: 1,
    retry: { attempts: 2, delayMs: 40, factor: 2 },
  });
  await queue.add("once", { id: "a" });
  await queue.add("once", { id: "b" });
  const summary = await queue.runAll();
  assert.equal(summary.completed.length, 2);
  assert.deepEqual(clock.delays, [40, 40]);
  assert.equal(summary.completed[0].attempts, 2);
  assert.equal(summary.completed[1].attempts, 2);
});

test("成功したジョブはやり直さない", async () => {
  const clock = immediateClock();
  let calls = 0;
  const jobs = {
    good: async () => {
      calls += 1;
      return "ok";
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 3, delayMs: 100, factor: 2 },
  });
  await queue.add("good", {});
  const summary = await queue.runAll();
  assert.equal(calls, 1);
  assert.equal(summary.completed[0].attempts, 1);
  assert.deepEqual(clock.delays, []);
});

test("logger にやり直しの待ち時間が渡る", async () => {
  const clock = immediateClock();
  const log = logger();
  let calls = 0;
  const jobs = {
    flaky: async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("あと1回");
      }
      return "ok";
    },
  };
  const queue = await createQueue({
    clock,
    logger: log,
    jobs,
    retry: { attempts: 2, delayMs: 75, factor: 2 },
  });
  await queue.add("flaky", {});
  await queue.runAll();
  assert.equal(log.warnMessages.length, 1);
  assert.match(log.warnMessages[0], /75ms/);
});

test("delayMs が0ならすぐやり直す", async () => {
  const clock = immediateClock();
  let calls = 0;
  const jobs = {
    flaky: async () => {
      calls += 1;
      if (calls < 2) {
        throw new Error("すぐ失敗");
      }
      return "ok";
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 2, delayMs: 0, factor: 2 },
  });
  await queue.add("flaky", {});
  const summary = await queue.runAll();
  assert.equal(calls, 2);
  assert.equal(summary.completed[0].result, "ok");
  assert.deepEqual(clock.delays, []);
});

test("factor が1なら待ち時間は変わらない", async () => {
  const clock = immediateClock();
  const jobs = {
    bad: async () => {
      throw new Error("失敗");
    },
  };
  const queue = await createQueue({
    clock,
    jobs,
    retry: { attempts: 3, delayMs: 30, factor: 1 },
  });
  await queue.add("bad", {});
  await queue.runAll();
  assert.deepEqual(clock.delays, [30, 30]);
});

test("normalizeRetry はおかしい値を拒否する", () => {
  assert.throws(() => normalizeRetry({ attempts: 0 }), JobError);
  assert.throws(() => normalizeRetry({ delayMs: -1 }), JobError);
  assert.throws(() => normalizeRetry({ factor: -2 }), JobError);
});

test("shouldRetry は最後の回では false", () => {
  assert.equal(shouldRetry(1, { attempts: 3 }), true);
  assert.equal(shouldRetry(2, { attempts: 3 }), true);
  assert.equal(shouldRetry(3, { attempts: 3 }), false);
});

test("ジョブの context に差し替えた clock が入る", async () => {
  const clock = immediateClock();
  let seen;
  const jobs = {
    inspect: async (payload, context) => {
      seen = context.clock;
      return "ok";
    },
  };
  const queue = await createQueue({ clock, jobs });
  await queue.add("inspect", {});
  await queue.runAll();
  assert.equal(seen, clock);
});
