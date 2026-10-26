import { hasOwn, isFiniteNumber, isPlainObject, parseNumberStrict } from "./util.js";

const TYPES = new Set(["string", "number", "boolean"]);

export function normalizeSpec(spec) {
  if (!isPlainObject(spec)) throw new TypeError("spec must be an object");
  const entries = new Map();
  const aliases = new Map();
  const defaults = {};
  for (const [name, raw] of Object.entries(spec)) {
    if (name === "" || name.startsWith("-")) {
      throw new TypeError(`invalid option name: ${name}`);
    }
    if (!isPlainObject(raw)) throw new TypeError(`invalid descriptor for ${name}`);
    const type = raw.type ?? "string";
    if (!TYPES.has(type)) throw new TypeError(`unknown type for ${name}: ${type}`);
    const descriptor = { ...raw, name, type };
    if (hasOwn(descriptor, "alias")) {
      const alias = descriptor.alias;
      if (typeof alias !== "string" || [...alias].length !== 1) {
        throw new TypeError(`alias for ${name} must be one character`);
      }
      if (aliases.has(alias)) {
        throw new TypeError(`duplicate alias: ${alias}`);
      }
      aliases.set(alias, name);
    }
    if (hasOwn(descriptor, "default")) {
      const value = descriptor.default;
      const valid =
        (type === "string" && typeof value === "string") ||
        (type === "number" && isFiniteNumber(value)) ||
        (type === "boolean" && typeof value === "boolean");
      if (!valid) throw new TypeError(`default for ${name} does not match ${type}`);
      defaults[name] = value;
    }
    entries.set(name, descriptor);
  }
  return { entries, aliases, defaults };
}

export function splitLongOption(token) {
  const body = token.slice(2);
  const equals = body.indexOf("=");
  if (equals === -1) return { name: body, hasValue: false, value: undefined };
  return {
    name: body.slice(0, equals),
    hasValue: true,
    value: body.slice(equals + 1),
  };
}

export function coerceValue(descriptor, raw) {
  if (descriptor.type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new Error(`invalid boolean for --${descriptor.name}: ${raw}`);
  }
  if (descriptor.type === "number") {
    const number = parseNumberStrict(raw);
    if (number === undefined) {
      throw new Error(`invalid number for --${descriptor.name}: ${raw}`);
    }
    return number;
  }
  return String(raw);
}

export function formatOptionHelp(name, descriptor) {
  const type = descriptor.type ?? "string";
  const alias = descriptor.alias === undefined ? "" : `, -${descriptor.alias}`;
  const fallback = hasOwn(descriptor, "default") ? ` (default: ${descriptor.default})` : "";
  const placeholder = type === "boolean" ? "" : ` <${type}>`;
  return `--${name}${alias}${placeholder}${fallback}`;
}

export function listOptionNames(spec) {
  return Object.keys(spec).sort();
}
