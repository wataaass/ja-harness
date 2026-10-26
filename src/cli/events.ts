const MAX_SUMMARY_CHARS = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cut(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= MAX_SUMMARY_CHARS) {
    return text;
  }
  return `${chars.slice(0, MAX_SUMMARY_CHARS - 1).join("")}…`;
}

function summarize(
  name: string,
  args: Record<string, unknown>,
): string | undefined {
  switch (name) {
    case "read": {
      const paths = args.paths;
      if (!Array.isArray(paths) || paths.length === 0) {
        return undefined;
      }
      if (!paths.every((path) => typeof path === "string")) {
        return undefined;
      }
      return paths.join(", ");
    }
    case "list": {
      if (args.path === undefined) {
        return ".";
      }
      return typeof args.path === "string" ? args.path : undefined;
    }
    case "grep": {
      if (typeof args.pattern !== "string") {
        return undefined;
      }
      if (args.path === undefined) {
        return args.pattern;
      }
      if (typeof args.path !== "string") {
        return undefined;
      }
      return `${args.pattern} ${args.path}`;
    }
    case "edit":
    case "write":
      return typeof args.path === "string" ? args.path : undefined;
    case "shell": {
      if (typeof args.command !== "string") {
        return undefined;
      }
      return args.command.split(/\r?\n/)[0] ?? "";
    }
    default:
      return undefined;
  }
}

export function formatToolStart(name: string, args: unknown): string {
  if (!isRecord(args)) {
    return `▸ ${name}`;
  }
  const summary = summarize(name, args);
  if (summary === undefined || summary === "") {
    return `▸ ${name}`;
  }
  return `▸ ${name} ${cut(summary)}`;
}
