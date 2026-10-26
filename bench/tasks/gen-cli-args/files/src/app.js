import { parseArgs, usageText } from "./args.js";
import { listOptionNames } from "./spec.js";

export function buildCliConfig(argv, spec, options = {}) {
  const parsed = parseArgs(argv, spec, options);
  return {
    options: parsed.options,
    files: parsed.positional,
    optionCount: listOptionNames(spec).length,
  };
}

export function runCli(argv, spec, command = "app") {
  if (argv.includes("--help") || argv.includes("-h")) {
    return usageText(spec, command);
  }
  const config = buildCliConfig(argv, spec);
  const parts = [JSON.stringify(config.options), ...config.files];
  return parts.join(" ").trim();
}

export function describeConfig(config) {
  const names = Object.keys(config.options).sort();
  return names.map((name) => `${name}=${String(config.options[name])}`).join(",");
}
