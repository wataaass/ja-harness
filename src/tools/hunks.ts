export type Hunk = {
  beforeStart: number;
  removed: string[];
  added: string[];
  before: string[];
  after: string[];
};

type Change = {
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
};

type Operation =
  | { type: "equal"; line: string }
  | { type: "remove"; line: string }
  | { type: "add"; line: string };

const MAX_CELLS = 4_000_000;

function toLines(text: string): string[] {
  if (text === "") {
    return [];
  }
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function diffRange(a: string[], b: string[]): Operation[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        table[i * width + j] = (table[(i + 1) * width + j + 1] ?? 0) + 1;
      } else {
        table[i * width + j] = Math.max(
          table[(i + 1) * width + j] ?? 0,
          table[i * width + j + 1] ?? 0,
        );
      }
    }
  }

  const ops: Operation[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", line: a[i] ?? "" });
      i += 1;
      j += 1;
    } else if (
      (table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)
    ) {
      ops.push({ type: "remove", line: a[i] ?? "" });
      i += 1;
    } else {
      ops.push({ type: "add", line: b[j] ?? "" });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "remove", line: a[i] ?? "" });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "add", line: b[j] ?? "" });
    j += 1;
  }
  return ops;
}

function changesIn(a: string[], b: string[]): Change[] {
  const ops = diffRange(a, b);
  const changes: Change[] = [];
  let before = 0;
  let after = 0;
  let index = 0;

  while (index < ops.length) {
    const op = ops[index];
    if (op?.type === "equal") {
      before += 1;
      after += 1;
      index += 1;
      continue;
    }
    const startBefore = before;
    const startAfter = after;
    while (index < ops.length && ops[index]?.type !== "equal") {
      const current = ops[index];
      if (current?.type === "remove") {
        before += 1;
      } else if (current?.type === "add") {
        after += 1;
      }
      index += 1;
    }
    changes.push({
      beforeStart: startBefore,
      beforeEnd: before,
      afterStart: startAfter,
      afterEnd: after,
    });
  }

  return changes;
}

function mergeChanges(changes: Change[], context: number): Change[] {
  const merged: Change[] = [];
  for (const change of changes) {
    const previous = merged[merged.length - 1];
    if (
      previous !== undefined &&
      change.beforeStart - previous.beforeEnd <= context * 2
    ) {
      previous.beforeEnd = change.beforeEnd;
      previous.afterEnd = change.afterEnd;
      continue;
    }
    merged.push({ ...change });
  }
  return merged;
}

function oneHunk(
  a: string[],
  b: string[],
  beforeStart: number,
  beforeEnd: number,
  afterStart: number,
  afterEnd: number,
  context: number,
): Hunk {
  const start = Math.max(0, beforeStart - context);
  const end = Math.min(a.length, beforeEnd + context);
  return {
    beforeStart: start + 1,
    removed: a.slice(beforeStart, beforeEnd),
    added: b.slice(afterStart, afterEnd),
    before: a.slice(start, beforeStart),
    after: a.slice(beforeEnd, end),
  };
}

export function computeHunks(
  before: string,
  after: string,
  context = 2,
): Hunk[] {
  const a = toLines(before);
  const b = toLines(after);

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const beforeEnd = a.length - suffix;
  const afterEnd = b.length - suffix;
  if (prefix === beforeEnd && prefix === afterEnd) {
    return [];
  }

  const beforeRange = a.slice(prefix, beforeEnd);
  const afterRange = b.slice(prefix, afterEnd);
  if (beforeRange.length * afterRange.length > MAX_CELLS) {
    return [
      oneHunk(a, b, prefix, beforeEnd, prefix, afterEnd, Math.max(0, context)),
    ];
  }

  const changes = mergeChanges(
    changesIn(beforeRange, afterRange),
    Math.max(0, context),
  );
  return changes.map((change) =>
    oneHunk(
      a,
      b,
      prefix + change.beforeStart,
      prefix + change.beforeEnd,
      prefix + change.afterStart,
      prefix + change.afterEnd,
      Math.max(0, context),
    ),
  );
}

export function applyHunks(
  before: string,
  hunks: Hunk[],
  accepted: boolean[],
): string {
  const lines = toLines(before);
  const trailingNewline = before.endsWith("\n");
  const out: string[] = [];
  let position = 0;

  for (let index = 0; index < hunks.length; index += 1) {
    const hunk = hunks[index];
    if (hunk === undefined) {
      continue;
    }
    const start = hunk.beforeStart - 1 + hunk.before.length;
    while (position < start) {
      out.push(lines[position] ?? "");
      position += 1;
    }
    if (accepted[index] === true) {
      out.push(...hunk.added);
      position = start + hunk.removed.length;
    } else {
      for (let line = 0; line < hunk.removed.length; line += 1) {
        out.push(lines[position] ?? "");
        position += 1;
      }
    }
  }

  while (position < lines.length) {
    out.push(lines[position] ?? "");
    position += 1;
  }

  const text = out.join("\n");
  return trailingNewline && text !== "" ? `${text}\n` : text;
}

export function formatHunk(
  _path: string,
  hunk: Hunk,
  _index: number,
  _total: number,
): string[] {
  const lines = [`@@ line ${hunk.beforeStart} @@`];
  for (const line of hunk.before) {
    lines.push(` ${line}`);
  }
  for (const line of hunk.removed) {
    lines.push(`-${line}`);
  }
  for (const line of hunk.added) {
    lines.push(`+${line}`);
  }
  for (const line of hunk.after) {
    lines.push(` ${line}`);
  }
  return lines;
}
