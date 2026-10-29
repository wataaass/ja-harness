import type { CtrlKey, Key } from "./keys.js";

export type EditorState = {
  text: string;
  cursor: number;
};

export type EditorAction =
  | "submit"
  | "cancel"
  | "exit-request"
  | "history-prev"
  | "history-next"
  | "tab"
  | "shift-tab"
  | "escape"
  | "review"
  | "details"
  | "redraw";

export type ApplyResult = {
  state: EditorState;
  action?: EditorAction;
};

export type EnterMode = "send" | "newline";

export type ApplyOptions = {
  enter?: EnterMode;
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function withCursor(state: EditorState, cursor: number): EditorState {
  return { text: state.text, cursor };
}

function insertText(state: EditorState, text: string): EditorState {
  if (text === "") {
    return state;
  }
  const chars = [...state.text];
  const added = [...text];
  const cursor = clamp(state.cursor, 0, chars.length);
  chars.splice(cursor, 0, ...added);
  return { text: chars.join(""), cursor: cursor + added.length };
}

function removeRange(
  state: EditorState,
  start: number,
  end: number,
): EditorState {
  const chars = [...state.text];
  const from = clamp(start, 0, chars.length);
  const to = clamp(end, from, chars.length);
  chars.splice(from, to - from);
  return { text: chars.join(""), cursor: from };
}

function lineStartOf(chars: string[], cursor: number): number {
  return chars.lastIndexOf("\n", cursor - 1) + 1;
}

function lineEndOf(chars: string[], cursor: number): number {
  const index = chars.indexOf("\n", cursor);
  return index === -1 ? chars.length : index;
}

function wordLeftFrom(chars: string[], cursor: number): number {
  let index = clamp(cursor, 0, chars.length);
  while (index > 0 && /\s/u.test(chars[index - 1] ?? "")) {
    index -= 1;
  }
  while (index > 0 && !/\s/u.test(chars[index - 1] ?? "")) {
    index -= 1;
  }
  return index;
}

function wordRightFrom(chars: string[], cursor: number): number {
  const length = chars.length;
  let index = clamp(cursor, 0, length);
  while (index < length && /\s/u.test(chars[index] ?? "")) {
    index += 1;
  }
  while (index < length && !/\s/u.test(chars[index] ?? "")) {
    index += 1;
  }
  return index;
}

function moveUp(state: EditorState): ApplyResult {
  const chars = [...state.text];
  const cursor = clamp(state.cursor, 0, chars.length);
  const start = lineStartOf(chars, cursor);
  if (start === 0) {
    return { state, action: "history-prev" };
  }
  const previousEnd = start - 1;
  const previousStart = lineStartOf(chars, previousEnd);
  const column = cursor - start;
  const offset = Math.min(column, previousEnd - previousStart);
  return { state: withCursor(state, previousStart + offset) };
}

function moveDown(state: EditorState): ApplyResult {
  const chars = [...state.text];
  const cursor = clamp(state.cursor, 0, chars.length);
  const start = lineStartOf(chars, cursor);
  const end = lineEndOf(chars, cursor);
  if (end >= chars.length) {
    return { state, action: "history-next" };
  }
  const nextStart = end + 1;
  const nextEnd = lineEndOf(chars, nextStart);
  const column = cursor - start;
  const offset = Math.min(column, nextEnd - nextStart);
  return { state: withCursor(state, nextStart + offset) };
}

export function applyKey(
  state: EditorState,
  key: Key,
  options?: ApplyOptions,
): ApplyResult {
  const chars = [...state.text];
  const cursor = clamp(state.cursor, 0, chars.length);
  const enter = options?.enter ?? "send";

  switch (key.type) {
    case "char":
      return { state: insertText(state, key.text) };
    case "paste":
      return {
        state: insertText(state, key.text.replace(/\r\n?/g, "\n")),
      };
    case "newline":
      if (enter === "newline") {
        if (state.text.trim() === "") {
          return { state };
        }
        return { state, action: "submit" };
      }
      return { state: insertText(state, "\n") };
    case "enter":
      if (state.text.trim() === "") {
        return { state };
      }
      if (enter !== "newline") {
        return { state, action: "submit" };
      }
      {
        const start = lineStartOf(chars, cursor);
        const end = lineEndOf(chars, cursor);
        if (start !== end) {
          return { state: insertText(state, "\n") };
        }
        const from = start > 0 ? start - 1 : end;
        return {
          state: removeRange(state, from, from + 1),
          action: "submit",
        };
      }
    case "backspace":
      if (cursor === 0) {
        return { state };
      }
      return { state: removeRange(state, cursor - 1, cursor) };
    case "delete":
      if (cursor >= chars.length) {
        return { state };
      }
      return { state: removeRange(state, cursor, cursor + 1) };
    case "left":
      return { state: withCursor(state, Math.max(0, cursor - 1)) };
    case "right":
      return { state: withCursor(state, Math.min(chars.length, cursor + 1)) };
    case "home":
      return { state: withCursor(state, lineStartOf(chars, cursor)) };
    case "end":
      return { state: withCursor(state, lineEndOf(chars, cursor)) };
    case "wordLeft":
      return {
        state: withCursor(state, wordLeftFrom(chars, cursor)),
      };
    case "wordRight":
      return {
        state: withCursor(state, wordRightFrom(chars, cursor)),
      };
    case "up":
      return moveUp(state);
    case "down":
      return moveDown(state);
    case "tab":
      return { state, action: "tab" };
    case "shiftTab":
      return { state, action: "shift-tab" };
    case "escape":
      return { state, action: "escape" };
    case "ctrl":
      return applyCtrl(state, key.key);
  }
}

function applyCtrl(state: EditorState, key: CtrlKey): ApplyResult {
  const chars = [...state.text];
  const cursor = clamp(state.cursor, 0, chars.length);

  switch (key) {
    case "a":
      return { state: withCursor(state, lineStartOf(chars, cursor)) };
    case "e":
      return { state: withCursor(state, lineEndOf(chars, cursor)) };
    case "c":
      if (state.text === "") {
        return { state, action: "cancel" };
      }
      return { state: { text: "", cursor: 0 } };
    case "d":
      if (state.text === "") {
        return { state, action: "exit-request" };
      }
      return { state };
    case "k":
      return {
        state: removeRange(state, cursor, lineEndOf(chars, cursor)),
      };
    case "u":
      return {
        state: removeRange(state, lineStartOf(chars, cursor), cursor),
      };
    case "w":
      return {
        state: removeRange(state, wordLeftFrom(chars, cursor), cursor),
      };
    case "r":
      return { state, action: "review" };
    case "o":
      return { state, action: "details" };
    case "l":
      return { state, action: "redraw" };
    default:
      return { state };
  }
}

function isZeroWidth(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0xfe20 && cp <= 0xfe2f) ||
    (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
    cp === 0x200b ||
    cp === 0x200c ||
    cp === 0x200d ||
    cp === 0x2060 ||
    cp === 0xfeff
  );
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

function displayWidth(char: string): number {
  const cp = char.codePointAt(0) ?? 0;
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) {
    return 0;
  }
  if (isZeroWidth(cp)) {
    return 0;
  }
  return isWide(cp) ? 2 : 1;
}

export type RenderedEditor = {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
};

export function renderEditor(
  state: EditorState,
  width: number,
): RenderedEditor {
  const limit = Math.max(1, Number.isFinite(width) ? Math.floor(width) : 1);
  const chars = [...state.text];
  const cursor = clamp(state.cursor, 0, chars.length);
  const lines: string[] = [];
  let row = 0;
  let col = 0;
  let cursorRow = 0;
  let cursorCol = 0;

  const ensure = (target: number) => {
    while (lines.length <= target) {
      lines.push("");
    }
  };
  const recordCursor = () => {
    cursorRow = row;
    cursorCol = col;
  };

  ensure(0);
  for (let index = 0; index < chars.length; index += 1) {
    if (index === cursor) {
      recordCursor();
    }
    const char = chars[index] ?? "";
    if (char === "\n") {
      row += 1;
      ensure(row);
      col = 0;
      continue;
    }
    const charWidth = displayWidth(char);
    if (col > 0 && col + charWidth > limit) {
      row += 1;
      ensure(row);
      col = 0;
    }
    lines[row] = (lines[row] ?? "") + char;
    col += charWidth;
  }

  if (cursor === chars.length) {
    recordCursor();
  }

  return { lines, cursorRow, cursorCol };
}
