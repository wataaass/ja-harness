export interface Theme {
  accent: (s: string) => string;
  dim: (s: string) => string;
  add: (s: string) => string;
  remove: (s: string) => string;
  warn: (s: string) => string;
  error: (s: string) => string;
  bold: (s: string) => string;
}

type Rgb = [number, number, number];

const LEVELS = [0, 95, 135, 175, 215, 255];

const BASE_16: Rgb[] = [
  [0, 0, 0],
  [128, 0, 0],
  [0, 128, 0],
  [128, 128, 0],
  [0, 0, 128],
  [128, 0, 128],
  [0, 128, 128],
  [192, 192, 192],
  [128, 128, 128],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];

function ansi256ToRgb(n: number): Rgb {
  if (n >= 0 && n < 16) {
    return BASE_16[n] ?? [0, 0, 0];
  }
  if (n >= 16 && n <= 231) {
    const index = n - 16;
    const r = LEVELS[Math.floor(index / 36)] ?? 0;
    const g = LEVELS[Math.floor((index % 36) / 6)] ?? 0;
    const b = LEVELS[index % 6] ?? 0;
    return [r, g, b];
  }
  if (n >= 232 && n <= 255) {
    const level = 8 + (n - 232) * 10;
    return [level, level, level];
  }
  return [0, 0, 0];
}

function distance(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function rgbTo256(rgb: Rgb): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let n = 16; n <= 255; n += 1) {
    const d = distance(rgb, ansi256ToRgb(n));
    if (d < bestDistance) {
      bestDistance = d;
      best = n;
    }
  }
  return best;
}

function inferDark(env: NodeJS.ProcessEnv): boolean {
  const value = env.COLORFGBG;
  if (!value) {
    return true;
  }
  const parts = value.split(";");
  const last = parts[parts.length - 1];
  const background = Number.parseInt(last ?? "", 10);
  if (!Number.isFinite(background) || background < 0) {
    return true;
  }
  const [r, g, b] = ansi256ToRgb(background);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 140;
}

function colorizer(rgb: Rgb, truecolor: boolean): (s: string) => string {
  const code = truecolor
    ? `\u001B[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
    : `\u001B[38;5;${rgbTo256(rgb)}m`;
  return (s: string) => `${code}${s}\u001B[0m`;
}

const identity = (s: string) => s;

export function createTheme(opts: {
  env: NodeJS.ProcessEnv;
  isTTY: boolean;
  dark?: boolean;
}): Theme {
  if (opts.env.NO_COLOR !== undefined || !opts.isTTY) {
    return {
      accent: identity,
      dim: identity,
      add: identity,
      remove: identity,
      warn: identity,
      error: identity,
      bold: identity,
    };
  }

  const dark = opts.dark ?? inferDark(opts.env);
  const colorterm = opts.env.COLORTERM?.toLowerCase();
  const truecolor = colorterm === "truecolor" || colorterm === "24bit";
  const accentRgb: Rgb = dark ? [91, 141, 184] : [22, 94, 131];

  return {
    accent: colorizer(accentRgb, truecolor),
    dim: (s) => `\u001B[2m${s}\u001B[0m`,
    add: colorizer([93, 174, 139], truecolor),
    remove: colorizer([217, 119, 107], truecolor),
    warn: colorizer([224, 165, 38], truecolor),
    error: colorizer([201, 51, 58], truecolor),
    bold: (s) => `\u001B[1m${s}\u001B[0m`,
  };
}
