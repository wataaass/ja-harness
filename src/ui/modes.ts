import { getMessages, type Messages } from "./i18n/index.js";

export type Mode = "run" | "plan" | "ask";

export const MODES: Mode[] = ["run", "plan", "ask"];

const NOTICES: Record<Mode, string> = {
  run: "Run mode: you may read, edit files and run commands.",
  plan: "Plan mode: read and search only. Do not edit files or run commands. When the plan is ready, call submit_plan with the whole plan in Markdown.",
  ask: "Ask mode: answer using read, list and grep only. Do not edit files or run commands.",
};

const BLOCKED_TOOLS = new Set(["edit", "write", "shell"]);

export function nextMode(mode: Mode): Mode {
  const index = MODES.indexOf(mode);
  return MODES[(index + 1) % MODES.length] ?? "run";
}

export function modeLabel(
  mode: Mode,
  messages: Messages = getMessages(),
): string {
  return messages.modes[mode];
}

export function modeNotice(mode: Mode): string {
  return NOTICES[mode];
}

export function parseMode(
  text: string,
  messages: Messages = getMessages(),
): Mode | undefined {
  const value = text.trim();
  const byLabel = MODES.find((mode) => messages.modes[mode] === value);
  if (byLabel !== undefined) {
    return byLabel;
  }
  return MODES.find((mode) => mode === value);
}

export function modeAllowsTool(mode: Mode, name: string): boolean {
  if (mode === "run") {
    return true;
  }
  return !BLOCKED_TOOLS.has(name);
}

export function blockedToolMessage(mode: Mode): string {
  return `Not allowed in ${mode} mode. Only read, list and grep are allowed.`;
}
