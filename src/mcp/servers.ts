import type { McpServerConfig, SettingsMcp } from "../cli/settings.js";
import { getMessages } from "../ui/i18n/index.js";

export type ResolvedServer = {
  name: string;
  config: McpServerConfig;
  source: "builtin" | "config";
  enabled: boolean;
};

export type ResolveServersOptions = {
  onWarning?: (warning: string) => void;
};

const BUILTIN_SERVERS: Record<string, McpServerConfig> = {
  "nihongo-kit": { command: "npx", args: ["-y", "nihongo-kit"] },
};

const NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

export function resolveServers(
  mcp?: SettingsMcp,
  options: ResolveServersOptions = {},
): ResolvedServer[] {
  const messages = getMessages();
  const configured = mcp?.servers ?? {};
  const enabled = new Set(mcp?.enabled ?? []);
  const disabled = new Set(mcp?.disabled ?? []);
  const found = new Map<string, ResolvedServer>();

  for (const [name, config] of Object.entries(BUILTIN_SERVERS)) {
    found.set(name, {
      name,
      config,
      source: "builtin",
      enabled: isEnabled(name, "builtin", enabled, disabled),
    });
  }

  for (const [name, config] of Object.entries(configured)) {
    if (!NAME_PATTERN.test(name)) {
      options.onWarning?.(messages.mcpInvalidName(name));
      continue;
    }
    found.set(name, {
      name,
      config,
      source: "config",
      enabled: isEnabled(name, "config", enabled, disabled),
    });
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isEnabled(
  name: string,
  source: ResolvedServer["source"],
  enabled: Set<string>,
  disabled: Set<string>,
): boolean {
  if (enabled.has(name)) {
    return true;
  }
  if (disabled.has(name)) {
    return false;
  }
  return source === "config";
}
