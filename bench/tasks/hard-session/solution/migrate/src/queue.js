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

function validateOptions(options) {
  if (typeof options.jobs !== "object" || options.jobs === null) {
    throw new JobError("jobs はジョブ名と関数の対応表です");
  }
  if (typeof options.store !== "object" || options.store === null) {
    throw new JobError("store が正しくありません");
  }
}

function dual(callback, run) {
  if (typeof callback === "function") {
    Promise.resolve()
      .then(run)
      .then(
        (value) => callback(null, value),
        (error) => callback(asJobError(error)),
      );
    return undefined;
  }
  return Promise.resolve()
    .then(run)
    .catch((error) => {
      throw asJobError(error);
    });
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
    this.saveChain = Promise.resolve();
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
    const write = () => this.store.save({ records: this.records });
    const next = this.saveChain.then(write, write);
    this.saveChain = next.catch(() => {});
    return dual(callback, () => next);
  }

  add(type, payload, callback) {
    return dual(callback, async () => {
      if (typeof type !== "string" || type === "") {
        throw new JobError("ジョブの種類を指定してください");
      }
      if (typeof this.jobs[type] !== "function") {
        throw new JobError(`ジョブの種類がありません: ${type}`);
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
      try {
        await this.save();
      } catch (error) {
        this.records = this.records.filter((item) => item !== record);
        throw error;
      }
      return record;
    });
  }

  runAll(callback) {
    return dual(callback, () => runQueue(this));
  }

  stop(callback) {
    return dual(callback, async () => {
      this.stopped = true;
    });
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
  const input = options ?? {};

  const open = async () => {
    if (
      input.jobs !== undefined &&
      (typeof input.jobs !== "object" || input.jobs === null)
    ) {
      throw new JobError("jobs はジョブ名と関数の対応表です");
    }
    const store = input.store ?? createMemoryStore();
    const jobs = { ...defaultJobs, ...(input.jobs ?? {}) };
    const concurrency = positiveInteger(input.concurrency, "concurrency", 1);
    const retry = normalizeRetry(input.retry);
    const clock = createClock(input.clock);
    const logger = createLogger(input.logger);
    validateOptions({ store, jobs });
    const state = await store.load();
    const records = Array.isArray(state?.records) ? state.records : [];
    return new JobQueue({
      store,
      jobs,
      concurrency,
      retry,
      clock,
      logger,
      records,
    });
  };

  if (typeof callback === "function") {
    open().then(
      (queue) => callback(null, queue),
      (error) => callback(asJobError(error)),
    );
    return undefined;
  }
  return open();
}
