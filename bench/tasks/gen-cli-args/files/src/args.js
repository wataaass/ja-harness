import { formatOptionHelp, listOptionNames as optionNames } from "./spec.js";

export function listOptionNames(spec) {
  return optionNames(spec);
}

export function usageText(spec, command = "app") {
  const lines = [`使い方: ${command} [options] [files...]`, "", "オプション:"];
  for (const name of listOptionNames(spec)) {
    lines.push(`  ${formatOptionHelp(name, spec[name])}`);
  }
  return lines.join("\n");
}

export function parseArgs() {
  throw new Error("parseArgs is not implemented");
}
