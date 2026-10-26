import type { Completion, Message, ToolSpec, Usage } from "../llm/types.js";

export type Tool = ToolSpec & {
  execute: (args: unknown, signal?: AbortSignal) => Promise<string>;
};

export type Complete = (
  messages: Message[],
  tools: ToolSpec[],
  cb?: {
    onText?: (s: string) => void;
    onReasoning?: (s: string) => void;
    signal?: AbortSignal;
  },
) => Promise<Completion>;

export type LoopEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-start"; name: string; args: unknown }
  | { type: "tool-end"; name: string; result: string; isError: boolean }
  | { type: "step-end"; usage: Usage };

export type RunOptions = {
  complete: Complete;
  tools: Tool[];
  messages: Message[];
  maxSteps?: number;
  onEvent?: (e: LoopEvent) => void;
  signal?: AbortSignal;
};

export type RunResult = {
  stop: "done" | "max-steps";
  steps: number;
  usage: Usage;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseArguments(raw: string): { args: unknown; error?: string } {
  if (raw === "") {
    return { args: {} };
  }
  try {
    return { args: JSON.parse(raw) };
  } catch (error) {
    return { args: undefined, error: errorMessage(error) };
  }
}

function addUsage(total: Usage, usage: Usage): void {
  total.input += usage.input;
  total.cachedInput += usage.cachedInput;
  total.output += usage.output;
  total.reasoning += usage.reasoning;
  if (usage.cost !== undefined) {
    total.cost = (total.cost ?? 0) + usage.cost;
  }
}

export async function runTurn(opts: RunOptions): Promise<RunResult> {
  const { complete, tools, messages, onEvent, signal } = opts;
  const maxSteps = opts.maxSteps ?? 30;
  const specs: ToolSpec[] = tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
  const usage: Usage = {
    input: 0,
    cachedInput: 0,
    output: 0,
    reasoning: 0,
  };
  let steps = 0;

  while (true) {
    const completion = await complete(messages, specs, {
      onText: (text) => onEvent?.({ type: "text", text }),
      onReasoning: (text) => onEvent?.({ type: "reasoning", text }),
      signal,
    });
    steps += 1;

    messages.push(completion.message);
    addUsage(usage, completion.usage);
    onEvent?.({ type: "step-end", usage: completion.usage });

    const toolCalls = completion.message.toolCalls;
    if (toolCalls === undefined || toolCalls.length === 0) {
      return { stop: "done", steps, usage };
    }

    for (const call of toolCalls) {
      const parsed = parseArguments(call.arguments);
      const args = parsed.error === undefined ? parsed.args : undefined;
      onEvent?.({ type: "tool-start", name: call.name, args });

      let result: string;
      let isError: boolean;

      if (parsed.error !== undefined) {
        result = `Error: invalid JSON arguments: ${parsed.error}`;
        isError = true;
      } else {
        const tool = tools.find((candidate) => candidate.name === call.name);
        if (tool === undefined) {
          result = `Error: unknown tool "${call.name}"`;
          isError = true;
        } else {
          try {
            result = await tool.execute(args, signal);
            isError = false;
          } catch (error) {
            if (signal?.aborted) {
              throw error;
            }
            result = `Error: ${errorMessage(error)}`;
            isError = true;
          }
        }
      }

      messages.push({ role: "tool", toolCallId: call.id, content: result });
      onEvent?.({ type: "tool-end", name: call.name, result, isError });
    }

    if (steps >= maxSteps) {
      return { stop: "max-steps", steps, usage };
    }
  }
}
