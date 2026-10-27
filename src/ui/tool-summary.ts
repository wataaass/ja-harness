import { getMessages, type Messages } from "./i18n/index.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function summarizeStart(
  name: string,
  args: unknown,
  messages: Messages = getMessages(),
): string {
  if (!isRecord(args)) {
    return name;
  }

  switch (name) {
    case "read": {
      const paths = args.paths;
      if (
        Array.isArray(paths) &&
        paths.length > 0 &&
        paths.every((path) => typeof path === "string")
      ) {
        return paths.join(", ");
      }
      return "";
    }
    case "list":
      return typeof args.path === "string" ? args.path : ".";
    case "grep": {
      if (typeof args.pattern !== "string") {
        return "";
      }
      return typeof args.path === "string"
        ? `${args.pattern} ${args.path}`
        : args.pattern;
    }
    case "edit":
    case "write":
      return typeof args.path === "string" ? args.path : "";
    case "shell":
      return typeof args.command === "string"
        ? (args.command.split(/\r?\n/)[0] ?? "")
        : "";
    case "submit_plan":
      return messages.toolSummary.plan;
    default:
      return name;
  }
}

export function summarizeEnd(
  name: string,
  result: string,
  isError: boolean,
  messages: Messages = getMessages(),
): string {
  if (isError) {
    const first = result.split(/\r?\n/)[0] ?? "";
    return Array.from(first).slice(0, 50).join("");
  }

  if (/\bdeclined\b/i.test(result)) {
    return messages.toolSummary.declined;
  }

  if (name === "edit") {
    const applied = /applied (\d+) of (\d+) hunks?/i.exec(result);
    if (applied !== null) {
      return messages.toolSummary.partial(applied[1] ?? "", applied[2] ?? "");
    }
  }

  switch (name) {
    case "read": {
      const match = /\(lines \d+-\d+ of (\d+)\)/.exec(result);
      return match === null ? "" : messages.toolSummary.lines(match[1] ?? "");
    }
    case "grep": {
      if (result.trim() === "No matches.") {
        return messages.toolSummary.matches(0);
      }
      const count = result
        .split(/\r?\n/)
        .filter((line) => /^.+?:\d+:/.test(line)).length;
      return messages.toolSummary.matches(count);
    }
    case "shell": {
      const match = /\[exit code (\d+)\]/.exec(result);
      return match === null ? "" : messages.toolSummary.exit(match[1] ?? "");
    }
    case "edit": {
      const match = /:\s*(\d+)\s+replacement/.exec(result);
      return match === null
        ? ""
        : messages.toolSummary.replacements(match[1] ?? "");
    }
    case "write": {
      const match = /\((\d+) lines?\)/.exec(result);
      return match === null
        ? ""
        : messages.toolSummary.writtenLines(match[1] ?? "");
    }
    default:
      return "";
  }
}
