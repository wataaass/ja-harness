import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Estimator } from "./tokens.js";

export type SpillOptions = {
  maxTokens: number;
  estimate: Estimator;
  save: (text: string) => string;
};

type ImportantLine = { index: number; text: string };

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

// 末尾の行を決める。1行も入らないときは最後の行の先頭だけを残す。
function pickTail(
  lines: string[],
  budget: number,
  estimate: Estimator,
): { start: number; lines: string[] } | null {
  const total = lines.length;
  const tail = takeTail(lines, 1, total, budget, estimate);
  if (tail.lines.length > 0) {
    return { start: total - tail.consumed, lines: tail.lines };
  }
  const fitted = fitPrefix(lines[total - 1], budget, estimate);
  if (fitted === null) {
    return null;
  }
  return { start: total - 1, lines: [fitted] };
}

// 大事な行を、start から end の手前まで選ぶ。元の行番号も返す。
function selectImportant(
  lines: string[],
  start: number,
  end: number,
  budget: number,
  estimate: Estimator,
): ImportantLine[] {
  const out: ImportantLine[] = [];

  for (let i = start; i < end; i += 1) {
    const line = lines[i];
    if (!IMPORTANT_PATTERN.test(line)) {
      continue;
    }

    const chars = Array.from(line);
    const text =
      chars.length > MAX_IMPORTANT_CHARS
        ? `${chars.slice(0, MAX_IMPORTANT_CHARS).join("")}…`
        : line;
    const candidate = joinLines([...out.map((item) => item.text), text]);
    if (estimate(candidate) > budget) {
      break;
    }
    out.push({ index: i, text });
  }

  return out;
}

export function limitToolResult(text: string, o: SpillOptions): string {
  if (o.estimate(text) <= o.maxTokens) {
    return text;
  }

  const path = o.save(text);
  const lines = text.split("\n");
  const total = lines.length;
  const footer = `[Full output (${total} lines): ${path}. Read it with a line range or grep.]`;
  if (o.estimate(footer) > o.maxTokens) {
    return footer;
  }
  const headerFor = (count: number): string =>
    `[... ${count} lines omitted. Important lines from the omitted part:]`;

  const budget = o.maxTokens - o.estimate(footer) - 2;

  // 末尾
  const tail = pickTail(lines, Math.floor(budget * 0.25), o.estimate);
  if (tail === null) {
    return footer;
  }
  const tailStart = tail.start;
  const tailText = joinLines(tail.lines);

  // 先頭・大事な行に使える残り
  const rest = budget - o.estimate(tailText) - 1;

  // 大事な行（先頭の行 0 と末尾より前の部分から選ぶ）
  const importantBudget = Math.floor(rest / 3);
  const importantRoom = importantBudget - o.estimate(headerFor(total)) - 1;
  const important =
    importantRoom > 0
      ? selectImportant(lines, 1, tailStart, importantRoom, o.estimate)
      : [];

  // 先頭（大事な行があれば、その分の予算を先に引く）
  const importantText = joinLines(important.map((item) => item.text));
  const headBudget =
    important.length > 0
      ? rest - o.estimate(headerFor(total)) - o.estimate(importantText) - 2
      : rest;
  const head = takeHead(lines, 0, tailStart, headBudget, o.estimate);
  let headLines = head.lines;

  // 先頭と重なる大事な行は外す（headLines.length が先頭の終わりの位置）
  let shown = important.filter(
    (item) => item.index >= headLines.length && item.index < tailStart,
  );

  const build = (): string => {
    const headEnd = headLines.length;
    const parts: string[] = [];
    if (headLines.length > 0) {
      parts.push(joinLines(headLines));
    }
    if (shown.length > 0) {
      parts.push(headerFor(tailStart - headEnd));
      parts.push(joinLines(shown.map((item) => item.text)));
    }
    parts.push(footer);
    parts.push(tailText);
    return parts.join("\n");
  };

  // 最後の安全策: 大事な行を後ろから、次に先頭の行を後ろから削る
  let result = build();
  while (o.estimate(result) > o.maxTokens && shown.length > 0) {
    shown = shown.slice(0, -1);
    result = build();
  }
  while (o.estimate(result) > o.maxTokens && headLines.length > 0) {
    headLines = headLines.slice(0, -1);
    result = build();
  }
  return result;
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
