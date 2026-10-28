import { readFileSync } from "node:fs";
import { DEFAULT_CONFIG } from "./defaults.js";
import { validateConfig } from "./validate.js";

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function mergeDefaults(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = mergeDefaults(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function readBoolean(value) {
  const text = value.trim().toLowerCase();
  if (text === "true" || text === "1" || text === "yes") {
    return true;
  }
  if (text === "false" || text === "0" || text === "no") {
    return false;
  }
  return value;
}

function envOverrides(env) {
  const result = {};
  if (env.APP_HOST !== undefined) {
    result.host = env.APP_HOST;
  }
  if (env.APP_PORT !== undefined) {
    result.port = Number(env.APP_PORT);
  }
  if (env.APP_DEBUG !== undefined) {
    result.debug = readBoolean(env.APP_DEBUG);
  }
  if (env.APP_LOG_LEVEL !== undefined) {
    result.logLevel = env.APP_LOG_LEVEL;
  }
  if (env.APP_DB_URL !== undefined) {
    result.db = { url: env.APP_DB_URL };
  }
  return result;
}

export function loadConfig(path, options = {}) {
  const text = readFileSync(path, "utf8");
  const file = JSON.parse(text);
  const merged = mergeDefaults(DEFAULT_CONFIG, file);
  const env = options.env ?? process.env;
  const config = mergeDefaults(merged, envOverrides(env));
  return validateConfig(config);
}
