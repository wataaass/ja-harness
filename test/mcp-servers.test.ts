import { describe, expect, it } from "vitest";
import { resolveServers } from "../src/mcp/servers.js";

describe("resolveServers", () => {
  it("設定がなければサーバーはない", () => {
    const servers = resolveServers();

    expect(servers).toEqual([]);
  });

  it("設定のサーバーは最初から有効", () => {
    const servers = resolveServers({
      servers: { demo: { command: "node", args: ["server.mjs"] } },
    });

    expect(servers).toContainEqual({
      name: "demo",
      config: { command: "node", args: ["server.mjs"] },
      enabled: true,
    });
  });

  it("enabled が disabled より先に効く", () => {
    const servers = resolveServers({
      servers: { demo: { command: "node" } },
      enabled: ["demo"],
      disabled: ["demo"],
    });
    const byName = new Map(servers.map((server) => [server.name, server]));

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

  it("名前順に並べる", () => {
    const servers = resolveServers({
      servers: {
        zeta: { command: "node" },
        alpha: { command: "node" },
      },
    });

    expect(servers.map((server) => server.name)).toEqual(["alpha", "zeta"]);
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

    expect(servers.map((server) => server.name)).toEqual(["good"]);
    expect(warnings).toEqual([
      "MCP サーバー名 bad name は使えません（英数字・-・_ だけ）",
    ]);
  });
});
