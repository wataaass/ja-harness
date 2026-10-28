import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadSettings,
  readMcpToggles,
  splitArgs,
  updateDisabledSkills,
  updateMcpServer,
  updateMcpToggles,
} from "../src/cli/settings.js";

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

  it("skills.disabled を読む", () => {
    const home = makeDir("ja-settings-home-");
    writeConfig(home, JSON.stringify({ skills: { disabled: ["off"] } }));

    expect(load(makeDir("ja-settings-cwd-"), home)).toEqual({
      settings: { skills: { disabled: ["off"] } },
      warnings: [],
    });
  });

  it("skills.disabled が文字列の配列でなければ警告を出す", () => {
    const home = makeDir("ja-settings-home-");
    const path = writeConfig(
      home,
      JSON.stringify({ skills: { disabled: "off" } }),
    );

    const result = load(makeDir("ja-settings-cwd-"), home);
    expect(result.settings).toEqual({});
    expect(result.warnings).toContain(
      `設定ファイルの ${path} の skills.disabled が文字列の配列ではありません`,
    );
  });

  it("skills.disabled は個人と作業フォルダの両方を合わせる（重複なし）", () => {
    const home = makeDir("ja-settings-home-");
    const cwd = makeDir("ja-settings-cwd-");
    writeConfig(home, JSON.stringify({ skills: { disabled: ["a", "b"] } }));
    writeConfig(cwd, JSON.stringify({ skills: { disabled: ["b", "c"] } }));

    expect(load(cwd, home).settings).toEqual({
      skills: { disabled: ["a", "b", "c"] },
    });
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

describe("updateDisabledSkills", () => {
  it("ファイルがなければ skills.disabled だけを作る", () => {
    const output = updateDisabledSkills(undefined, ["demo"]);

    expect(JSON.parse(output)).toEqual({ skills: { disabled: ["demo"] } });
  });

  it("ほかのキーを残して skills.disabled を置き換える", () => {
    const output = updateDisabledSkills(
      JSON.stringify({
        model: "home-model",
        ui: { theme: "light" },
        skills: { disabled: ["old"] },
      }),
      ["new"],
    );

    expect(JSON.parse(output)).toEqual({
      model: "home-model",
      ui: { theme: "light" },
      skills: { disabled: ["new"] },
    });
  });
});

describe("readMcpToggles", () => {
  it("ファイルがなければ空", () => {
    expect(
      readMcpToggles(join(makeDir("ja-mcp-home-"), "config.json")),
    ).toEqual({ enabled: [], disabled: [] });
  });

  it("壊れた JSON は空", () => {
    const path = writeConfig(makeDir("ja-mcp-home-"), "{");
    expect(readMcpToggles(path)).toEqual({ enabled: [], disabled: [] });
  });

  it("mcp.enabled と mcp.disabled を読む", () => {
    const path = writeConfig(
      makeDir("ja-mcp-home-"),
      JSON.stringify({
        model: "demo",
        mcp: { enabled: ["a", ""], disabled: ["b"] },
      }),
    );
    expect(readMcpToggles(path)).toEqual({
      enabled: ["a"],
      disabled: ["b"],
    });
  });
});

describe("updateMcpToggles", () => {
  it("ファイルがなければ mcp の enabled と disabled だけを作る", () => {
    const output = updateMcpToggles(undefined, ["a"], ["b"]);

    expect(JSON.parse(output)).toEqual({
      mcp: { enabled: ["a"], disabled: ["b"] },
    });
  });

  it("ほかのキーと mcp.servers を残して置き換える", () => {
    const output = updateMcpToggles(
      JSON.stringify({
        model: "home-model",
        mcp: {
          servers: { demo: { command: "node" } },
          enabled: ["old"],
          disabled: ["old2"],
        },
      }),
      ["new"],
      ["new2"],
    );

    expect(JSON.parse(output)).toEqual({
      model: "home-model",
      mcp: {
        servers: { demo: { command: "node" } },
        enabled: ["new"],
        disabled: ["new2"],
      },
    });
  });

  it("壊れた JSON は保存しない", () => {
    expect(() => updateMcpToggles("{", [], [])).toThrow(
      "設定ファイルが壊れているので保存しません（JSON として読めません）",
    );
  });
});

describe("splitArgs", () => {
  it("空白で分け、連続する空白はまとめる", () => {
    expect(splitArgs("  npx   textlint   --mcp ")).toEqual([
      "npx",
      "textlint",
      "--mcp",
    ]);
  });

  it("ダブルクォートで囲んだ部分を1つの引数にする", () => {
    expect(
      splitArgs('node "C:\\Program Files\\demo server.mjs" --flag'),
    ).toEqual(["node", "C:\\Program Files\\demo server.mjs", "--flag"]);
  });

  it("空文字は空の配列", () => {
    expect(splitArgs("  ")).toEqual([]);
  });
});

describe("updateMcpServer", () => {
  it("ファイルがなければ mcp.servers に足す", () => {
    const output = updateMcpServer(undefined, "demo", {
      command: "node",
      args: ["server.mjs"],
    });

    expect(JSON.parse(output)).toEqual({
      mcp: { servers: { demo: { command: "node", args: ["server.mjs"] } } },
    });
  });

  it("args が空なら書かず、同じ名前は上書きする", () => {
    const output = updateMcpServer(
      JSON.stringify({
        model: "home-model",
        mcp: {
          servers: { demo: { command: "old", args: ["old"] } },
          enabled: ["demo"],
        },
      }),
      "demo",
      { command: "new", args: [] },
    );

    expect(JSON.parse(output)).toEqual({
      model: "home-model",
      mcp: {
        servers: { demo: { command: "new" } },
        enabled: ["demo"],
      },
    });
  });

  it("壊れた JSON は保存しない", () => {
    expect(() => updateMcpServer("{", "demo", { command: "node" })).toThrow(
      "設定ファイルが壊れているので保存しません（JSON として読めません）",
    );
  });
});
