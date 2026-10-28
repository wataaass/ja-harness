import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { connectMcp } from "../src/mcp/hub.js";
import type { ResolvedServer } from "../src/mcp/servers.js";

const fixture = fileURLToPath(
  new URL("./fixtures/mcp-echo-server.mjs", import.meta.url),
);

function server(overrides: Partial<ResolvedServer> = {}): ResolvedServer {
  return {
    name: "echo",
    config: { command: process.execPath, args: [fixture] },
    source: "config",
    enabled: true,
    ...overrides,
  };
}

describe("connectMcp", () => {
  it("stdio でつないで道具を集め、呼び出せる", async () => {
    const hub = await connectMcp([server()]);
    try {
      expect(hub.warnings).toEqual([]);
      expect(hub.tools.map((tool) => tool.fullName)).toEqual([
        "echo.echo",
        "echo.fail",
      ]);
      expect(hub.tools[0]?.description).toBe("Echo the text back.");
      expect(hub.tools[0]?.inputSchema).toMatchObject({
        type: "object",
      });

      await expect(hub.call("echo.echo", { text: "こんにちは" })).resolves.toBe(
        "こんにちは",
      );
      await expect(hub.call("echo.fail", {})).rejects.toThrow("boom");
    } finally {
      await hub.close();
    }
  }, 15000);

  it("存在しない command は警告に入れて落とさない", async () => {
    const hub = await connectMcp(
      [
        server({
          name: "broken",
          config: {
            command: "ja-harness-command-that-does-not-exist",
          },
        }),
      ],
      { timeoutMs: 3000 },
    );
    try {
      expect(hub.tools).toEqual([]);
      expect(hub.warnings).toHaveLength(1);
      expect(hub.warnings[0]).toMatch(/^broken: .+/);
      expect(hub.warnings[0]).not.toContain("\n");
    } finally {
      await hub.close();
    }
  }, 10000);

  it("無効なサーバーにはつながない", async () => {
    const hub = await connectMcp([server({ enabled: false })]);
    try {
      expect(hub.tools).toEqual([]);
      expect(hub.warnings).toEqual([]);
    } finally {
      await hub.close();
    }
  });

  it("close は何度でも落ちない", async () => {
    const hub = await connectMcp([server()]);
    await hub.close();
    await expect(hub.close()).resolves.toBeUndefined();
  });
});
