import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getMessages, type Messages } from "../ui/i18n/index.js";

export type SettingsEffort = "low" | "medium" | "high";
export type SettingsPermission = "ask" | "auto-edit" | "auto-all";
export type SettingsMode = "run" | "plan" | "ask";
export type SettingsTheme = "dark" | "light" | "auto";
export type SettingsDetails = "brief" | "verbose";
export type SettingsEnter = "send" | "newline";

export type McpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type SettingsMcp = {
  servers?: Record<string, McpServerConfig>;
  enabled?: string[];
  disabled?: string[];
};

export type Settings = {
  model?: string;
  effort?: SettingsEffort;
  permission?: SettingsPermission;
  mode?: SettingsMode;
  ui?: {
    theme?: SettingsTheme;
    details?: SettingsDetails;
    enter?: SettingsEnter;
  };
  language?: { ui?: string };
  skills?: { disabled?: string[] };
  mcp?: SettingsMcp;
};

export type LoadSettingsOptions = {
  cwd: string;
  home: string;
  env: Record<string, string | undefined>;
};

const EFFORTS: SettingsEffort[] = ["low", "medium", "high"];
const PERMISSIONS: SettingsPermission[] = ["ask", "auto-edit", "auto-all"];
const MODES: SettingsMode[] = ["run", "plan", "ask"];
const THEMES: SettingsTheme[] = ["dark", "light", "auto"];
const DETAILS: SettingsDetails[] = ["brief", "verbose"];
const ENTERS: SettingsEnter[] = ["send", "newline"];
const TOP_KEYS = new Set([
  "model",
  "effort",
  "permission",
  "mode",
  "ui",
  "language",
  "skills",
  "mcp",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function allowed(values: readonly string[]): string {
  return values.join("・");
}

function readFile(
  path: string,
  messages: Messages,
): { values: Settings; warnings: string[] } {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { values: {}, warnings: [] };
    }
    return { values: {}, warnings: [messages.settings.unreadable(path)] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { values: {}, warnings: [messages.settings.broken(path)] };
  }
  if (!isObject(parsed)) {
    return { values: {}, warnings: [messages.settings.shape(path)] };
  }

  const values: Settings = {};
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (!TOP_KEYS.has(key)) {
      warnings.push(messages.settings.unknown(path, key));
      continue;
    }
    switch (key) {
      case "model":
        if (typeof value === "string" && value.trim() !== "") {
          values.model = value;
        } else {
          warnings.push(messages.settings.notString(path, key));
        }
        break;
      case "effort":
        if (oneOf(EFFORTS, value)) {
          values.effort = value;
        } else {
          warnings.push(messages.settings.invalid(path, key, allowed(EFFORTS)));
        }
        break;
      case "permission":
        if (oneOf(PERMISSIONS, value)) {
          values.permission = value;
        } else {
          warnings.push(
            messages.settings.invalid(path, key, allowed(PERMISSIONS)),
          );
        }
        break;
      case "mode":
        if (oneOf(MODES, value)) {
          values.mode = value;
        } else {
          warnings.push(messages.settings.invalid(path, key, allowed(MODES)));
        }
        break;
      case "ui": {
        if (!isObject(value)) {
          warnings.push(messages.settings.notObject(path, key));
          break;
        }
        const ui: {
          theme?: SettingsTheme;
          details?: SettingsDetails;
          enter?: SettingsEnter;
        } = {};
        for (const [name, item] of Object.entries(value)) {
          if (name === "theme") {
            if (oneOf(THEMES, item)) {
              ui.theme = item;
            } else {
              warnings.push(
                messages.settings.invalid(path, "ui.theme", allowed(THEMES)),
              );
            }
          } else if (name === "details") {
            if (oneOf(DETAILS, item)) {
              ui.details = item;
            } else {
              warnings.push(
                messages.settings.invalid(path, "ui.details", allowed(DETAILS)),
              );
            }
          } else if (name === "enter") {
            if (oneOf(ENTERS, item)) {
              ui.enter = item;
            } else {
              warnings.push(
                messages.settings.invalid(path, "ui.enter", allowed(ENTERS)),
              );
            }
          } else {
            warnings.push(messages.settings.unknown(path, `ui.${name}`));
          }
        }
        if (Object.keys(ui).length > 0) {
          values.ui = ui;
        }
        break;
      }
      case "skills": {
        if (!isObject(value)) {
          warnings.push(messages.settings.notObject(path, key));
          break;
        }
        const skills: { disabled?: string[] } = {};
        for (const [name, item] of Object.entries(value)) {
          if (name === "disabled") {
            if (
              Array.isArray(item) &&
              item.every((entry) => typeof entry === "string")
            ) {
              const disabled = item.filter(
                (entry) => (entry as string).trim() !== "",
              ) as string[];
              if (disabled.length > 0) {
                skills.disabled = disabled;
              }
            } else {
              warnings.push(
                messages.settings.notStringArray(path, "skills.disabled"),
              );
            }
          } else {
            warnings.push(messages.settings.unknown(path, `skills.${name}`));
          }
        }
        if (Object.keys(skills).length > 0) {
          values.skills = skills;
        }
        break;
      }
      case "mcp": {
        if (!isObject(value)) {
          warnings.push(messages.settings.notObject(path, key));
          break;
        }
        const mcp: SettingsMcp = {};
        for (const [name, item] of Object.entries(value)) {
          if (name === "servers") {
            if (!isObject(item)) {
              warnings.push(messages.settings.notObject(path, "mcp.servers"));
              continue;
            }
            const servers: Record<string, McpServerConfig> = {};
            for (const [serverName, raw] of Object.entries(item)) {
              const prefix = `mcp.servers.${serverName}`;
              if (!isObject(raw)) {
                warnings.push(messages.settings.notObject(path, prefix));
                continue;
              }
              let command: string | undefined;
              let commandWarned = false;
              const args: string[] = [];
              const env: Record<string, string> = {};
              for (const [field, fieldValue] of Object.entries(raw)) {
                if (field === "command") {
                  if (
                    typeof fieldValue === "string" &&
                    fieldValue.trim() !== ""
                  ) {
                    command = fieldValue;
                  } else {
                    commandWarned = true;
                    warnings.push(
                      messages.settings.notString(path, `${prefix}.command`),
                    );
                  }
                } else if (field === "args") {
                  if (
                    Array.isArray(fieldValue) &&
                    fieldValue.every((entry) => typeof entry === "string")
                  ) {
                    args.push(...(fieldValue as string[]));
                  } else {
                    warnings.push(
                      messages.settings.notStringArray(path, `${prefix}.args`),
                    );
                  }
                } else if (field === "env") {
                  if (!isObject(fieldValue)) {
                    warnings.push(
                      messages.settings.notObject(path, `${prefix}.env`),
                    );
                  } else {
                    for (const [envName, envValue] of Object.entries(
                      fieldValue,
                    )) {
                      if (typeof envValue === "string") {
                        env[envName] = envValue;
                      } else {
                        warnings.push(
                          messages.settings.notString(
                            path,
                            `${prefix}.env.${envName}`,
                          ),
                        );
                      }
                    }
                  }
                } else {
                  warnings.push(
                    messages.settings.unknown(path, `${prefix}.${field}`),
                  );
                }
              }
              if (command === undefined) {
                if (!commandWarned) {
                  warnings.push(
                    messages.settings.notString(path, `${prefix}.command`),
                  );
                }
                continue;
              }
              servers[serverName] = {
                command,
                ...(args.length === 0 ? {} : { args }),
                ...(Object.keys(env).length === 0 ? {} : { env }),
              };
            }
            if (Object.keys(servers).length > 0) {
              mcp.servers = servers;
            }
          } else if (name === "enabled" || name === "disabled") {
            if (
              Array.isArray(item) &&
              item.every((entry) => typeof entry === "string")
            ) {
              const list = item.filter(
                (entry) => (entry as string).trim() !== "",
              ) as string[];
              if (list.length > 0) {
                mcp[name] = list;
              }
            } else {
              warnings.push(
                messages.settings.notStringArray(path, `mcp.${name}`),
              );
            }
          } else {
            warnings.push(messages.settings.unknown(path, `mcp.${name}`));
          }
        }
        if (Object.keys(mcp).length > 0) {
          values.mcp = mcp;
        }
        break;
      }
      case "language": {
        if (!isObject(value)) {
          warnings.push(messages.settings.notObject(path, key));
          break;
        }
        const language: { ui?: string } = {};
        for (const [name, item] of Object.entries(value)) {
          if (name === "ui") {
            if (typeof item === "string" && item.trim() !== "") {
              language.ui = item;
            } else {
              warnings.push(messages.settings.notString(path, "language.ui"));
            }
          } else {
            warnings.push(messages.settings.unknown(path, `language.${name}`));
          }
        }
        if (Object.keys(language).length > 0) {
          values.language = language;
        }
        break;
      }
      default:
        break;
    }
  }

  return { values, warnings };
}

