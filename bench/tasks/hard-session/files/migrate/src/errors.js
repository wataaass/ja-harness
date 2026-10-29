export class JobError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "JobError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function asJobError(error, fallback) {
  if (error instanceof JobError) {
    return error;
  }
  if (error instanceof Error) {
    const message =
      fallback === undefined ? error.message : `${fallback}: ${error.message}`;
    return new JobError(message, error);
  }
  return new JobError(fallback ?? String(error));
}

export function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
