const CONTEXT = 2;

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

export function formatDiff(
  _path: string,
  before: string,
  after: string,
): string {
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
    return "";
  }

  const contextStart = Math.max(0, prefix - CONTEXT);
  const contextEnd = Math.min(a.length, beforeEnd + CONTEXT);
  const out = [`@@ line ${contextStart + 1} @@`];

  for (let i = contextStart; i < prefix; i += 1) {
    out.push(` ${a[i]}`);
  }
  for (let i = prefix; i < beforeEnd; i += 1) {
    out.push(`-${a[i]}`);
  }
  for (let i = prefix; i < afterEnd; i += 1) {
    out.push(`+${b[i]}`);
  }
  for (let i = beforeEnd; i < contextEnd; i += 1) {
    out.push(` ${a[i]}`);
  }

  return out.join("\n");
}
