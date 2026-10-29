import type { Tool } from "../agent/loop.js";
import { readSkillFile, type Skill } from "../agent/skills.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createSkillTool(skills: Skill[]): Tool {
  return {
    name: "skill",
    description:
      "Read a skill's instructions. Use it before a task that a listed skill covers. Pass file to read another file in the skill folder.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill name from the list.",
        },
        file: {
          type: "string",
          description: "Another file in the skill folder.",
        },
      },
      required: ["name"],
    },
    maxResultTokens: 8000,
    async execute(args: unknown): Promise<string> {
      if (!isRecord(args)) {
        throw new Error("skill: arguments must be an object");
      }
      if (typeof args.name !== "string") {
        throw new Error('skill: "name" must be a string');
      }
      if (args.file !== undefined && typeof args.file !== "string") {
        throw new Error('skill: "file" must be a string');
      }
      const skill = skills.find((candidate) => candidate.name === args.name);
      if (skill === undefined) {
        const names = skills.map((candidate) => candidate.name).join(", ");
        return `Unknown skill "${args.name}". Available: ${names}`;
      }
      return readSkillFile(skill, args.file);
    },
  };
}
