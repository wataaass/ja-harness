import { readFileSync } from "node:fs";
import { DEFAULT_CONFIG } from "./defaults.js";
import { validateConfig } from "./validate.js";

export function loadConfig(path) {
  const text = readFileSync(path, "utf8");
  const file = JSON.parse(text);
  const config = { ...file, ...DEFAULT_CONFIG };
  return validateConfig(config);
}
