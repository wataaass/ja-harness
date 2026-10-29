import { truncate } from "./width.js";

export type ScreenOutput = {
  write(s: string): void;
  columns?: number;
};

export type ScreenCursor = { row: number; col: number };

export type Screen = {
  setBottom(lines: string[], cursor?: ScreenCursor): void;
  print(lines: string[]): void;
  resize(): void;
  clearBottom(): void;
  close(): void;
};

const DEFAULT_COLUMNS = 80;

export function createScreen(out: ScreenOutput): Screen {
  let rows = 0;
  let cursorRow = 0;
  let lastLines: string[] = [];
  let lastCursor: ScreenCursor | undefined;

  function width(): number {
    const value = out.columns;
    if (value === undefined || !Number.isFinite(value)) {
      return DEFAULT_COLUMNS;
    }
    return Math.max(1, Math.floor(value));
  }

  function erase(): void {
    if (rows === 0) {
      return;
    }
    const up = Math.min(Math.max(cursorRow, 0), rows - 1);
    if (up > 0) {
      out.write(`\x1b[${up}A`);
    }
    out.write("\r\x1b[J");
    rows = 0;
    cursorRow = 0;
  }

  function draw(lines: string[], cursor?: ScreenCursor): void {
    const limit = width();
    const shown = lines.map((line) => truncate(line, limit));
    if (shown.length === 0) {
      return;
    }

    out.write(shown.join("\r\n"));
    rows = shown.length;
    cursorRow = rows - 1;

    if (cursor === undefined) {
      return;
    }

    const row = Math.min(Math.max(Math.floor(cursor.row), 0), rows - 1);
    const col = Math.min(Math.max(Math.floor(cursor.col), 0), limit);
    const up = rows - 1 - row;
    if (up > 0) {
      out.write(`\x1b[${up}A`);
    }
    out.write("\r");
    if (col > 0) {
      out.write(`\x1b[${col}C`);
    }
    cursorRow = row;
  }

  function clearBottom(): void {
    erase();
    lastLines = [];
    lastCursor = undefined;
  }

  return {
    setBottom(lines, cursor) {
      lastLines = [...lines];
      lastCursor = cursor;
      erase();
      draw(lastLines, lastCursor);
    },
    print(lines) {
      erase();
      if (lines.length > 0) {
        out.write(lines.join("\r\n"));
        out.write("\r\n");
      }
      draw(lastLines, lastCursor);
    },
    resize() {
      erase();
      draw(lastLines, lastCursor);
    },
    clearBottom,
    close() {
      clearBottom();
      out.write("\r\n");
    },
  };
}
