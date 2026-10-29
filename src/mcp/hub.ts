import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { VERSION } from "../version.js";
import type { ResolvedServer } from "./servers.js";

export type McpToolInfo = {
  server: string;
  name: string;
  fullName: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type McpHub = {
  tools: McpToolInfo[];
  warnings: string[];
  call(name: string, args: unknown, signal?: AbortSignal): Promise<string>;
  close(): Promise<void>;
};

type RawTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type RawContent = {
  type?: string;
  text?: string;
  uri?: string;
  resource?: unknown;
  [key: string]: unknown;
};

export type McpCallResult = {
  content?: RawContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

export type McpClientLike = {
  connect(transport: Transport): Promise<void>;
  listTools(
    cursor?: string,
  ): Promise<{ tools: RawTool[]; nextCursor?: string }>;
  callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<McpCallResult>;
  close(): Promise<void>;
};

export type ConnectMcpOptions = {
  cwd?: string;
  timeoutMs?: number;
  createClient?: () => McpClientLike;
};

const DEFAULT_TIMEOUT_MS = 20_000;

function sdkClient(): McpClientLike {
  const client = new Client(
    { name: "ja-harness", version: VERSION },
    { capabilities: {} },
  );
  return {
    connect: (transport) => client.connect(transport),
    listTools: async (cursor) => {
      const result = await client.listTools(
        cursor === undefined ? undefined : { cursor },
      );
      return {
        tools: result.tools as RawTool[],
        ...(result.nextCursor === undefined
          ? {}
          : { nextCursor: result.nextCursor }),
      };
    },
    callTool: async (name, args, signal) =>
      (await client.callTool({ name, arguments: args }, undefined, {
        ...(signal === undefined ? {} : { signal }),
      })) as McpCallResult,
    close: () => client.close(),
  };
}

function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const line = message.replace(/\r\n/g, "\n").split("\n")[0] ?? "";
  return line.trim() === "" ? "connection failed" : line.trim();
}

function commandForPlatform(command: string): string {
  if (
    process.platform === "win32" &&
    (command === "npx" || command === "npm")
  ) {
    return `${command}.cmd`;
  }
  return command;
}

function environment(
  extra: Record<string, string> | undefined,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[name] = value;
    }
  }
  return { ...env, ...extra };
}

async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`timeout after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function collectTools(
  client: McpClientLike,
  server: ResolvedServer,
): Promise<McpToolInfo[]> {
  const tools: McpToolInfo[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor);
    for (const tool of page.tools) {
      tools.push({
        server: server.name,
        name: tool.name,
        fullName: `${server.name}.${tool.name}`,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema ?? { type: "object" },
      });
    }
    const next = page.nextCursor;
    if (next === undefined || seen.has(next)) {
      cursor = undefined;
    } else {
      seen.add(next);
      cursor = next;
    }
  } while (cursor !== undefined);
  return tools;
}

async function connectServer(
  server: ResolvedServer,
  options: Required<Pick<ConnectMcpOptions, "timeoutMs">> & ConnectMcpOptions,
): Promise<{ client: McpClientLike; tools: McpToolInfo[] }> {
  const client = (options.createClient ?? sdkClient)();
  const transport = new StdioClientTransport({
    command: commandForPlatform(server.config.command),
    args: server.config.args ?? [],
    stderr: "ignore",
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    env: environment(server.config.env),
  });

  try {
    const tools = await withTimeout(
      (async () => {
        await client.connect(transport);
        return collectTools(client, server);
      })(),
      options.timeoutMs,
      () => {
        void client.close().catch(() => {});
      },
    );
    return { client, tools };
  } catch (error) {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
    throw error;
  }
}

function resourceUri(item: RawContent): string {
  const resource = item.resource;
  if (
    typeof resource === "object" &&
    resource !== null &&
    typeof (resource as { uri?: unknown }).uri === "string"
  ) {
    return (resource as { uri: string }).uri;
  }
  return typeof item.uri === "string" ? item.uri : "";
}

function formatContent(result: McpCallResult): string {
  const parts: string[] = [];
  for (const item of result.content ?? []) {
    if (item.type === "text" && typeof item.text === "string") {
      parts.push(item.text);
    } else if (item.type === "image") {
      parts.push("[image]");
    } else if (item.type === "audio") {
      parts.push("[audio]");
    } else if (item.type === "resource" || item.type === "resource_link") {
      const uri = resourceUri(item);
      parts.push(uri === "" ? "[resource]" : `[resource: ${uri}]`);
    } else {
      parts.push(`[${item.type ?? "content"}]`);
    }
  }
  if (parts.length > 0) {
    return parts.join("\n");
  }
  if (result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent);
  }
  return "";
}

function asArguments(args: unknown): Record<string, unknown> {
  if (typeof args === "object" && args !== null && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
}

export async function connectMcp(
  servers: ResolvedServer[],
  options: ConnectMcpOptions = {},
): Promise<McpHub> {
  const resolved: Required<Pick<ConnectMcpOptions, "timeoutMs">> &
    ConnectMcpOptions = {
    ...options,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  const enabled = servers.filter((server) => server.enabled);
  const warnings: string[] = [];
  const tools: McpToolInfo[] = [];
  const clients = new Map<string, McpClientLike>();

  await Promise.all(
    enabled.map(async (server) => {
      try {
        const connected = await connectServer(server, resolved);
        clients.set(server.name, connected.client);
        tools.push(...connected.tools);
      } catch (error) {
        warnings.push(`${server.name}: ${oneLine(error)}`);
      }
    }),
  );

  tools.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    tools,
    warnings,
    async call(name: string, args: unknown, signal?: AbortSignal) {
      const tool = tools.find((candidate) => candidate.fullName === name);
      if (tool === undefined) {
        throw new Error(`Unknown MCP tool "${name}".`);
      }
      const client = clients.get(tool.server);
      if (client === undefined) {
        throw new Error(`MCP server "${tool.server}" is not connected.`);
      }
      const result = await client.callTool(
        tool.name,
        asArguments(args),
        signal,
      );
      const text = formatContent(result);
      if (result.isError === true) {
        throw new Error(text === "" ? "MCP tool failed." : text);
      }
      return text;
    },
    async close() {
      await Promise.all(
        [...clients.values()].map((client) => client.close().catch(() => {})),
      );
      clients.clear();
    },
  };
}
