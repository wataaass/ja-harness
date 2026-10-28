import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Complete, runTurn, type Tool } from "../../agent/loop.js";
import { SYSTEM_PROMPT } from "../../agent/prompt.js";
import { type ContextConfig, DEFAULT_CONTEXT } from "../../context/manager.js";
import { SUMMARY_INSTRUCTION } from "../../context/summary.js";
import {
  createEstimator,
  type Estimator,
  estimateMessages,
  lastUserIndex,
} from "../../context/tokens.js";
import {
  findModel,
  type ModelInfo,
  type ModelPrices,
} from "../../llm/models.js";
import type { Message, ToolSpec, Usage } from "../../llm/types.js";
import { createTools } from "../../tools/index.js";
import {
  CONDITIONS,
  type ConditionName,
  createCondition,
} from "../conditions.js";
import { timestamp } from "../workspace.js";
import { type Call, makeScenarios, type Scenario } from "./scenarios.js";

export const DEFAULT_SIM_MODELS = [
  "deepseek-v4.1-flash",
  "kimi-k3",
  "kimi-k3.1-pro",
  "glm-5.3",
  "minimax-m3",
  "qwen3.8-max",
  "claude-haiku-5-5",
];

export const SIM_SCENARIOS = ["short", "medium", "long", "read-heavy"];

export type ContextOverride = Partial<Omit<ContextConfig, "prune" | "mask">> & {
  prune?: Partial<ContextConfig["prune"]>;
  mask?: Partial<ContextConfig["mask"]>;
};

export type PendingCall = { label: string; resultTokens: number };
export type CallQueue = Map<string, PendingCall[]>;

export type SimStats = {
  requests: number;
  steps: number;
  toolCalls: number;
  rereads: number;
  summaries: number;
};

export type SimModel = {
  complete: Complete;
  now: () => number;
  advance: (milliseconds: number) => void;
  startTurn: (index: number) => void;
  stats: SimStats;
};

export type SimRecord = {
  model: string;
  condition: ConditionName;
  scenario: string;
  steps: number;
  toolCalls: number;
  rereads: number;
  summaries: number;
  requests: number;
  usage: Usage;
  cost: number;
};

export type SimOutput = {
  records: SimRecord[];
  resultsPath: string;
  table: string;
};

export type SimOptions = {
  models?: string[];
  conditions?: ConditionName[];
  scenarios?: Array<Scenario | string>;
  context?: ContextOverride;
  cacheTtlSeconds?: number;
  resultsDir?: string;
  now?: Date;
  onProgress?: (line: string) => void;
};

export type RequestPart = { key: string; tokens: number };
export type RequestSnapshot = { parts: RequestPart[]; at: number };

function zeroUsage(): Usage {
  return { input: 0, cachedInput: 0, output: 0, reasoning: 0 };
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

export function fillText(
  tokens: number,
  estimate: Estimator,
  firstLine = "",
): string {
  const target = Math.max(0, Math.round(tokens));
  if (target === 0) {
    return firstLine;
  }
  const lines: string[] = [];
  if (firstLine !== "") {
    lines.push(firstLine);
  }
  let index = 0;
  while (estimate(lines.join("\n")) < target) {
    index += 1;
    lines.push(
      `log ${String(index).padStart(4, "0")} | const value_${index} = compute(${index * 7}); // ascii filler`,
    );
  }
  return lines.join("\n");
}

export function fakeResult(
  label: string,
  resultTokens: number,
  estimate: Estimator,
): string {
  return fillText(resultTokens, estimate, `<<${label}>>`);
}

export function createFakeTools(o: {
  tools: Tool[];
  estimate: Estimator;
  queue: CallQueue;
}): Tool[] {
  return o.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    ...(tool.maxResultTokens === undefined
      ? {}
      : { maxResultTokens: tool.maxResultTokens }),
    async execute(): Promise<string> {
      const pending = o.queue.get(tool.name);
      const item = pending?.shift();
      return fakeResult(
        item?.label ?? "unknown",
        item?.resultTokens ?? 100,
        o.estimate,
      );
    },
  }));
}

export function computeCost(o: {
  prices: ModelPrices;
  tier?: { above: number; prices: ModelPrices };
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
}): number {
  const prices =
    o.tier !== undefined && o.input > o.tier.above ? o.tier.prices : o.prices;
  const cacheWrite = prices.cacheWrite ?? prices.input;
  return (
    ((o.input - o.cachedInput) * cacheWrite +
      o.cachedInput * prices.cachedInput +
      (o.output + o.reasoning) * prices.output) /
    1_000_000
  );
}

