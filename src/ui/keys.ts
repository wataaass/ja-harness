const ESC = "\x1b";
const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

export type CtrlKey = "c" | "d" | "r" | "o" | "a" | "e" | "k" | "u" | "w" | "l";

export type Key =
  | { type: "char"; text: string }
  | { type: "enter" }
  | { type: "newline" }
  | { type: "backspace" }
  | { type: "delete" }
  | { type: "left" }
  | { type: "right" }
  | { type: "up" }
  | { type: "down" }
  | { type: "home" }
  | { type: "end" }
  | { type: "wordLeft" }
  | { type: "wordRight" }
  | { type: "tab" }
  | { type: "shiftTab" }
  | { type: "escape" }
  | { type: "ctrl"; key: CtrlKey }
  | { type: "paste"; text: string };

export type DecoderState = {
  pending: string;
  paste: string | null;
};

export type DecodeResult = {
  keys: Key[];
  state: DecoderState;
};

export function emptyDecoderState(): DecoderState {
  return { pending: "", paste: null };
}

const CTRL_KEYS: Record<string, CtrlKey> = {
  "\x01": "a",
  "\x03": "c",
  "\x04": "d",
  "\x05": "e",
  "\x0b": "k",
  "\x0c": "l",
  "\x0f": "o",
  "\x12": "r",
  "\x15": "u",
  "\x17": "w",
};

const SS3_KEYS: Record<string, Key> = {
  A: { type: "up" },
  B: { type: "down" },
  C: { type: "right" },
  D: { type: "left" },
  H: { type: "home" },
  F: { type: "end" },
};

type EscapeMatch = { next: number; key: Key | null } | { pending: true };

function modifierOf(body: string): number {
  const parts = body.split(";");
  if (parts.length < 2) {
    return 1;
  }
  const value = Number.parseInt(parts[1] ?? "", 10);
  return Number.isNaN(value) ? 1 : value;
}

function arrowKey(
  direction: "left" | "right" | "up" | "down",
  body: string,
): Key {
  const flags = modifierOf(body) - 1;
  if ((direction === "left" || direction === "right") && (flags & 6) !== 0) {
    return direction === "left" ? { type: "wordLeft" } : { type: "wordRight" };
  }
  return { type: direction };
}

function csiKey(final: string, body: string): Key | null {
  switch (final) {
    case "A":
      return arrowKey("up", body);
    case "B":
      return arrowKey("down", body);
    case "C":
      return arrowKey("right", body);
    case "D":
      return arrowKey("left", body);
    case "H":
      return { type: "home" };
    case "F":
      return { type: "end" };
    case "Z":
      return { type: "shiftTab" };
    case "u":
      return kittyKey(body);
    case "~":
      return tildeKey(body);
    default:
      return null;
  }
}

function kittyKey(body: string): Key | null {
  const parts = body.split(";");
  const code = Number.parseInt(parts[0] ?? "", 10);
  const modifier = Number.parseInt(parts[1] ?? "1", 10);
  if (code === 13) {
    return modifier === 2 ? { type: "newline" } : { type: "enter" };
  }
  if (code === 9) {
    return modifier === 2 ? { type: "shiftTab" } : { type: "tab" };
  }
  if (code === 27) {
    return { type: "escape" };
  }
  return null;
}

function tildeKey(body: string): Key | null {
  const parts = body.split(";");
  if (parts[0] === "27") {
    const modifier = Number.parseInt(parts[1] ?? "1", 10);
    const code = Number.parseInt(parts[2] ?? "", 10);
    if (code === 13) {
      return modifier === 2 ? { type: "newline" } : { type: "enter" };
    }
    if (code === 9) {
      return modifier === 2 ? { type: "shiftTab" } : { type: "tab" };
    }
    return null;
  }
  const code = Number.parseInt(parts[0] ?? "", 10);
  switch (code) {
    case 1:
    case 7:
      return { type: "home" };
    case 3:
      return { type: "delete" };
    case 4:
    case 8:
      return { type: "end" };
    default:
      return null;
  }
}

