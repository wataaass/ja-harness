import { formatCost } from "./format.js";
import { getMessages, type Messages } from "./i18n/index.js";
import { renderMeter } from "./meter.js";
import type { Theme } from "./theme.js";
import { stringWidth, truncate } from "./width.js";

export function renderStatus(o: {
  mode: string;
  permission: string;
  model: string;
  effort?: string;
  contextRatio: number;
  cost: number;
  cacheRatio: number;
  queued?: number;
  warn?: boolean;
  theme: Theme;
  width: number;
  messages?: Messages;
}): string {
  const messages = o.messages ?? getMessages();
  const segments: { key: string; text: string }[] = [
    { key: "mode", text: o.theme.accent(o.mode) },
    { key: "permission", text: o.permission },
  ];
  if (o.queued !== undefined && o.queued > 0) {
    segments.push({ key: "queued", text: messages.status.queued(o.queued) });
  }
  segments.push({
    key: "model",
    text: o.effort ? messages.modelWithEffort(o.model, o.effort) : o.model,
  });
  segments.push({
    key: "context",
    text:
      o.contextRatio > 0 && o.contextRatio < 0.01
        ? messages.status.contextSmall
        : messages.status.context(Math.round(o.contextRatio * 100)),
  });
  segments.push({
    key: "cost",
    text: `${formatCost(o.cost, messages)} ${renderMeter(o.cacheRatio, o.theme, { warn: o.warn })}`,
  });

  const build = () =>
    ` ${segments.map((segment) => segment.text).join(o.theme.dim("  "))}`;
  const over = () => o.width > 0 && stringWidth(build()) > o.width;

  if (over()) {
    remove(segments, "model");
  }
  if (over()) {
    remove(segments, "permission");
  }

  return truncate(build(), o.width);
}

function remove(segments: { key: string; text: string }[], key: string): void {
  const index = segments.findIndex((segment) => segment.key === key);
  if (index >= 0) {
    segments.splice(index, 1);
  }
}