function messageTokens(
  messages: Message[],
  index: number,
  lastUser: number,
  estimate: Estimator,
): number {
  const message = messages[index] as Message;
  let total = 4 + estimate(message.content);
  if (message.role === "assistant") {
    if (message.reasoning !== undefined && index > lastUser) {
      total += estimate(message.reasoning);
    }
    for (const call of message.toolCalls ?? []) {
      total += estimate(call.name) + estimate(call.arguments);
    }
  }
  return total;
}

function toolsTokens(tools: ToolSpec[], estimate: Estimator): number {
  let total = 0;
  for (const tool of tools) {
    total += estimate(tool.name);
    total += estimate(tool.description);
    total += estimate(JSON.stringify(tool.parameters));
  }
  return total;
}

export function snapshotRequest(
  messages: Message[],
  tools: ToolSpec[],
  estimate: Estimator,
  at: number,
): RequestSnapshot {
  const parts: RequestPart[] = [];
  const lastUser = lastUserIndex(messages);
  const start = messages[0]?.role === "system" ? 1 : 0;
  if (start === 1) {
    parts.push({
      key: JSON.stringify(messages[0]),
      tokens: messageTokens(messages, 0, lastUser, estimate),
    });
  }
  parts.push({
    key: `tools:${JSON.stringify(tools)}`,
    tokens: toolsTokens(tools, estimate),
  });
  for (let index = start; index < messages.length; index += 1) {
    parts.push({
      key: JSON.stringify(messages[index]),
      tokens: messageTokens(messages, index, lastUser, estimate),
    });
  }
  return { parts, at };
}

export function requestTokens(snapshot: RequestSnapshot): number {
  return snapshot.parts.reduce((sum, part) => sum + part.tokens, 0);
}

export function prefixTokens(
  previous: RequestSnapshot | undefined,
  next: RequestSnapshot,
  now: number,
  cacheTtlSeconds: number,
): number {
  if (previous === undefined || now - previous.at > cacheTtlSeconds * 1000) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < next.parts.length; index += 1) {
    const part = next.parts[index] as RequestPart;
    if (previous.parts[index]?.key !== part.key) {
      break;
    }
    total += part.tokens;
  }
  return total;
}

function enqueue(queue: CallQueue, tool: string, item: PendingCall): void {
  const pending = queue.get(tool);
  if (pending === undefined) {
    queue.set(tool, [item]);
    return;
  }
  pending.push(item);
}

function hasLabel(messages: Message[], label: string): boolean {
  const marker = `<<${label}>>`;
  return messages.some(
    (message) => message.role === "tool" && message.content.includes(marker),
  );
}

function callRegistry(scenario: Scenario): Map<string, Call> {
  const calls = new Map<string, Call>();
  for (const turn of scenario.turns) {
    for (const step of turn.steps) {
      for (const call of step.calls) {
        calls.set(call.label, call);
      }
    }
  }
  return calls;
}

