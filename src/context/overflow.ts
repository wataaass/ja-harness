const OVERFLOW_PATTERN =
  /context[ _-]?(length|window)|maximum context|too many tokens|prompt is too long|context_length_exceeded/i;

export function isContextOverflow(error: unknown): boolean {
  return error instanceof Error && OVERFLOW_PATTERN.test(error.message);
}
