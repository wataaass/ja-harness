import { describe, expect, it } from "vitest";
import type { McpHub, McpToolInfo } from "../src/mcp/hub.js";
import type { ConfirmRequest } from "../src/tools/confirm.js";
import { createMcpTool, formatMcpList } from "../src/tools/mcp.js";

function info(overrides: Partial<McpToolInfo> = {}): McpToolInfo {
  return {
    server: "demo",
    name: "echo",
    fullName: "demo.echo",
    description: "Demo tool.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
    },
    ...overrides,
  };
}

function fakeHub(
  tools: McpToolInfo[],
  calls: { name: string; args: unknown }[] = [],
): McpHub {
  return {
    tools,
    warnings: [],
    async call(name, args) {
      calls.push({ name, args });
      return "called";
    },
    async close() {},
  };
}

describe("formatMcpList", () => {
  it("道具がなければ空", () => {
    expect(formatMcpList([])).toBe("");
  });

  it("名前と最初の文だけを並べる", () => {
    const text = formatMcpList([
      info({ fullName: "demo.jp", description: "最初の文です。次の文です。" }),
      info({ fullName: "demo.en", description: "First sentence. Second one." }),
      info({ fullName: "demo.line", description: "一行目\n二行目" }),
    ]);

    expect(text).toContain("\n\n# MCP tools\n");
    expect(text).toContain(
      "Call the mcp tool with a name only to see its parameters, then call it again with args.",
    );
    expect(text).toContain("- demo.jp: 最初の文です");
    expect(text).toContain("- demo.en: First sentence");
    expect(text).toContain("- demo.line: 一行目");
  });

  it("120文字を超える文は切って … を付ける", () => {
    const long = "あ".repeat(130);
    const text = formatMcpList([info({ description: long })]);

    expect(text).toContain(`- demo.echo: ${"あ".repeat(120)}…`);
  });
});

describe("createMcpTool", () => {
  it("道具の名前と設定", () => {
    const tool = createMcpTool(fakeHub([info()]), async () => true);

    expect(tool.name).toBe("mcp");
    expect(tool.maxResultTokens).toBe(8000);
    expect(tool.parameters).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        args: { type: "object" },
      },
      required: ["name"],
    });
  });

  it("知らない名前なら使える名前を返す（confirm は出さない）", async () => {
    const seen: ConfirmRequest[] = [];
    const tool = createMcpTool(fakeHub([info()]), async (request) => {
      seen.push(request);
      return true;
    });

    await expect(tool.execute({ name: "unknown" })).resolves.toBe(
      'Unknown MCP tool "unknown". Available: demo.echo',
    );
    expect(seen).toEqual([]);
  });

  it("道具がなければ none と返す", async () => {
    const tool = createMcpTool(fakeHub([]), async () => true);

    await expect(tool.execute({ name: "unknown" })).resolves.toBe(
      'Unknown MCP tool "unknown". Available: none',
    );
  });

  it("args がなければ説明と入力の schema を返す", async () => {
    const schema = {
      type: "object",
      properties: { text: { type: "string" } },
    };
    const seen: ConfirmRequest[] = [];
    const tool = createMcpTool(
      fakeHub([info({ description: "全文の説明", inputSchema: schema })]),
      async (request) => {
        seen.push(request);
        return true;
      },
    );

    await expect(tool.execute({ name: "demo.echo" })).resolves.toBe(
      `demo.echo\n全文の説明\n${JSON.stringify(schema)}`,
    );
    expect(seen).toEqual([]);
  });

  it("args があれば確認してから実行する", async () => {
    const calls: { name: string; args: unknown }[] = [];
    const seen: ConfirmRequest[] = [];
    const tool = createMcpTool(fakeHub([info()], calls), async (request) => {
      seen.push(request);
      return { allow: true };
    });

    const args = { text: "こんにちは" };
    await expect(tool.execute({ name: "demo.echo", args })).resolves.toBe(
      "called",
    );
    expect(seen).toEqual([
      {
        tool: "mcp",
        title: "demo.echo",
        detail: JSON.stringify(args, null, 2),
        key: "mcp\u0000demo.echo",
      },
    ]);
    expect(calls).toEqual([{ name: "demo.echo", args }]);
  });

  it("却下されたら理由を返す", async () => {
    const calls: { name: string; args: unknown }[] = [];
    const declined = createMcpTool(fakeHub([info()], calls), async () => ({
      allow: false,
      reason: "危ない",
    }));
    const plain = createMcpTool(fakeHub([info()], calls), async () => false);

    await expect(
      declined.execute({ name: "demo.echo", args: {} }),
    ).resolves.toBe("User declined: 危ない");
    await expect(plain.execute({ name: "demo.echo", args: {} })).resolves.toBe(
      "User declined.",
    );
    expect(calls).toEqual([]);
  });
});
