import {
  coerceValue,
  formatOptionHelp,
  listOptionNames as optionNames,
  normalizeSpec,
  splitLongOption,
} from "./spec.js";

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

export function parseArgs(argv, spec = {}, options = {}) {
  if (!Array.isArray(argv)) throw new TypeError("argv must be an array");
  const { entries, aliases, defaults } = normalizeSpec(spec);
  const stopAtPositional = options?.stopAtPositional === true;
  const parsed = { ...defaults };
  const positional = [];
  let stop = false;
  let index = 0;

  while (index < argv.length) {
    const token = String(argv[index]);
    if (stop) {
      positional.push(token);
      index += 1;
      continue;
    }
    if (token === "--") {
      stop = true;
      index += 1;
      continue;
    }
    if (token === "-" || !token.startsWith("-")) {
      positional.push(token);
      if (stopAtPositional) stop = true;
      index += 1;
      continue;
    }
    if (token.startsWith("--")) {
      const { name, hasValue, value } = splitLongOption(token);
      if (!entries.has(name)) throw new Error(`unknown option: --${name}`);
      const descriptor = entries.get(name);
      if (descriptor.type === "boolean") {
        parsed[name] = hasValue ? coerceValue(descriptor, value) : true;
        index += 1;
        continue;
      }
      if (hasValue) {
        parsed[name] = coerceValue(descriptor, value);
        index += 1;
        continue;
      }
      if (index + 1 >= argv.length) throw new Error(`missing value for --${name}`);
      parsed[name] = coerceValue(descriptor, String(argv[index + 1]));
      index += 2;
      continue;
    }

    const cluster = [...token.slice(1)];
    let consumedNext = false;
    for (let position = 0; position < cluster.length; position += 1) {
      const alias = cluster[position];
      if (!aliases.has(alias)) throw new Error(`unknown option: -${alias}`);
      const name = aliases.get(alias);
      const descriptor = entries.get(name);
      if (descriptor.type === "boolean") {
        parsed[name] = true;
        continue;
      }
      const rest = cluster.slice(position + 1).join("");
      if (rest !== "") {
        parsed[name] = coerceValue(descriptor, rest);
        break;
      }
      if (index + 1 >= argv.length) throw new Error(`missing value for -${alias}`);
      parsed[name] = coerceValue(descriptor, String(argv[index + 1]));
      consumedNext = true;
      break;
    }
    index += consumedNext ? 2 : 1;
  }

  return { options: parsed, positional };
}
