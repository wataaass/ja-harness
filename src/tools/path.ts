import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

function toSlashes(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

export function resolvePath(cwd: string, input: string): string {
  return isAbsolute(input) ? normalize(input) : resolve(cwd, input);
}

export function displayPath(cwd: string, abs: string): string {
  const rel = relative(cwd, abs);
  const outside =
    rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (outside) {
    return rel === "" ? "." : toSlashes(abs);
  }
  return toSlashes(rel);
}
