import { formatCost } from "./format.js";
import type { Theme } from "./theme.js";
import { truncate } from "./width.js";

function displayCwd(cwd: string, home?: string): string {
  if (!home) {
    return cwd;
  }
  const base = home.replace(/[/\\]+$/, "");
  if (base === "") {
    return cwd;
  }
  if (cwd === base) {
    return "~";
  }
  if (cwd.startsWith(`${base}/`) || cwd.startsWith(`${base}\\`)) {
    return `~${cwd.slice(base.length)}`;
  }
  return cwd;
}

export function renderGreeting(o: {
  version: string;
  model: string;
  effort?: string;
  cwd: string;
  home?: string;
  last?: { cost: number; cacheRatio: number };
  theme: Theme;
  width: number;
}): string[] {
  const model = o.effort ? `${o.model}（${o.effort}）` : o.model;
  const first = ` ${o.theme.accent(`ja-harness ${o.version}`)}${o.theme.dim("   ")}${model}${o.theme.dim("   ")}${displayCwd(o.cwd, o.home)}`;

  const help = o.theme.dim("/help で使い方");
  const second = o.last
    ? ` 前回のセッション ${formatCost(o.last.cost)}・キャッシュ ${Math.round(o.last.cacheRatio * 100)}%${o.theme.dim("   ")}${help}`
    : ` ${help}`;

  return [truncate(first, o.width), truncate(second, o.width)];
}
