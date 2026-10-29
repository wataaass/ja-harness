import { randomUUID } from "node:crypto";
import { createClock } from "./retry.js";
import { JobError, asJobError, messageOf } from "./errors.js";
import { createLogger } from "./logger.js";
import { normalizeRetry } from "./retry.js";
import { runQueue } from "./scheduler.js";
import { createMemoryStore } from "./store.js";
import { copyFileJob } from "./jobs/copy-file.js";
import { deleteFileJob } from "./jobs/delete-file.js";
import { transformFileJob } from "./jobs/transform-file.js";
import { writeFileJob } from "./jobs/write-file.js";

export const defaultJobs = {
  "write-file": writeFileJob,
  "copy-file": copyFileJob,
  "transform-file": transformFileJob,
  "delete-file": deleteFileJob,
};

function positiveInteger(value, label, fallback) {
  const chosen = value ?? fallback;
  if (!Number.isInteger(chosen) || chosen < 1) {
    throw new JobError(`${label} は1以上の整数です`);
  }
  return chosen;
}

function requireCallback(callback, label) {
  if (typeof callback !== "function") {
    throw new JobError(`${label} にはコールバックが必要です`);
  }
  return callback;
}

function validateOptions(options) {
  if (typeof options.jobs !== "object" || options.jobs === null) {
    throw new JobError("jobs はジョブ名と関数の対応表です");
  }
  if (typeof options.store !== "object" || options.store === null) {
    throw new JobError("store が正しくありません");
  }
}

class JobQueue {
  constructor({ store, jobs, concurrency, retry, clock, logger, records }) {
    this.store = store;
    this.jobs = jobs;
    this.concurrency = concurrency;
    this.retry = retry;
    this.clock = clock;
    this.logger = logger;
    this.records = records;
    this.stopped = false;
  }

  pendingRecords() {
    return this.records.filter((record) => record.status === "pending");
  }

  markRunning(record) {
    record.status = "running";
    record.updatedAt = this.clock.now();
  }

  finish(record, error, result) {
    record.status = error ? "failed" : "done";
    record.result = error ? null : result;
    record.error = error ? messageOf(error) : null;
    record.updatedAt = this.clock.now();
  }

  save(callback) {
    this.store.save({ records: this.records }, callback);
  }

  add(type, payload, callback) {
    requireCallback(callback, "queue.add");
    if (typeof type !== "string" || type === "") {
      process.nextTick(() => callback(new JobError("ジョブの種類を指定してください")));
      return;
    }
    if (typeof this.jobs[type] !== "function") {
      process.nextTick(() =>
        callback(new JobError(`ジョブの種類がありません: ${type}`)),
      );
      return;
    }
    const now = this.clock.now();
    const record = {
      id: randomUUID(),
      type,
      payload,
      status: "pending",
      attempts: 0,
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    this.save((error) => {
      if (error) {
        this.records = this.records.filter((item) => item !== record);
        callback(asJobError(error));
        return;
      }
      callback(null, record);
    });
  }

  runAll(callback) {
    requireCallback(callback, "queue.runAll");
    runQueue(this, callback);
  }

  stop(callback) {
    requireCallback(callback, "queue.stop");
    this.stopped = true;
    process.nextTick(() => callback(null));
  }

  list() {
    return this.records.map((record) => ({ ...record }));
  }
}

export function createQueue(options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  requireCallback(callback, "createQueue");
  const input = options ?? {};

  let store;
  let jobs;
  let concurrency;
  let retry;
  let clock;
  let logger;
  try {
    if (
      input.jobs !== undefined &&
      (typeof input.jobs !== "object" || input.jobs === null)
    ) {
      throw new JobError("jobs はジョブ名と関数の対応表です");
    }
    store = input.store ?? createMemoryStore();
    jobs = { ...defaultJobs, ...(input.jobs ?? {}) };
    concurrency = positiveInteger(input.concurrency, "concurrency", 1);
    retry = normalizeRetry(input.retry);
    clock = createClock(input.clock);
    logger = createLogger(input.logger);
    validateOptions({ store, jobs });
  } catch (error) {
    process.nextTick(() => callback(asJobError(error)));
    return;
  }

  store.load((loadError, state) => {
    if (loadError) {
      callback(asJobError(loadError));
      return;
    }
    const records = Array.isArray(state?.records) ? state.records : [];
    const queue = new JobQueue({
      store,
      jobs,
      concurrency,
      retry,
      clock,
      logger,
      records,
    });
    callback(null, queue);
  });
}
