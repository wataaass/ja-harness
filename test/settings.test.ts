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

function writeConfig(dir: string, content: string): string {
  const configDir = join(dir, ".ja-harness");
  const path = join(configDir, "config.json");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(path, content);
  return path;
}

function load(cwd: string, home: string, env = {}) {
  return loadSettings({ cwd, home, env });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadSettings", () => {
  it("ファイルがなければ空", () => {
    expect(
      load(makeDir("ja-settings-cwd-"), makeDir("ja-settings-home-")),
    ).toEqual({ settings: {}, warnings: [] });
  });

  it("home の設定を読む", () => {
    const home = makeDir("ja-settings-home-");
    writeConfig(
      home,
      JSON.stringify({
        model: "home-model",
        effort: "low",
        permission: "auto-edit",
        mode: "plan",
        ui: { theme: "light", details: "verbose" },
        language: { ui: "ja" },
      }),
    );

    expect(load(makeDir("ja-settings-cwd-"), home)).toEqual({
      settings: {
        model: "home-model",
        effort: "low",
        permission: "auto-edit",
        mode: "plan",
        ui: { theme: "light", details: "verbose" },
        language: { ui: "ja" },
      },
      warnings: [],
    });
  });

  it("ui.enter を読む", () => {
    const home = makeDir("ja-settings-home-");
    writeConfig(home, JSON.stringify({ ui: { enter: "newline" } }));

    expect(load(makeDir("ja-settings-cwd-"), home)).toEqual({
      settings: { ui: { enter: "newline" } },
      warnings: [],
    });
  });

  it("ui.enter の不正な値は使わずに警告を出す", () => {
    const home = makeDir("ja-settings-home-");
    const path = writeConfig(home, JSON.stringify({ ui: { enter: "Enter" } }));

    const result = load(makeDir("ja-settings-cwd-"), home);
    expect(result.settings).toEqual({});
    expect(result.warnings).toContain(
      `設定ファイルの ${path} の ui.enter が正しくありません（send・newline のどれか）`,
    );
  });

  it("両方にあれば作業フォルダのほうが勝ち、キーごとに重ねる", () => {
    const home = makeDir("ja-settings-home-");
    const cwd = makeDir("ja-settings-cwd-");
    writeConfig(
      home,
      JSON.stringify({
        model: "home-model",
        permission: "ask",
        ui: { theme: "dark", details: "brief" },
        language: { ui: "ja" },
      }),
    );
    writeConfig(
      cwd,
      JSON.stringify({
        model: "cwd-model",
        mode: "ask",
        ui: { theme: "light" },
      }),
    );

    expect(load(cwd, home)).toEqual({
      settings: {
        model: "cwd-model",
        permission: "ask",
        mode: "ask",
        ui: { theme: "light", details: "brief" },
        language: { ui: "ja" },
      },
      warnings: [],
    });
  });

  it("壊れた JSON は使わずに警告を出す", () => {
    const home = makeDir("ja-settings-home-");
    const path = writeConfig(home, "{");

    const result = load(makeDir("ja-settings-cwd-"), home);
    expect(result.settings).toEqual({});
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain(`設定ファイルの ${path}`);
    expect(result.warnings[0]).toContain("壊れています");
  });

  it("知らないキーと違う値は使わずに警告を出す", () => {
    const home = makeDir("ja-settings-home-");
    writeConfig(
      home,
      JSON.stringify({
        model: 3,
        effort: "huge",
        permission: "nope",
        mode: "x",
        ui: { theme: "blue", details: "loud", colour: true },
        language: { ui: 5 },
        extra: true,
      }),
    );

    const result = load(makeDir("ja-settings-cwd-"), home);
    expect(result.settings).toEqual({});
    expect(result.warnings).toContain(
      "設定ファイルの " +
        join(home, ".ja-harness", "config.json") +
        " の permission が正しくありません（ask・auto-edit・auto-all のどれか）",
    );
    expect(
      result.warnings.some((warning) =>
        warning.includes("effort が正しくありません（low・medium・high"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("ui.theme が正しくありません（dark・light・auto"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("ui.colour は知らない設定です"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("language.ui が文字列ではありません"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("extra は知らない設定です"),
      ),
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("model が文字列ではありません"),
      ),
    ).toBe(true);
  });

  it("環境変数が設定ファイルより優先する", () => {
    const home = makeDir("ja-settings-home-");
    writeConfig(
      home,
      JSON.stringify({
        model: "file-model",
        effort: "low",
        language: { ui: "ja" },
      }),
    );

    expect(
      load(makeDir("ja-settings-cwd-"), home, {
        JA_HARNESS_MODEL: "env-model",
        JA_HARNESS_EFFORT: "high",
        JA_HARNESS_LANG: "en",
      }).settings,
    ).toEqual({
      model: "env-model",
      effort: "high",
      language: { ui: "en" },
    });
  });
});
