function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      result[key] = normalize(source[key]);
    }
    return result;
  }
  return value;
}

export function canonicalArgs(args: unknown): string {
  return JSON.stringify(normalize(args)) ?? "null";
}

const FIRST_NOTE =
  "Note: you called the same tool with the same arguments again. Check the previous result before calling it again. If the task is not done, try a different approach or different arguments.";

export type RepeatTracker = {
  record(name: string, args: unknown): string | null;
  reset(): void;
};

export function createRepeatTracker(
  thresholds: number[] = [3, 5, 8],
): RepeatTracker {
  const levels = [...thresholds].sort((a, b) => a - b);
  for (const level of levels) {
    if (level < 2) {
      throw new Error("repeat thresholds must be 2 or greater");
    }
  }
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] === levels[i - 1]) {
      throw new Error("repeat thresholds must be unique");
    }
  }

  let count = 0;
  let lastName: string | undefined;
  let lastCanonical: string | undefined;

  return {
    record(name, args) {
      const canonical = canonicalArgs(args);
      if (lastName === name && lastCanonical === canonical) {
        count += 1;
      } else {
        count = 1;
        lastName = name;
        lastCanonical = canonical;
      }

      if (!levels.includes(count)) {
        return null;
      }
      if (count === levels[0]) {
        return FIRST_NOTE;
      }

      const shown =
        canonical.length > 500 ? `${canonical.slice(0, 500)}…` : canonical;
      return `Note: repeated tool call detected (tool: ${name}, calls in a row: ${count}, arguments: ${shown}). These calls are not making progress. Do not repeat this call. Read the latest result and choose a different action, or finish if you have enough information.`;
    },
    reset() {
      count = 0;
      lastName = undefined;
      lastCanonical = undefined;
    },
  };
}
