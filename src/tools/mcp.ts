import type { Tool } from "../agent/loop.js";
import type { McpHub, McpToolInfo } from "../mcp/hub.js";
import { type Confirm, toDecision } from "./confirm.js";

const MAX_SUMMARY = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function summary(description: string): string {
  const text = description.trim();
  if (text === "") {
    return "";
  }
  const match = /。|\.\s|\n/.exec(text);
  const sentence = match === null ? text : text.slice(0, match.index).trimEnd();
  const chars = [...sentence];
  if (chars.length <= MAX_SUMMARY) {
    return sentence;
  }
  return `${chars.slice(0, MAX_SUMMARY).join("")}…`;
}

export function formatMcpList(tools: McpToolInfo[]): string {
  if (tools.length === 0) {
    return "";
  }
  return [
    "",
    "",
    "# MCP tools",
    "Call the mcp tool with a name only to see its parameters, then call it again with args.",
    ...tools.map((tool) => `- ${tool.fullName}: ${summary(tool.description)}`),
  ].join("\n");
}

export function createMcpTool(hub: McpHub, confirm: Confirm): Tool {
  return {
    name: "mcp",
    description:
      "Use a tool from an MCP server listed in the system prompt. Call with name only to get its parameters.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "MCP tool name from the list.",
        },
        args: {
          type: "object",
          description: "Arguments for the tool.",
        },
      },
      required: ["name"],
    },
    maxResultTokens: 8000,
    async execute(args: unknown, signal?: AbortSignal): Promise<string> {
      if (!isRecord(args)) {
        throw new Error("mcp: arguments must be an object");
      }
      if (typeof args.name !== "string") {
        throw new Error('mcp: "name" must be a string');
      }
      const tool = hub.tools.find(
        (candidate) => candidate.fullName === args.name,
      );
      if (tool === undefined) {
        const available =
          hub.tools.map((candidate) => candidate.fullName).join(", ") || "none";
        return `Unknown MCP tool "${args.name}". Available: ${available}`;
      }
      if (args.args === undefined) {
        return `${tool.fullName}\n${tool.description}\n${JSON.stringify(tool.inputSchema)}`;
      }
      if (!isRecord(args.args)) {
        throw new Error('mcp: "args" must be an object');
      }
      const decision = toDecision(
        await confirm({
          tool: "mcp",
          title: tool.fullName,
          detail: JSON.stringify(args.args, null, 2),
          key: `mcp\u0000${tool.fullName}`,
        }),
      );
      if (!decision.allow) {
        return decision.reason === undefined || decision.reason === ""
          ? "User declined."
          : `User declined: ${decision.reason}`;
      }
      return hub.call(tool.fullName, args.args, signal);
    },
  };
}
