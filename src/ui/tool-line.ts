import { getMessages, type Messages } from "./i18n/index.js";
import type { Theme } from "./theme.js";
import { truncate } from "./width.js";

export function toolMark(
  name: string,
  messages: Messages = getMessages(),
): string {
  return messages.toolMarks[name] ?? messages.toolMarkFallback;
}

export function formatToolLine(o: {
  name: string;
  summary: string;
  detail?: string;
  failed?: boolean;
  theme: Theme;
  width: number;
  messages?: Messages;
}): string {
  const messages = o.messages ?? getMessages();
  const mark = toolMark(o.name, messages);
  const prefix = o.failed ? ` ✕${mark}  ` : ` ${mark}  `;
  let line = o.failed
    ? o.theme.error(`${prefix}${o.summary}`)
    : `${prefix}${o.summary}`;
  if (o.detail !== undefined) {
    line += `  ${o.theme.dim(o.detail)}`;
  }
  return truncate(line, o.width);
}