function merge(base: Settings, next: Settings): Settings {
  const merged: Settings = { ...base, ...next };
  if (base.ui !== undefined || next.ui !== undefined) {
    merged.ui = { ...base.ui, ...next.ui };
  }
  if (base.language !== undefined || next.language !== undefined) {
    merged.language = { ...base.language, ...next.language };
  }
  if (base.skills !== undefined || next.skills !== undefined) {
    const disabled = [
      ...new Set([
        ...(base.skills?.disabled ?? []),
        ...(next.skills?.disabled ?? []),
      ]),
    ];
    merged.skills = disabled.length > 0 ? { disabled } : {};
  }
  if (base.mcp !== undefined || next.mcp !== undefined) {
    const servers = { ...base.mcp?.servers, ...next.mcp?.servers };
    const enabled = [
      ...new Set([...(base.mcp?.enabled ?? []), ...(next.mcp?.enabled ?? [])]),
    ];
    const disabled = [
      ...new Set([
        ...(base.mcp?.disabled ?? []),
        ...(next.mcp?.disabled ?? []),
      ]),
    ];
    merged.mcp = {
      ...(Object.keys(servers).length === 0 ? {} : { servers }),
      ...(enabled.length === 0 ? {} : { enabled }),
      ...(disabled.length === 0 ? {} : { disabled }),
    };
  }
  return merged;
}

