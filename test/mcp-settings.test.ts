import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSettings } from "../src/cli/settings.js";

const dirs: string[] = [];

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function writeConfig(dir: string, value: unknown): string {
  const configDir = join(dir, ".ja-harness");
  const path = join(configDir, "config.json");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function load(cwd: string, home: string) {
  return loadSettings({ cwd, home, env: {} });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("mcp の設定", () => {
  it("servers・enabled・disabled を読む", () => {
    const home = makeDir("ja-mcp-settings-home-");
    writeConfig(home, {
      mcp: {
        servers: {
          demo: {
            command: "node",
            args: ["server.mjs"],
            env: { TOKEN: "x" },
          },
        },
        enabled: ["demo"],
        disabled: ["other"],
      },
    });

    expect(load(makeDir("ja-mcp-settings-cwd-"), home)).toEqual({
      settings: {
        mcp: {
          servers: {
            demo: {
              command: "node",
              args: ["server.mjs"],
              env: { TOKEN: "x" },
            },
          },
          enabled: ["demo"],
          disabled: ["other"],
        },
      },
      warnings: [],
    });
  });

  it("おかしい値は使わずに警告を出す", () => {
    const home = makeDir("ja-mcp-settings-home-");
    const path = writeConfig(home, {
      mcp: {
        servers: {
          broken: { args: ["x"] },
          demo: {
            command: 3,
            args: "x",
            env: { TOKEN: 1 },
            extra: true,
          },
          notObject: "x",
        },
        enabled: "demo",
        disabled: [1],
        unknown: true,
      },
      mcp2: {},
    });

    const result = load(makeDir("ja-mcp-settings-cwd-"), home);
    expect(result.settings).toEqual({});
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.servers.broken.command が文字列ではありません"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.servers.demo.command が文字列ではありません"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.servers.demo.args が文字列の配列ではありません"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.servers.demo.env.TOKEN が文字列ではありません"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.servers.demo.extra は知らない設定です"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes(
          `設定ファイルの ${path} の mcp.servers.notObject がオブジェクトではありません`,
        ),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.enabled が文字列の配列ではありません"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.disabled が文字列の配列ではありません"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp.unknown は知らない設定です"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("mcp2 は知らない設定です"),
      ),
    ).toBe(true);
  });

  it("servers は名前ごとに上書きし、enabled と disabled は和集合", () => {
    const home = makeDir("ja-mcp-settings-home-");
    const cwd = makeDir("ja-mcp-settings-cwd-");
    writeConfig(home, {
      mcp: {
        servers: {
          demo: { command: "home" },
          keep: { command: "keep" },
        },
        enabled: ["a", "b"],
        disabled: ["x"],
      },
    });
    writeConfig(cwd, {
      mcp: {
        servers: { demo: { command: "cwd" } },
        enabled: ["b", "c"],
        disabled: ["x", "y"],
      },
    });

    expect(load(cwd, home).settings).toEqual({
      mcp: {
        servers: {
          demo: { command: "cwd" },
          keep: { command: "keep" },
        },
        enabled: ["a", "b", "c"],
        disabled: ["x", "y"],
      },
    });
  });
});
