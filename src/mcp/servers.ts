import type { McpServerConfig, SettingsMcp } from "../cli/settings.js";
import { getMessages } from "../ui/i18n/index.js";

export type ResolvedServer = {
  name: string;
  config: McpServerConfig;
  enabled: boolean;
};

export type ResolveServersOptions = {
  onWarning?: (warning: string) => void;
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
  const found: ResolvedServer[] = [];

  for (const [name, config] of Object.entries(configured)) {
    if (!NAME_PATTERN.test(name)) {
      options.onWarning?.(messages.mcpInvalidName(name));
      continue;
    }
    found.push({
      name,
      config,
      enabled: isEnabled(name, enabled, disabled),
    });
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function isEnabled(
  name: string,
  enabled: Set<string>,
  disabled: Set<string>,
): boolean {
  if (enabled.has(name)) {
    return true;
  }
  if (disabled.has(name)) {
    return false;
  }
  return true;
}
