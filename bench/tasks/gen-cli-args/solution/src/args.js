const TYPES = new Set(["string", "number", "boolean"]);

export function parseArgs(argv, spec = {}) {
  if (!Array.isArray(argv)) throw new TypeError("argv must be an array");
  if (spec === null || typeof spec !== "object") {
    throw new TypeError("spec must be an object");
  }
  const longMap = new Map();
  const aliasMap = new Map();
  for (const [name, descriptor] of Object.entries(spec)) {
    const type = descriptor.type ?? "string";
    if (!TYPES.has(type)) throw new TypeError(`unknown type: ${type}`);
    longMap.set(name, { name, ...descriptor, type });
    if (descriptor.alias) aliasMap.set(descriptor.alias, name);
  }

  const options = {};
  for (const [name, descriptor] of longMap) {
    if (Object.prototype.hasOwnProperty.call(descriptor, "default")) {
      options[name] = descriptor.default;
    }
  }

  const positional = [];
  let stop = false;
  let i = 0;

  const assign = (name, raw, hasValue) => {
    const descriptor = longMap.get(name);
    if (descriptor.type === "boolean") {
      if (!hasValue) {
        options[name] = true;
      } else if (raw === "true") {
        options[name] = true;
      } else if (raw === "false") {
        options[name] = false;
      } else {
        throw new Error(`invalid boolean for --${name}: ${raw}`);
      }
      return;
    }
    if (!hasValue) throw new Error(`missing value for --${name}`);
    if (descriptor.type === "number") {
      const number = Number(raw);
      if (raw === "" || Number.isNaN(number)) {
        throw new Error(`invalid number for --${name}: ${raw}`);
      }
      options[name] = number;
    } else {
      options[name] = raw;
    }
  };

  while (i < argv.length) {
    const token = argv[i];
    if (stop) {
      positional.push(token);
      i += 1;
      continue;
    }
    if (token === "--") {
      stop = true;
      i += 1;
      continue;
    }
    if (token === "-" || !token.startsWith("-")) {
      positional.push(token);
      i += 1;
      continue;
    }
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const equals = body.indexOf("=");
      const name = equals === -1 ? body : body.slice(0, equals);
      if (!longMap.has(name)) throw new Error(`unknown option: --${name}`);
      const descriptor = longMap.get(name);
      if (equals !== -1) {
        assign(name, body.slice(equals + 1), true);
        i += 1;
        continue;
      }
      if (descriptor.type === "boolean") {
        assign(name, undefined, false);
        i += 1;
        continue;
      }
      if (i + 1 >= argv.length) throw new Error(`missing value for --${name}`);
      assign(name, argv[i + 1], true);
      i += 2;
      continue;
    }

    const cluster = token.slice(1);
    let consumedNext = false;
    for (let j = 0; j < cluster.length; j += 1) {
      const alias = cluster[j];
      const name = aliasMap.get(alias);
      if (!name) throw new Error(`unknown option: -${alias}`);
      const descriptor = longMap.get(name);
      if (descriptor.type === "boolean") {
        options[name] = true;
        continue;
      }
      const rest = cluster.slice(j + 1);
      if (rest !== "") {
        assign(name, rest, true);
        j = cluster.length;
      } else if (i + 1 < argv.length) {
        assign(name, argv[i + 1], true);
        consumedNext = true;
        j = cluster.length;
      } else {
        throw new Error(`missing value for -${alias}`);
      }
    }
    i += consumedNext ? 2 : 1;
  }

  return { options, positional };
}
