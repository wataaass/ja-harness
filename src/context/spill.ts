import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Estimator } from "./tokens.js";

export type SpillOptions = {
  maxTokens: number;
  estimate: Estimator;
  save: (text: string) => string;
};

const IMPORTANT_PATTERN = /error|fail|exception|warn|panic|traceback|✗|×/i;
const MAX_IMPORTANT_CHARS = 300;

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function fitPrefix(
  line: string,
  budget: number,
  estimate: Estimator,
): string | null {
  if (estimate(line) <= budget) {
    return line;
  }
  if (budget <= 0) {
    return null;
  }

  const chars = Array.from(line);
  const ellipsis = "…";
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${chars.slice(0, mid).join("")}${ellipsis}`;
    if (estimate(candidate) <= budget) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  if (low === 0) {
    return null;
  }
  return `${chars.slice(0, low).join("")}${ellipsis}`;
}

function takeHead(
  lines: string[],
  start: number,
  end: number,
  budget: number,
  estimate: Estimator,
): { lines: string[]; consumed: number } {
  const out: string[] = [];

  for (let i = start; i < end; i += 1) {
    const candidate =
      out.length === 0 ? lines[i] : `${joinLines(out)}\n${lines[i]}`;
    if (estimate(candidate) <= budget) {
      out.push(lines[i]);
      continue;
    }

    const base = joinLines(out);
    const prefix = out.length === 0 ? "" : `${base}\n`;
    const fitted = fitPrefix(lines[i], budget - estimate(prefix), estimate);
    if (fitted === null) {
      return { lines: out, consumed: i - start };
    }
    out.push(fitted);
    return { lines: out, consumed: i + 1 - start };
  }

  return { lines: out, consumed: end - start };
}

function takeTail(
  lines: string[],
  start: number,
  end: number,
  budget: number,
  estimate: Estimator,
): { lines: string[]; consumed: number } {
  const out: string[] = [];

  for (let i = end - 1; i >= start; i -= 1) {
    const candidate =
      out.length === 0 ? lines[i] : `${lines[i]}\n${joinLines(out)}`;
    if (estimate(candidate) <= budget) {
      out.unshift(lines[i]);
      continue;
    }

    const base = joinLines(out);
    const suffix = out.length === 0 ? "" : `\n${base}`;
    const fitted = fitPrefix(lines[i], budget - estimate(suffix), estimate);
    if (fitted === null) {
      return { lines: out, consumed: end - i - 1 };
    }
    out.unshift(fitted);
    return { lines: out, consumed: end - i };
  }

  return { lines: out, consumed: end - start };
}

function selectImportant(
  lines: string[],
  budget: number,
  estimate: Estimator,
): string[] {
  const out: string[] = [];

  for (const line of lines) {
    if (!IMPORTANT_PATTERN.test(line)) {
      continue;
    }

    const chars = Array.from(line);
    const text =
      chars.length > MAX_IMPORTANT_CHARS
        ? `${chars.slice(0, MAX_IMPORTANT_CHARS).join("")}…`
        : line;
    const candidate = out.length === 0 ? text : `${joinLines(out)}\n${text}`;
    if (estimate(candidate) > budget) {
      break;
    }
    out.push(text);
  }

  return out;
}

function truncateToTokens(
  text: string,
  budget: number,
  estimate: Estimator,
): string {
  if (estimate(text) <= budget) {
    return text;
  }
  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimate(`${chars.slice(0, mid).join("")}…`) <= budget) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  if (low === 0) {
    return "";
  }
  return `${chars.slice(0, low).join("")}…`;
}

export function limitToolResult(text: string, o: SpillOptions): string {
  if (o.estimate(text) <= o.maxTokens) {
    return text;
  }

  const path = o.save(text);
  const lines = text.split("\n");
  const totalLines = lines.length;
  const footer = `[Full output (${totalLines} lines): ${path}. Read it with a line range or grep.]`;
  const headerFor = (count: number): string =>
    `[... ${count} lines omitted. Important lines from the omitted part:]`;

  const reserve = o.estimate(headerFor(totalLines)) + o.estimate(footer) + 8;
  const remaining = Math.max(0, o.maxTokens - reserve);
  const importantBudget = Math.floor(remaining * 0.25);
  const tailBudget = Math.floor(remaining * 0.25);
  const headBudget = remaining - importantBudget - tailBudget;

  const head = takeHead(lines, 0, totalLines, headBudget, o.estimate);
  const headLines = [...head.lines];
  let headConsumed = head.consumed;

  const tail = takeTail(
    lines,
    headConsumed,
    totalLines,
    tailBudget,
    o.estimate,
  );
  let tailStart = totalLines - tail.consumed;
  let tailLines = tail.lines;
  if (tailStart < headConsumed) {
    tailLines = tailLines.slice(headConsumed - tailStart);
    tailStart = headConsumed;
  }

  let middle = lines.slice(headConsumed, tailStart);
  let important = selectImportant(middle, importantBudget, o.estimate);
  const used = important.length === 0 ? 0 : o.estimate(joinLines(important));
  const leftover = importantBudget - used;
  if (leftover > 0 && headConsumed < tailStart) {
    const extra = takeHead(
      lines,
      headConsumed,
      tailStart,
      leftover,
      o.estimate,
    );
    if (extra.lines.length > 0) {
      headLines.push(...extra.lines);
      headConsumed += extra.consumed;
      middle = lines.slice(headConsumed, tailStart);
      important = selectImportant(middle, importantBudget, o.estimate);
    }
  }

  const omitted = Math.max(0, tailStart - headConsumed);
  const parts: string[] = [];
  if (headLines.length > 0) {
    parts.push(joinLines(headLines));
  }
  if (important.length > 0) {
    parts.push(headerFor(omitted));
    parts.push(joinLines(important));
  }
  parts.push(footer);
  if (tailLines.length > 0) {
    parts.push(joinLines(tailLines));
  }

  return truncateToTokens(parts.join("\n"), o.maxTokens, o.estimate);
}

export function createFileSaver(
  dir: string,
  now: () => number = Date.now,
): (text: string) => string {
  let sequence = 0;
  let ready = false;

  return (text) => {
    if (!ready) {
      mkdirSync(dir, { recursive: true });
      ready = true;
    }
    sequence += 1;
    const name = `${now()}-${String(sequence).padStart(3, "0")}.txt`;
    const path = join(dir, name);
    writeFileSync(path, text, "utf8");
    return path;
  };
}
