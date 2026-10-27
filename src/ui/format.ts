import { getMessages, type Messages } from "./i18n/index.js";

function trimZeros(text: string): string {
  if (!text.includes(".")) {
    return text;
  }
  return text.replace(/0+$/, "").replace(/\.$/, "");
}

export function formatCost(
  usd: number,
  messages: Messages = getMessages(),
): string {
  if (!Number.isFinite(usd)) {
    return messages.cost("0");
  }
  const sign = usd < 0 ? "-" : "";
  const value = Math.abs(usd);
  if (value === 0) {
    return messages.cost("0");
  }
  const decimals = Math.max(0, 1 - Math.floor(Math.log10(value)));
  const text = trimZeros(value.toFixed(Math.min(decimals, 100)));
  return messages.cost(`${sign}${text}`);
}

function scaled(value: number, unit: string): string {
  return `${trimZeros(value.toFixed(1))}${unit}`;
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) {
    return "0";
  }
  const value = Math.max(0, Math.round(n));
  if (value < 1000) {
    return String(value);
  }
  if (value < 1_000_000) {
    return scaled(value / 1000, "k");
  }
  return scaled(value / 1_000_000, "M");
}

export function formatTurnSummary(
  o: {
    tokens: number;
    cost: number;
    cacheRatio: number;
  },
  messages: Messages = getMessages(),
): string {
  const cache = Math.round(o.cacheRatio * 100);
  return messages.turnSummary(
    formatTokens(o.tokens),
    formatCost(o.cost, messages),
    cache,
  );
}
