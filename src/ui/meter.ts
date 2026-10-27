import type { Theme } from "./theme.js";

export function renderMeter(
  ratio: number,
  theme: Theme,
  opts?: { warn?: boolean },
): string {
  const value = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const filled = Math.round(value * 5);
  const bar = "▰".repeat(filled) + "▱".repeat(5 - filled);
  const percent = `${Math.round(value * 100)}%`;
  return `${opts?.warn ? theme.warn(bar) : theme.accent(bar)} ${percent}`;
}
