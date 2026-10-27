const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const CSI_SOURCE = `${ESC}\\[[0-?]*[ -/]*[@-~]`;
const OSC_SOURCE = `${ESC}\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)`;
const CSI = new RegExp(CSI_SOURCE, "g");
const OSC = new RegExp(OSC_SOURCE, "g");
const ANSI_AT_START = new RegExp(`^(?:${CSI_SOURCE}|${OSC_SOURCE})`);

const ZERO_WIDTH = /^[\p{M}\p{Cf}]$/u;

function isZeroWidth(cp: number): boolean {
  if (cp >= 0x1160 && cp <= 0x11ff) {
    return true;
  }
  if (cp >= 0x1f3fb && cp <= 0x1f3ff) {
    return true;
  }
  return ZERO_WIDTH.test(String.fromCodePoint(cp));
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xa960 && cp <= 0xa97f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x16fe0 && cp <= 0x16fe4) ||
    (cp >= 0x17000 && cp <= 0x18aff) ||
    (cp >= 0x1b000 && cp <= 0x1b2ff) ||
    (cp >= 0x1f1e6 && cp <= 0x1f1ff) ||
    (cp >= 0x1f200 && cp <= 0x1f2ff) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f680 && cp <= 0x1f6ff) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x1fa70 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

export function charWidth(cp: number): 0 | 1 | 2 {
  if (!Number.isFinite(cp) || cp < 0) {
    return 0;
  }
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) {
    return 0;
  }
  if (isZeroWidth(cp)) {
    return 0;
  }
  if (isWide(cp)) {
    return 2;
  }
  return 1;
}

export function stripAnsi(s: string): string {
  return s.replace(CSI, "").replace(OSC, "");
}

export function stringWidth(s: string): number {
  let width = 0;
  for (const char of stripAnsi(s)) {
    width += charWidth(char.codePointAt(0) ?? 0);
  }
  return width;
}

function codePointWidth(char: string): number {
  return charWidth(char.codePointAt(0) ?? 0);
}

export function truncate(s: string, width: number, ellipsis = "…"): string {
  if (width <= 0) {
    return "";
  }
  if (stringWidth(s) <= width) {
    return s;
  }

  const ellipsisWidth = stringWidth(ellipsis);
  if (ellipsisWidth > width) {
    return "";
  }

  const limit = width - ellipsisWidth;
  let out = "";
  let used = 0;
  let hasAnsi = false;

  for (let i = 0; i < s.length; ) {
    if (s[i] === "\u001B") {
      const match = ANSI_AT_START.exec(s.slice(i));
      if (match) {
        out += match[0];
        hasAnsi = true;
        i += match[0].length;
        continue;
      }
    }
    const cp = s.codePointAt(i) ?? 0;
    const char = String.fromCodePoint(cp);
    const w = charWidth(cp);
    if (used + w > limit) {
      break;
    }
    out += char;
    used += w;
    i += char.length;
  }

  return hasAnsi ? `${out}${ellipsis}\u001B[0m` : out + ellipsis;
}

export function padEnd(s: string, width: number): string {
  const pad = width - stringWidth(s);
  return pad > 0 ? s + " ".repeat(pad) : s;
}

export function wrap(s: string, width: number): string[] {
  const text = stripAnsi(s);
  if (text === "") {
    return [];
  }
  if (width <= 0) {
    return [text];
  }

  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === "") {
      lines.push("");
      continue;
    }
    let current = "";
    let used = 0;
    for (const char of line) {
      const w = codePointWidth(char);
      if (used + w > width && current !== "") {
        lines.push(current);
        current = "";
        used = 0;
      }
      current += char;
      used += w;
      if (used > width) {
        lines.push(current);
        current = "";
        used = 0;
      }
    }
    if (current !== "") {
      lines.push(current);
    }
  }
  return lines;
}
