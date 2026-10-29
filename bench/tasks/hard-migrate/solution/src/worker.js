import { JobError, asJobError } from "./errors.js";
import { retryDelay, shouldRetry } from "./retry.js";
import { wait } from "./retry.js";

function invokeWithCallback(job, payload, context) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (error, result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(asJobError(error));
        return;
      }
      resolve(result);
    };
    try {
      job(payload, context, done);
    } catch (error) {
      done(error);
    }
  });
}

async function invoke(job, payload, context) {
  if (job.length >= 3) {
    return invokeWithCallback(job, payload, context);
  }
  return job(payload, context);
}

export async function runJob(queue, record) {
  const job = queue.jobs[record.type];
  if (typeof job !== "function") {
    throw new JobError(`ジョブの種類がありません: ${record.type}`);
  }

  record.attempts = 0;

  for (let attempt = 1; attempt <= queue.retry.attempts; attempt += 1) {
    record.attempts = attempt;
    const context = {
      job: record,
      attempt,
      clock: queue.clock,
      logger: queue.logger,
      queue,
    };
    queue.logger.info(`${record.type} を実行します（${attempt}回目）`);
    try {
      const result = await invoke(job, record.payload, context);
      return result;
    } catch (error) {
      const failure = asJobError(error);
      if (!shouldRetry(attempt, queue.retry)) {
        throw failure;
      }
      const delay = retryDelay(attempt, queue.retry);
      queue.logger.warn(
        `${record.type} を${delay}ms後にやり直します: ${failure.message}`,
      );
      await wait(queue.clock, delay);
    }
  }

  throw new JobError(`${record.type} を実行できませんでした`);
}
