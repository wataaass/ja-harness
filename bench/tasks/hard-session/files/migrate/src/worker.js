import { JobError, asJobError } from "./errors.js";
import { retryDelay, shouldRetry } from "./retry.js";

function invoke(job, payload, context, callback) {
  if (typeof job !== "function") {
    callback(new JobError(`ジョブの種類がありません: ${context.job.type}`));
    return;
  }
  try {
    job(payload, context, callback);
  } catch (error) {
    callback(asJobError(error));
  }
}

export function runJob(queue, record, callback) {
  const job = queue.jobs[record.type];
  if (typeof job !== "function") {
    callback(new JobError(`ジョブの種類がありません: ${record.type}`));
    return;
  }

  record.attempts = 0;

  const attemptOnce = () => {
    record.attempts += 1;
    const attempt = record.attempts;
    const context = {
      job: record,
      attempt,
      clock: queue.clock,
      logger: queue.logger,
      queue,
    };
    queue.logger.info(`${record.type} を実行します（${attempt}回目）`);
    invoke(job, record.payload, context, (error, result) => {
      if (!error) {
        callback(null, result);
        return;
      }
      const failure = asJobError(error);
      if (!shouldRetry(attempt, queue.retry)) {
        callback(failure);
        return;
      }
      const delay = retryDelay(attempt, queue.retry);
      queue.logger.warn(
        `${record.type} を${delay}ms後にやり直します: ${failure.message}`,
      );
      queue.clock.setTimeout(() => attemptOnce(), delay);
    });
  };

  attemptOnce();
}
