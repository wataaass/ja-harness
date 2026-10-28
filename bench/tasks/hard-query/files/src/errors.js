export class QueryError extends Error {
  constructor(message, position) {
    const suffix =
      typeof position === "number" && Number.isFinite(position)
        ? `（位置 ${position + 1}）`
        : "";
    super(`${message}${suffix}`);
    this.name = "QueryError";
    this.position = position;
  }
}

export function fail(message, position) {
  throw new QueryError(message, position);
}

export function asQueryError(error, fallback) {
  if (error instanceof QueryError) {
    return error;
  }
  const message =
    error instanceof Error && error.message !== ""
      ? error.message
      : fallback;
  return new QueryError(message);
}
