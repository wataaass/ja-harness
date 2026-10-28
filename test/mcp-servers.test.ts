import { describe, expect, it } from "vitest";
import { resolveServers } from "../src/mcp/servers.js";

describe("resolveServers", () => {
  it("標準のサーバーは最初は無効", () => {
    const servers = resolveServers();

    expect(servers).toEqual([
      {
        name: "nihongo-kit",
        config: { command: "npx", args: ["-y", "nihongo-kit"] },
        source: "builtin",
        enabled: false,
      },
    ]);
  });

  it("設定のサーバーは最初から有効", () => {
    const servers = resolveServers({
      servers: { demo: { command: "node", args: ["server.mjs"] } },
    });

    expect(servers).toContainEqual({
      name: "demo",
      config: { command: "node", args: ["server.mjs"] },
      source: "config",
      enabled: true,
    });
  });

  it("enabled が disabled より先に効く", () => {
    const servers = resolveServers({
      servers: { demo: { command: "node" } },
      enabled: ["nihongo-kit", "demo"],
      disabled: ["nihongo-kit", "demo"],
    });
    const byName = new Map(servers.map((server) => [server.name, server]));

    expect(byName.get("nihongo-kit")?.enabled).toBe(true);
    expect(byName.get("demo")?.enabled).toBe(true);
  });

  it("disabled なら設定のサーバーも無効", () => {
    const servers = resolveServers({
      servers: { demo: { command: "node" } },
      disabled: ["demo"],
    });

    expect(servers.find((server) => server.name === "demo")?.enabled).toBe(
      false,
    );
  });

  it("同じ名前があれば設定のほうで上書きする", () => {
    const servers = resolveServers({
      servers: { "nihongo-kit": { command: "node", args: ["kit.mjs"] } },
      enabled: ["nihongo-kit"],
    });

    expect(servers).toEqual([
      {
        name: "nihongo-kit",
        config: { command: "node", args: ["kit.mjs"] },
        source: "config",
        enabled: true,
      },
    ]);
  });

  it("名前順に並べる", () => {
    const servers = resolveServers({
      servers: {
        zeta: { command: "node" },
        alpha: { command: "node" },
      },
    });

    expect(servers.map((server) => server.name)).toEqual([
      "alpha",
      "nihongo-kit",
      "zeta",
    ]);
  });

  it("使えない名前は警告して飛ばす", () => {
    const warnings: string[] = [];
    const servers = resolveServers(
      {
        servers: {
          "bad name": { command: "node" },
          good: { command: "node" },
        },
      },
      { onWarning: (warning) => warnings.push(warning) },
    );

    expect(servers.map((server) => server.name)).toEqual([
      "good",
      "nihongo-kit",
    ]);
    expect(warnings).toEqual([
      "MCP サーバー名 bad name は使えません（英数字・-・_ だけ）",
    ]);
  });
});
