import { JobError } from "./errors.js";

export const DEFAULT_RETRY = {
  attempts: 3,
  delayMs: 100,
  factor: 2,
  maxDelayMs: 30000,
};

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new JobError(`${label} は1以上の整数です`);
  }
  return value;
}

function nonNegativeNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new JobError(`${label} は0以上の数です`);
  }
  return value;
}

export function normalizeRetry(input) {
  const options = input ?? {};
  return {
    attempts: positiveInteger(
      options.attempts ?? DEFAULT_RETRY.attempts,
      "retry.attempts",
    ),
    delayMs: nonNegativeNumber(
      options.delayMs ?? DEFAULT_RETRY.delayMs,
      "retry.delayMs",
    ),
    factor: nonNegativeNumber(
      options.factor ?? DEFAULT_RETRY.factor,
      "retry.factor",
    ),
    maxDelayMs: nonNegativeNumber(
      options.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs,
      "retry.maxDelayMs",
    ),
  };
}

export function retryDelay(attempt, options) {
  const retry = normalizeRetry(options);
  return Math.min(
    retry.delayMs * retry.factor ** (attempt - 1),
    retry.maxDelayMs,
  );
}

export function shouldRetry(attempt, options) {
  const retry = normalizeRetry(options);
  return attempt < retry.attempts;
}

export function createClock(custom) {
  if (custom === undefined) {
    return {
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle),
    };
  }
  if (
    typeof custom.now !== "function" ||
    typeof custom.setTimeout !== "function" ||
    typeof custom.clearTimeout !== "function"
  ) {
    throw new TypeError("clock には now / setTimeout / clearTimeout が必要です");
  }
  return custom;
}

export const systemClock = createClock();

export function wait(clock, ms) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    clock.setTimeout(resolve, ms);
  });
}
