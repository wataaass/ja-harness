import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getMessages } from "../src/ui/i18n/index.js";

const JAPANESE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const uiDir = fileURLToPath(new URL("../src/ui", import.meta.url));

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "i18n") {
        files.push(...sourceFiles(path));
      }
    } else if (name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function japaneseStrings(path: string): string[] {
  const source = readFileSync(path, "utf8");
  const found: string[] = [];
  let index = 0;
  let line = 1;

  const skipLine = (): void => {
    while (index < source.length && source[index] !== "\n") {
      index += 1;
    }
  };
  const skipBlock = (): void => {
    index += 2;
    while (index < source.length) {
      if (source[index] === "*" && source[index + 1] === "/") {
        index += 2;
        return;
      }
      if (source[index] === "\n") {
        line += 1;
      }
      index += 1;
    }
  };
  const readString = (quote: string): void => {
    const start = line;
    let value = "";
    index += 1;
    while (index < source.length) {
      const char = source[index] ?? "";
      if (char === "\\") {
        value += source[index + 1] ?? "";
        index += 2;
        continue;
      }
      if (char === quote) {
        index += 1;
        break;
      }
      if (char === "\n") {
        line += 1;
      }
      value += char;
      index += 1;
    }
    if (JAPANESE.test(value)) {
      found.push(`${relative(uiDir, path)}:${start}: ${value}`);
    }
  };

  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (char === "/" && next === "/") {
      skipLine();
      continue;
    }
    if (char === "/" && next === "*") {
      skipBlock();
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      readString(char);
      continue;
    }
    if (char === "\n") {
      line += 1;
    }
    index += 1;
  }
  return found;
}

describe("getMessages", () => {
  it("ja を返し、知らない言語も ja にする", () => {
    expect(getMessages()).toBe(getMessages("ja"));
    expect(getMessages("xx")).toBe(getMessages("ja"));
    expect(getMessages("xx").modes.run).toBe("実行");
  });
});

describe("画面の文", () => {
  it("i18n の外に日本語の文字列を直書きしない", () => {
    const found = sourceFiles(uiDir).flatMap((path) => japaneseStrings(path));
    expect(found).toEqual([]);
  });
});