export function createSimModel(o: {
  scenario: Scenario;
  estimate: Estimator;
  queue: CallQueue;
  info: ModelInfo;
  cacheTtlSeconds?: number;
  startAt?: number;
}): SimModel {
  const calls = callRegistry(o.scenario);
  const cacheTtlSeconds = o.cacheTtlSeconds ?? 3600;
  let clock = o.startAt ?? 0;
  let turnIndex = 0;
  let stepIndex = 0;
  let previous: RequestSnapshot | undefined;
  const rereadLabels = new Set<string>();
  const stats: SimStats = {
    requests: 0,
    steps: 0,
    toolCalls: 0,
    rereads: 0,
    summaries: 0,
  };

  function usageFor(
    input: number,
    cachedInput: number,
    output: number,
    reasoning: number,
  ): Usage {
    return {
      input,
      cachedInput,
      output,
      reasoning,
      cost: computeCost({
        prices: o.info.prices,
        ...(o.info.tier === undefined ? {} : { tier: o.info.tier }),
        input,
        cachedInput,
        output,
        reasoning,
      }),
    };
  }

  function countUsage(
    messages: Message[],
    tools: ToolSpec[],
    output: number,
    reasoning: number,
  ): { usage: Usage; input: number; cachedInput: number } {
    const snapshot = snapshotRequest(messages, tools, o.estimate, clock);
    const input = requestTokens(snapshot);
    const cachedInput = prefixTokens(
      previous,
      snapshot,
      clock,
      cacheTtlSeconds,
    );
    previous = snapshot;
    return {
      input,
      cachedInput,
      usage: usageFor(input, cachedInput, output, reasoning),
    };
  }

  function summaryCompletion(
    messages: Message[],
    tools: ToolSpec[],
  ): ReturnType<Complete> {
    stats.summaries += 1;
    const before = messages.slice(0, messages.length - 1);
    const rangeTokens = estimateMessages(before, o.estimate);
    const output = Math.min(4000, Math.max(800, Math.round(rangeTokens * 0.1)));
    const counted = countUsage(messages, tools, output, 0);
    return Promise.resolve({
      message: {
        role: "assistant",
        content: fillText(output, o.estimate),
      },
      usage: counted.usage,
      finishReason: "stop",
    });
  }

  const complete: Complete = async (messages, tools) => {
    clock += 15_000;
    stats.requests += 1;

    const last = messages[messages.length - 1];
    if (
      last !== undefined &&
      last.role === "user" &&
      last.content === SUMMARY_INSTRUCTION
    ) {
      return summaryCompletion(messages, tools);
    }

    const turn = o.scenario.turns[turnIndex];
    if (turn === undefined) {
      const counted = countUsage(messages, tools, 0, 0);
      return {
        message: { role: "assistant", content: "" },
        usage: counted.usage,
        finishReason: "stop",
      };
    }

    const step = turn.steps[stepIndex];
    if (step === undefined) {
      const counted = countUsage(messages, tools, 0, 0);
      return {
        message: { role: "assistant", content: "" },
        usage: counted.usage,
        finishReason: "stop",
      };
    }

    const missing = (step.needs ?? []).filter(
      (label) => !hasLabel(messages, label),
    );
    const target = missing.find((label) => !rereadLabels.has(label));
    if (target !== undefined) {
      const call = calls.get(target);
      if (call !== undefined) {
        rereadLabels.add(target);
        stats.rereads += 1;
        enqueue(o.queue, call.tool, {
          label: call.label,
          resultTokens: call.resultTokens,
        });
        const counted = countUsage(messages, tools, 60, 0);
        return {
          message: {
            role: "assistant",
            content: fillText(60, o.estimate),
            toolCalls: [
              {
                id: `reread-${call.label}`,
                name: call.tool,
                arguments: JSON.stringify(call.args),
              },
            ],
          },
          usage: counted.usage,
          finishReason: "tool_calls",
        };
      }
    }

    rereadLabels.clear();
    stepIndex += 1;
    stats.steps += 1;
    stats.toolCalls += step.calls.length;
    const toolCalls = step.calls.map((call) => {
      enqueue(o.queue, call.tool, {
        label: call.label,
        resultTokens: call.resultTokens,
      });
      return {
        id: call.label,
        name: call.tool,
        arguments: JSON.stringify(call.args),
      };
    });
    const counted = countUsage(
      messages,
      tools,
      step.outputTokens,
      step.reasoningTokens,
    );
    return {
      message: {
        role: "assistant",
        content: fillText(step.outputTokens, o.estimate),
        ...(step.reasoningTokens > 0
          ? { reasoning: fillText(step.reasoningTokens, o.estimate) }
          : {}),
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      },
      usage: counted.usage,
      finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
    };
  };

  return {
    complete,
    now: () => clock,
    advance: (milliseconds) => {
      clock += milliseconds;
    },
    startTurn: (index) => {
      turnIndex = index;
      stepIndex = 0;
      rereadLabels.clear();
    },
    stats,
  };
}

export function mergeContext(
  override: ContextOverride | undefined,
): Partial<ContextConfig> {
  if (override === undefined) {
    return {};
  }
  const { prune, mask, ...rest } = override;
  return {
    ...rest,
    ...(prune === undefined
      ? {}
      : { prune: { ...DEFAULT_CONTEXT.prune, ...prune } }),
    ...(mask === undefined
      ? {}
      : { mask: { ...DEFAULT_CONTEXT.mask, ...mask } }),
  };
}

function resolveScenarios(
  requested: Array<Scenario | string> | undefined,
): Scenario[] {
  const all = makeScenarios();
  if (requested === undefined) {
    return all;
  }
  return requested.map((item) => {
    if (typeof item !== "string") {
      return item;
    }
    const found = all.find((scenario) => scenario.id === item);
    if (found === undefined) {
      throw new Error(`知らない台本です: ${item}`);
    }
    return found;
  });
}

function width(text: string): number {
  let total = 0;
  for (const char of text) {
    total += (char.codePointAt(0) ?? 0) > 0x2e80 ? 2 : 1;
  }
  return total;
}

function pad(text: string, columns: number): string {
  return `${text}${" ".repeat(Math.max(0, columns - width(text)))}`;
}

function render(rows: string[][]): string[] {
  const sizes: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      sizes[index] = Math.max(sizes[index] ?? 0, width(cell));
    });
  }
  return rows.map((row) =>
    row
      .map((cell, index) =>
        index === row.length - 1 ? cell : pad(cell, sizes[index] ?? 0),
      )
      .join("  ")
      .trimEnd(),
  );
}

