import type { Tool } from "../agent/loop.js";

export type PlanHandler = (markdown: string) => Promise<string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createPlanTool(handler?: PlanHandler): Tool {
  return {
    name: "submit_plan",
    description:
      "Submit the whole plan in Markdown when the plan is ready. Only available in plan mode.",
    parameters: {
      type: "object",
      properties: {
        markdown: {
          type: "string",
          description: "The whole plan in Markdown.",
        },
      },
      required: ["markdown"],
    },
    maxResultTokens: 2000,
    async execute(args: unknown): Promise<string> {
      if (!isRecord(args) || typeof args.markdown !== "string") {
        throw new Error('submit_plan: "markdown" must be a string');
      }
      if (handler === undefined) {
        return "submit_plan is only available in plan mode.";
      }
      return handler(args.markdown);
    },
  };
}