function parseCsi(input: string, start: number): EscapeMatch {
  let index = start + 2;
  while (index < input.length) {
    const code = input.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) {
      const final = input[index] ?? "";
      const body = input.slice(start + 2, index);
      return { next: index + 1, key: csiKey(final, body) };
    }
    if (code < 0x20 || code > 0x3f) {
      return { next: index + 1, key: null };
    }
    index += 1;
  }
  return { pending: true };
}

function parseEscape(input: string, start: number): EscapeMatch {
  if (start + 1 >= input.length) {
    return { pending: true };
  }
  const next = input[start + 1] ?? "";
  if (next === "[") {
    return parseCsi(input, start);
  }
  if (next === "O") {
    if (start + 2 >= input.length) {
      return { pending: true };
    }
    const final = input[start + 2] ?? "";
    return { next: start + 3, key: SS3_KEYS[final] ?? null };
  }
  if (next === ESC) {
    return { next: start + 1, key: { type: "escape" } };
  }
  const cp = input.codePointAt(start + 1) ?? 0;
  const length = cp > 0xffff ? 2 : 1;
  return { next: start + 1 + length, key: null };
}

function pasteStart(input: string, start: number): number | "pending" | null {
  const rest = input.slice(start, start + PASTE_START.length);
  if (rest === PASTE_START) {
    return start + PASTE_START.length;
  }
  if (PASTE_START.startsWith(rest)) {
    return "pending";
  }
  return null;
}

function scan(input: string, keys: Key[]): DecoderState {
  let chars = "";
  const flush = () => {
    if (chars !== "") {
      keys.push({ type: "char", text: chars });
      chars = "";
    }
  };
  const emit = (key: Key | null) => {
    flush();
    if (key !== null) {
      keys.push(key);
    }
  };

  let index = 0;
  while (index < input.length) {
    const char = input[index] ?? "";
    if (char === ESC) {
      const paste = pasteStart(input, index);
      if (paste === "pending") {
        flush();
        return { pending: input.slice(index), paste: null };
      }
      if (paste !== null) {
        flush();
        const rest = input.slice(paste);
        const end = rest.indexOf(PASTE_END);
        if (end === -1) {
          return { pending: "", paste: rest };
        }
        keys.push({ type: "paste", text: rest.slice(0, end) });
        index = paste + end + PASTE_END.length;
        continue;
      }
      const match = parseEscape(input, index);
      if ("pending" in match) {
        flush();
        return { pending: input.slice(index), paste: null };
      }
      emit(match.key);
      index = match.next;
      continue;
    }

    if (char === "\r") {
      emit({ type: "enter" });
      index += 1;
      continue;
    }
    if (char === "\n") {
      emit({ type: "newline" });
      index += 1;
      continue;
    }
    if (char === "\t") {
      emit({ type: "tab" });
      index += 1;
      continue;
    }
    if (char === "\x7f" || char === "\x08") {
      emit({ type: "backspace" });
      index += 1;
      continue;
    }

    const code = input.charCodeAt(index);
    if (code < 0x20) {
      const ctrl = CTRL_KEYS[char];
      emit(ctrl === undefined ? null : { type: "ctrl", key: ctrl });
      index += 1;
      continue;
    }

    const cp = input.codePointAt(index) ?? code;
    const text = String.fromCodePoint(cp);
    chars += text;
    index += text.length;
  }

  flush();
  return { pending: "", paste: null };
}

export function decodeKeys(
  chunk: string,
  state: DecoderState = emptyDecoderState(),
): DecodeResult {
  const keys: Key[] = [];

  if (state.paste !== null) {
    const combined = state.paste + chunk;
    const end = combined.indexOf(PASTE_END);
    if (end === -1) {
      return { keys, state: { pending: "", paste: combined } };
    }
    keys.push({ type: "paste", text: combined.slice(0, end) });
    const rest = combined.slice(end + PASTE_END.length);
    return { keys, state: scan(rest, keys) };
  }

  const input = state.pending + chunk;
  return { keys, state: scan(input, keys) };
}

export function flushEscape(
  state: DecoderState = emptyDecoderState(),
): DecodeResult {
  const keys: Key[] = [];
  if (state.pending === ESC) {
    keys.push({ type: "escape" });
  } else if (state.pending !== "" && !state.pending.startsWith(ESC)) {
    keys.push({ type: "char", text: state.pending });
  }
  return { keys, state: { pending: "", paste: state.paste } };
}