function money(value: number): string {
  return `$${value.toFixed(4)}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatSimTable(
  records: SimRecord[],
  models: string[],
  conditions: ConditionName[],
): string {
  const lines: string[] = ["合計料金（none との差）"];
  const rows: string[][] = [["モデル", ...conditions]];
  for (const model of models) {
    const base = records
      .filter((record) => record.model === model && record.condition === "none")
      .reduce((sum, record) => sum + record.cost, 0);
    const cells = conditions.map((condition) => {
      const total = records
        .filter(
          (record) => record.model === model && record.condition === condition,
        )
        .reduce((sum, record) => sum + record.cost, 0);
      if (condition === "none") {
        return money(total);
      }
      if (base === 0) {
        return `${money(total)} (—)`;
      }
      const diff = ((total - base) / base) * 100;
      const sign = diff > 0 ? "+" : "";
      return `${money(total)} (${sign}${diff.toFixed(0)}%)`;
    });
    rows.push([model, ...cells]);
  }
  lines.push(...render(rows), "", "条件別の平均");

  const statRows: string[][] = [["条件", "往復", "読み直し", "要約"]];
  for (const condition of conditions) {
    const group = records.filter((record) => record.condition === condition);
    statRows.push([
      condition,
      average(group.map((record) => record.steps)).toFixed(1),
      average(group.map((record) => record.rereads)).toFixed(1),
      average(group.map((record) => record.summaries)).toFixed(1),
    ]);
  }
  lines.push(...render(statRows));
  return lines.join("\n");
}

export async function runSimulation(
  options: SimOptions = {},
): Promise<SimOutput> {
  const models = options.models ?? DEFAULT_SIM_MODELS;
  const conditions = options.conditions ?? [...CONDITIONS];
  const scenarios = resolveScenarios(options.scenarios);
  const cacheTtlSeconds = options.cacheTtlSeconds ?? 3600;
  const context = mergeContext(options.context);
  const resultsDir = options.resultsDir ?? "bench/results";
  const now = options.now ?? new Date();
  const onProgress =
    options.onProgress ?? ((line: string) => process.stderr.write(`${line}\n`));
  const estimate = createEstimator();
  const records: SimRecord[] = [];

  for (const model of models) {
    const info = findModel(model);
    if (info === undefined) {
      throw new Error(`知らないモデルです: ${model}`);
    }
    for (const condition of conditions) {
      for (const scenario of scenarios) {
        const workspace = mkdtempSync(join(tmpdir(), "ja-harness-sim-"));
        try {
          const queue: CallQueue = new Map();
          const sim = createSimModel({
            scenario,
            estimate,
            queue,
            info,
            cacheTtlSeconds,
          });
          const tools = createFakeTools({
            tools: createTools(workspace, async () => true),
            estimate,
            queue,
          });
          const parts = createCondition({
            name: condition,
            workspace,
            complete: sim.complete,
            contextWindow: info.contextWindow ?? 1048576,
            estimate,
            model,
            context,
            now: sim.now,
          });
          const messages: Message[] = [
            { role: "system", content: SYSTEM_PROMPT },
          ];
          const usage = zeroUsage();
          let steps = 0;

          for (let index = 0; index < scenario.turns.length; index += 1) {
            const turn = scenario.turns[index] as Scenario["turns"][number];
            sim.advance(turn.idleSeconds * 1000);
            messages.push({ role: "user", content: turn.user });
            sim.startTurn(index);
            const result = await runTurn({
              complete: sim.complete,
              tools,
              messages,
              maxSteps: 10000,
              ...parts,
            });
            steps += result.steps;
            addUsage(usage, result.usage);
          }

          const record: SimRecord = {
            model,
            condition,
            scenario: scenario.id,
            steps,
            toolCalls: sim.stats.toolCalls,
            rereads: sim.stats.rereads,
            summaries: sim.stats.summaries,
            requests: sim.stats.requests,
            usage,
            cost: usage.cost ?? 0,
          };
          records.push(record);
          onProgress(
            `${model} ${condition} ${scenario.id} ${money(record.cost)} ${steps}往復`,
          );
        } finally {
          rmSync(workspace, { recursive: true, force: true });
        }
      }
    }
  }

  mkdirSync(resultsDir, { recursive: true });
  const resultsPath = join(resultsDir, `sim-${timestamp(now)}.json`);
  writeFileSync(
    resultsPath,
    `${JSON.stringify(
      {
        createdAt: now.toISOString(),
        cacheTtlSeconds,
        context,
        models,
        conditions,
        scenarios: scenarios.map((scenario) => scenario.id),
        results: records,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    records,
    resultsPath,
    table: formatSimTable(records, models, conditions),
  };
}

export const runSim = runSimulation;
