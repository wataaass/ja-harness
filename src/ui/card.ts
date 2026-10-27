import type { Theme } from "./theme.js";
import { padEnd, stringWidth, truncate } from "./width.js";

export function renderCard(o: {
  title: string;
  body: string[];
  footer?: string;
  width: number;
  theme: Theme;
}): string[] {
  const { width, theme } = o;
  if (width <= 0) {
    return [];
  }
  if (width < 60) {
    return renderNarrow(o);
  }

  const inner = width - 4;
  const top =
    o.title === "" ? `╭${"─".repeat(width - 2)}╮` : topLine(o.title, width);
  const lines = [theme.accent(top)];

  for (const body of o.body) {
    const content = padEnd(truncate(body, inner), inner);
    lines.push(`${theme.accent("│ ")}${content}${theme.accent(" │")}`);
  }

  if (o.footer === undefined) {
    lines.push(theme.accent(`╰${"─".repeat(width - 2)}╯`));
  } else {
    const footer = truncate(o.footer, Math.max(0, width - 4));
    const used = 3 + stringWidth(footer);
    const remain = width - used - 1;
    const tail =
      remain > 1 ? ` ${"─".repeat(remain - 1)}╯` : remain === 1 ? "─╯" : "╯";
    lines.push(
      `${theme.accent("╰─ ")}${theme.dim(footer)}${theme.accent(tail)}`,
    );
  }

  return lines;
}

function renderNarrow(o: {
  title: string;
  body: string[];
  footer?: string;
  width: number;
  theme: Theme;
}): string[] {
  const max = Math.max(0, o.width - 2);
  const lines = [
    `${o.theme.accent("│ ")}${o.theme.accent(truncate(o.title, max))}`,
  ];
  for (const body of o.body) {
    lines.push(`${o.theme.accent("│ ")}${truncate(body, max)}`);
  }
  if (o.footer !== undefined) {
    lines.push(
      `${o.theme.accent("│ ")}${o.theme.dim(truncate(o.footer, max))}`,
    );
  }
  return lines;
}

function topLine(title: string, width: number): string {
  const text = truncate(title, Math.max(0, width - 4));
  const remain = width - 3 - stringWidth(text) - 1;
  const tail =
    remain > 1 ? ` ${"─".repeat(remain - 1)}╮` : remain === 1 ? "─╮" : "╮";
  return `╭─ ${text}${tail}`;
}
