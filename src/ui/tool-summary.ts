function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function summarizeStart(name: string, args: unknown): string {
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
    default:
      return name;
  }
}

export function summarizeEnd(
  name: string,
  result: string,
  isError: boolean,
): string {
  if (isError) {
    const first = result.split(/\r?\n/)[0] ?? "";
    return Array.from(first).slice(0, 50).join("");
  }

  switch (name) {
    case "read": {
      const match = /\(lines \d+-\d+ of (\d+)\)/.exec(result);
      return match === null ? "" : `（${match[1]}行）`;
    }
    case "grep": {
      if (result.trim() === "No matches.") {
        return "0件";
      }
      const count = result
        .split(/\r?\n/)
        .filter((line) => /^.+?:\d+:/.test(line)).length;
      return `${count}件`;
    }
    case "shell": {
      const match = /\[exit code (\d+)\]/.exec(result);
      return match === null ? "" : `終了 ${match[1]}`;
    }
    case "edit": {
      const match = /:\s*(\d+)\s+replacement/.exec(result);
      return match === null ? "" : `${match[1]} か所`;
    }
    case "write": {
      const match = /\((\d+) lines?\)/.exec(result);
      return match === null ? "" : `${match[1]}行`;
    }
    default:
      return "";
  }
}