function applyEnv(
  settings: Settings,
  env: Record<string, string | undefined>,
): Settings {
  const next: Settings = { ...settings };
  const model = env.JA_HARNESS_MODEL;
  if (model !== undefined && model !== "") {
    next.model = model;
  }
  const effort = env.JA_HARNESS_EFFORT;
  if (oneOf(EFFORTS, effort)) {
    next.effort = effort;
  }
  const lang = env.JA_HARNESS_LANG;
  if (lang !== undefined && lang !== "") {
    next.language = { ...next.language, ui: lang };
  }
  return next;
}

export function readDisabledSkills(path: string): string[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!isObject(parsed) || !isObject(parsed.skills)) {
    return [];
  }
  const disabled = parsed.skills.disabled;
  if (
    !Array.isArray(disabled) ||
    !disabled.every((entry) => typeof entry === "string")
  ) {
    return [];
  }
  return disabled.filter((entry) => entry.trim() !== "");
}

export function updateDisabledSkills(
  jsonText: string | undefined,
  disabled: string[],
): string {
  const messages = getMessages();
  let parsed: unknown = {};
  if (jsonText !== undefined) {
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(messages.settings.brokenSave);
    }
  }
  if (!isObject(parsed)) {
    throw new Error(messages.settings.shapeSave);
  }
  const next = { ...parsed };
  const skills = isObject(next.skills) ? { ...next.skills } : {};
  skills.disabled = disabled;
  next.skills = skills;
  return `${JSON.stringify(next, null, 2)}\n`;
}

export function readMcpToggles(path: string): {
  enabled: string[];
  disabled: string[];
} {
  const empty = { enabled: [], disabled: [] };
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return empty;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return empty;
  }
  if (!isObject(parsed) || !isObject(parsed.mcp)) {
    return empty;
  }
  const read = (value: unknown): string[] => {
    if (
      !Array.isArray(value) ||
      !value.every((entry) => typeof entry === "string")
    ) {
      return [];
    }
    return value.filter((entry) => entry.trim() !== "");
  };
  return {
    enabled: read(parsed.mcp.enabled),
    disabled: read(parsed.mcp.disabled),
  };
}

export function updateMcpToggles(
  jsonText: string | undefined,
  enabled: string[],
  disabled: string[],
): string {
  const messages = getMessages();
  let parsed: unknown = {};
  if (jsonText !== undefined) {
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(messages.settings.brokenSave);
    }
  }
  if (!isObject(parsed)) {
    throw new Error(messages.settings.shapeSave);
  }
  const next = { ...parsed };
  const mcp = isObject(next.mcp) ? { ...next.mcp } : {};
  mcp.enabled = enabled;
  mcp.disabled = disabled;
  next.mcp = mcp;
  return `${JSON.stringify(next, null, 2)}\n`;
}

export function splitArgs(text: string): string[] {
  const args: string[] = [];
  let current = "";
  let quoted = false;
  let started = false;
  for (const ch of text) {
    if (ch === '"') {
      quoted = !quoted;
      started = true;
      continue;
    }
    if (!quoted && /\s/.test(ch)) {
      if (started) {
        args.push(current);
        current = "";
        started = false;
      }
      continue;
    }
    current += ch;
    started = true;
  }
  if (started) {
    args.push(current);
  }
  return args;
}

export function updateMcpServer(
  jsonText: string | undefined,
  name: string,
  config: McpServerConfig,
): string {
  const messages = getMessages();
  let parsed: unknown = {};
  if (jsonText !== undefined) {
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(messages.settings.brokenSave);
    }
  }
  if (!isObject(parsed)) {
    throw new Error(messages.settings.shapeSave);
  }
  const next = { ...parsed };
  const mcp = isObject(next.mcp) ? { ...next.mcp } : {};
  const servers = isObject(mcp.servers) ? { ...mcp.servers } : {};
  servers[name] = {
    command: config.command,
    ...(config.args === undefined || config.args.length === 0
      ? {}
      : { args: config.args }),
    ...(config.env === undefined || Object.keys(config.env).length === 0
      ? {}
      : { env: config.env }),
  };
  mcp.servers = servers;
  next.mcp = mcp;
  return `${JSON.stringify(next, null, 2)}\n`;
}

export function loadSettings(o: LoadSettingsOptions): {
  settings: Settings;
  warnings: string[];
} {
  const messages = getMessages();
  const homePath = join(o.home, ".ja-harness", "config.json");
  const cwdPath = join(o.cwd, ".ja-harness", "config.json");
  const paths = homePath === cwdPath ? [homePath] : [homePath, cwdPath];

  let settings: Settings = {};
  const warnings: string[] = [];
  for (const path of paths) {
    const loaded = readFile(path, messages);
    settings = merge(settings, loaded.values);
    warnings.push(...loaded.warnings);
  }

  return { settings: applyEnv(settings, o.env), warnings };
}
