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
  const title = truncate(o.title, Math.max(0, width - 5));
  const titleWidth = stringWidth(title);
  const topRule = "─".repeat(Math.max(0, width - 5 - titleWidth));
  const lines = [theme.accent(`╭─ ${title} ${topRule}╮`)];

  for (const body of o.body) {
    const content = padEnd(truncate(body, inner), inner);
    lines.push(`${theme.accent("│ ")}${content}${theme.accent(" │")}`);
  }

  if (o.footer === undefined) {
    lines.push(theme.accent(`╰${"─".repeat(width - 2)}╯`));
  } else {
    const footer = truncate(o.footer, Math.max(0, width - 5));
    const footerWidth = stringWidth(footer);
    const bottomRule = "─".repeat(Math.max(0, width - 5 - footerWidth));
    lines.push(
      `${theme.accent("╰─ ")}${theme.dim(footer)}${theme.accent(` ${bottomRule}╯`)}`,
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
