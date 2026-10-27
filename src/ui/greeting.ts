import { formatCost } from "./format.js";
import { getMessages, type Messages } from "./i18n/index.js";
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
  messages?: Messages;
}): string[] {
  const messages = o.messages ?? getMessages();
  const model = o.effort
    ? messages.modelWithEffort(o.model, o.effort)
    : o.model;
  const first = ` ${o.theme.accent(`ja-harness ${o.version}`)}${o.theme.dim("   ")}${model}${o.theme.dim("   ")}${displayCwd(o.cwd, o.home)}`;

  const help = o.theme.dim(messages.greeting.help);
  const second = o.last
    ? ` ${messages.greeting.lastSession(
        formatCost(o.last.cost, messages),
        Math.round(o.last.cacheRatio * 100),
      )}${o.theme.dim("   ")}${help}`
    : ` ${help}`;

  return [truncate(first, o.width), truncate(second, o.width)];
}
