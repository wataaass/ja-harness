export type SimTool = "read" | "list" | "grep" | "edit" | "write" | "shell";

export type Call = {
  label: string;
  tool: SimTool;
  args: Record<string, unknown>;
  resultTokens: number;
};

export type Step = {
  calls: Call[];
  outputTokens: number;
  reasoningTokens: number;
  needs?: string[];
};

export type Turn = {
  idleSeconds: number;
  user: string;
  steps: Step[];
};

export type Scenario = {
  id: string;
  turns: Turn[];
};

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function randomInt(rng: Rng, min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return low + Math.floor(rng() * (high - low + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

const FILES = [
  "src/agent/loop.ts",
  "src/context/manager.ts",
  "src/context/summary.ts",
  "src/context/prune.ts",
  "src/context/spill.ts",
  "src/bench/run.ts",
  "src/bench/cli.ts",
  "src/tools/read.ts",
  "src/tools/edit.ts",
  "test/manager.test.ts",
  "test/loop.test.ts",
  "test/bench-sim.test.ts",
] as const;

const DIRS = ["src", "src/context", "src/tools", "src/bench", "test"] as const;

const GREP_PATTERNS = [
  "TODO",
  "export function",
  "SUMMARY_INSTRUCTION",
  "toolCalls",
  "maxResultTokens",
  "prune",
  "cache",
] as const;

const SHELL_COMMANDS = [
  { command: "npm test", description: "Run the tests" },
  { command: "npm run typecheck", description: "Check types" },
  { command: "npm run lint", description: "Lint the code" },
  { command: "git diff --stat", description: "Show changed files" },
  { command: "node --test", description: "Run node tests" },
] as const;

const USERS = [
  "小さな不具合を直して。",
  "テストが落ちるので直して。",
  "文脈管理の動きを確かめて。",
  "料金が増えないように直して。",
] as const;

type HistoryItem = {
  label: string;
  tool: SimTool;
  stepIndex: number;
  call: Call;
};

type State = {
  rng: Rng;
  prefix: string;
  sequence: number;
  globalStep: number;
  steps: Step[];
  history: HistoryItem[];
  reads: Map<string, HistoryItem>;
  pendingReread: string[];
};

type Weights = Partial<Record<SimTool, number>>;

function newState(seed: number, prefix: string): State {
  return {
    rng: mulberry32(seed),
    prefix,
    sequence: 0,
    globalStep: 0,
    steps: [],
    history: [],
    reads: new Map(),
    pendingReread: [],
  };
}

function resultTokensFor(rng: Rng, tool: SimTool, large: boolean): number {
  const huge = rng() < 0.1;
  switch (tool) {
    case "read":
      if (huge) {
        return randomInt(rng, 9000, 15000);
      }
      return large ? randomInt(rng, 2500, 6000) : randomInt(rng, 300, 6000);
    case "shell":
      if (huge) {
        return randomInt(rng, 8000, 20000);
      }
      return large ? randomInt(rng, 1500, 5000) : randomInt(rng, 200, 5000);
    case "grep":
      return randomInt(rng, 100, 1500);
    case "edit":
    case "write":
      return randomInt(rng, 50, 300);
    case "list":
      return randomInt(rng, 100, 600);
  }
}

function argsFor(
  state: State,
  tool: SimTool,
  file?: string,
): Record<string, unknown> {
  const rng = state.rng;
  const target = file ?? pick(rng, FILES);
  switch (tool) {
    case "read":
      return rng() < 0.2
        ? {
            paths: [target],
            offset: randomInt(rng, 1, 80),
            limit: randomInt(rng, 40, 400),
          }
        : { paths: [target] };
    case "list":
      return { path: pick(rng, DIRS), depth: randomInt(rng, 1, 3) };
    case "grep":
      return { pattern: pick(rng, GREP_PATTERNS), path: pick(rng, DIRS) };
    case "edit": {
      const index = randomInt(rng, 1, 999);
      return {
        path: target,
        edits: [
          {
            oldText: `const oldValue${index} = ${index};`,
            newText: `const newValue${index} = ${index + 1};`,
          },
        ],
      };
    }
    case "write": {
      const index = randomInt(rng, 1, 999);
      return {
        path: `${pick(rng, DIRS)}/generated-${index}.ts`,
        content: `export const value${index} = ${index};\n`,
      };
    }
    case "shell": {
      const command = pick(rng, SHELL_COMMANDS);
      return { command: command.command, description: command.description };
    }
  }
}

function pushStep(
  state: State,
  calls: Call[],
  needs: string[] | undefined,
): void {
  const step: Step = {
    calls,
    outputTokens: randomInt(state.rng, 20, 180),
    reasoningTokens: randomInt(state.rng, 0, 120),
  };
  if (needs !== undefined && needs.length > 0) {
    step.needs = needs;
  }
  state.steps.push(step);
  for (const call of calls) {
    state.history.push({
      label: call.label,
      tool: call.tool,
      stepIndex: state.globalStep,
      call,
    });
  }
  state.globalStep += 1;
}

function makeCall(
  state: State,
  tool: SimTool,
  args: Record<string, unknown>,
  large: boolean,
): Call {
  state.sequence += 1;
  return {
    label: `${state.prefix}-${String(state.sequence).padStart(3, "0")}`,
    tool,
    args,
    resultTokens: resultTokensFor(state.rng, tool, large),
  };
}

function readStep(state: State, file: string, large: boolean): Call {
  const call = makeCall(state, "read", argsFor(state, "read", file), large);
  pushStep(state, [call], undefined);
  state.reads.set(file, {
    label: call.label,
    tool: call.tool,
    stepIndex: state.globalStep - 1,
    call,
  });
  state.pendingReread = state.pendingReread.filter((item) => item !== file);
  return call;
}

function editStep(state: State, file: string): Call {
  const read = state.reads.get(file);
  const call = makeCall(state, "edit", argsFor(state, "edit", file), false);
  pushStep(state, [call], read === undefined ? undefined : [read.label]);
  state.pendingReread.push(file);
  return call;
}

function weightedTool(rng: Rng, weights: Weights): SimTool {
  const entries = Object.entries(weights).filter(
    (entry): entry is [SimTool, number] =>
      entry[1] !== undefined && entry[1] > 0,
  );
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let point = rng() * total;
  for (const [tool, weight] of entries) {
    point -= weight;
    if (point <= 0) {
      return tool;
    }
  }
  return entries[entries.length - 1]?.[0] ?? "read";
}

function randomStep(state: State, tool: SimTool, large: boolean): void {
  if (tool === "read") {
    readStep(state, pick(state.rng, FILES), large);
    return;
  }
  if (tool === "edit") {
    const files = [...state.reads.keys()];
    if (files.length === 0) {
      readStep(state, pick(state.rng, FILES), large);
      return;
    }
    editStep(state, pick(state.rng, files));
    return;
  }
  const call = makeCall(state, tool, argsFor(state, tool), large);
  pushStep(state, [call], undefined);
}

function buildTurn(
  state: State,
  o: {
    idleSeconds: number;
    budget: number;
    weights: Weights;
    large: boolean;
  },
): Turn {
  state.steps = [];
  let produced = 0;
  while (produced < o.budget) {
    if (
      state.pendingReread.length > 0 &&
      (o.budget - produced <= state.pendingReread.length || state.rng() < 0.3)
    ) {
      readStep(state, state.pendingReread[0] as string, o.large);
      produced += 1;
      continue;
    }
    let tool = weightedTool(state.rng, o.weights);
    if (tool === "edit" && produced >= o.budget - 1) {
      tool = "read";
    }
    randomStep(state, tool, o.large);
    produced += 1;
  }
  while (state.pendingReread.length > 0) {
    readStep(state, state.pendingReread[0] as string, o.large);
    produced += 1;
  }

  const answer: Step = {
    calls: [],
    outputTokens: randomInt(state.rng, 80, 300),
    reasoningTokens: randomInt(state.rng, 0, 120),
  };
  state.steps.push(answer);
  state.globalStep += 1;

  const steps = state.steps;
  state.steps = [];
  return {
    idleSeconds: o.idleSeconds,
    user: pick(state.rng, USERS),
    steps,
  };
}

function addOldDependencies(state: State, turns: Turn[]): void {
  const flat = turns.flatMap((turn) => turn.steps);
  const toolSteps = flat
    .map((step, index) => ({ step, index }))
    .filter((item) => item.step.calls.length > 0);
  const count = Math.max(1, Math.round(toolSteps.length * 0.1));

  for (let k = 0; k < count; k += 1) {
    const position = Math.floor((k + 0.5) * (toolSteps.length / count));
    const target = toolSteps[position];
    if (target === undefined || target.index < 2) {
      continue;
    }
    const gap = Math.min(5, target.index);
    const earlier = state.history.filter(
      (item) =>
        item.stepIndex <= target.index - gap &&
        item.tool !== "edit" &&
        item.tool !== "write",
    );
    if (earlier.length === 0) {
      continue;
    }
    const chosen = pick(state.rng, earlier);
    const needs = target.step.needs ?? [];
    if (!needs.includes(chosen.label)) {
      needs.push(chosen.label);
      target.step.needs = needs;
    }
  }
}

function finish(state: State, id: string, turns: Turn[]): Scenario {
  addOldDependencies(state, turns);
  return { id, turns };
}

function shortScenario(seed: number): Scenario {
  const state = newState(seed, "short");
  state.steps = [];
  readStep(state, "src/agent/loop.ts", false);
  randomStep(state, "grep", false);
  editStep(state, "src/agent/loop.ts");
  readStep(state, "src/agent/loop.ts", false);
  readStep(state, "src/context/manager.ts", false);
  randomStep(state, "shell", false);
  const answer: Step = {
    calls: [],
    outputTokens: randomInt(state.rng, 120, 280),
    reasoningTokens: randomInt(state.rng, 20, 100),
  };
  state.steps.push(answer);
  state.globalStep += 1;
  const steps = state.steps;
  state.steps = [];
  const turns: Turn[] = [
    { idleSeconds: 0, user: "短い不具合を直して。", steps },
  ];
  return finish(state, "short", turns);
}

function mediumScenario(seed: number): Scenario {
  const state = newState(seed, "medium");
  const weights: Weights = {
    read: 0.35,
    grep: 0.2,
    list: 0.1,
    shell: 0.2,
    edit: 0.1,
    write: 0.05,
  };
  const turns = [
    buildTurn(state, {
      idleSeconds: 0,
      budget: 10,
      weights,
      large: false,
    }),
    buildTurn(state, {
      idleSeconds: 600,
      budget: 10,
      weights,
      large: false,
    }),
  ];
  return finish(state, "medium", turns);
}

function longScenario(seed: number): Scenario {
  const state = newState(seed, "long");
  const weights: Weights = {
    read: 0.55,
    grep: 0.06,
    list: 0.02,
    shell: 0.33,
    edit: 0.03,
    write: 0.01,
  };
  const turns = [
    buildTurn(state, { idleSeconds: 0, budget: 16, weights, large: true }),
    buildTurn(state, { idleSeconds: 120, budget: 18, weights, large: true }),
    buildTurn(state, { idleSeconds: 1800, budget: 20, weights, large: true }),
    buildTurn(state, { idleSeconds: 60, budget: 16, weights, large: true }),
  ];
  return finish(state, "long", turns);
}

function readHeavyScenario(seed: number): Scenario {
  const state = newState(seed, "read-heavy");
  const weights: Weights = {
    read: 0.65,
    grep: 0.3,
    list: 0.03,
    shell: 0.02,
  };
  const turns = [
    buildTurn(state, { idleSeconds: 0, budget: 40, weights, large: false }),
  ];
  return finish(state, "read-heavy", turns);
}

export function makeScenarios(): Scenario[] {
  return [
    shortScenario(0x51a7),
    mediumScenario(0x8e21),
    longScenario(0xc0de),
    readHeavyScenario(0x7a11),
  ];
}
