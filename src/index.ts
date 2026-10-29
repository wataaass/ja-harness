#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { loadInstructions } from "./agent/instructions.js";
import { runTurn } from "./agent/loop.js";
import { SYSTEM_PROMPT } from "./agent/prompt.js";
import { createRepeatTracker } from "./agent/repeat.js";
import {
  builtinSkillsDir,
  formatSkillList,
  loadSkills,
} from "./agent/skills.js";
import { runBenchCli } from "./bench/cli.js";
import { readConfig, useOpencodeSession } from "./cli/config.js";
import { createTerminalConfirm } from "./cli/confirm.js";
import { formatToolStart } from "./cli/events.js";
import { loadSettings } from "./cli/settings.js";
import { formatUsage } from "./cli/usage.js";
import { createContextManager, DEFAULT_CONTEXT } from "./context/manager.js";
import { createFileSaver, limitToolResult } from "./context/spill.js";
import { createEstimator } from "./context/tokens.js";
import {
  loadCatalogFromCache,
  providerInfo,
  resolveProvider,
  startCatalogRefresh,
} from "./llm/catalog.js";
import { modelPrices } from "./llm/models.js";
import { createClient, MAX_RETRIES, type OnRetry } from "./llm/openai.js";
import type { Message } from "./llm/types.js";
import { connectMcp } from "./mcp/hub.js";
import { resolveServers } from "./mcp/servers.js";
import { createTools } from "./tools/index.js";
import { formatMcpList } from "./tools/mcp.js";
import { runApp } from "./ui/app.js";
import { getMessages } from "./ui/i18n/index.js";
import { formatVersion, VERSION } from "./version.js";

const HELP = `使い方: ja-harness [--resume <id> | --continue]
        ja-harness "<指示>"

引数なしで起動すると対話を始めます。
"<指示>" を渡すと、1回だけ指示を送って答えを受け取ります。
ファイルの編集・作成とコマンドの実行は、その前に確認します。

オプション:
  --help         この使い方を出す
  --version      バージョンを出す
  --resume <id>  保存したセッションの続きから始める
  --continue     いちばん新しいセッションの続きから始める
  bench          品質と料金を測る（ja-harness bench --help）

設定ファイル:
  ~/.ja-harness/config.json と ./.ja-harness/config.json（作業フォルダのほうが優先）
  例: {"model": "deepseek-v4-pro", "effort": "high", "permission": "auto-edit"}
      {"mode": "plan", "ui": {"theme": "light", "details": "verbose"}}
      {"ui": {"enter": "newline"}}
      {"language": {"ui": "ja"}}
      {"mcp": {"servers": {"textlint": {"command": "npx", "args": ["textlint", "--mcp"]}}}}

環境変数:
  JA_HARNESS_BASE_URL   API の URL
  JA_HARNESS_MODEL      使うモデル
  JA_HARNESS_EFFORT     推論の量（low・medium・high）
  JA_HARNESS_LANG       画面の言語
  JA_HARNESS_API_KEY    API キー（OPENCODE_API_KEY でもよい）
`;

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  let resume: string | undefined;
  let continueLatest = false;
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--resume") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        process.stderr.write(
          "--resume にはセッションの id かファイル名が必要です\n",
        );
        return 1;
      }
      resume = value;
      index += 1;
    } else if (arg === "--continue") {
      continueLatest = true;
    } else if (arg !== undefined) {
      rest.push(arg);
    }
  }

  if (rest.length === 1 && rest[0] === "--help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (rest.length === 0) {
    if (process.stdin.isTTY === true && process.stdout.isTTY === true) {
      const home = process.env.JA_HARNESS_HOME ?? homedir();
      const { settings } = loadSettings({
        cwd: process.cwd(),
        home,
        env: process.env,
      });
      const provider = resolveProvider(process.env, settings.provider);
      loadCatalogFromCache({ home, provider });
      startCatalogRefresh({ home, provider });
      const {
        contextWindow,
        provider: _provider,
        ...clientConfig
      } = readConfig(process.env, {
        provider,
        model: settings.model,
        catalog: providerInfo(provider),
      });
      const session = randomUUID();
      const makeComplete = (
        model: string,
        effort?: string,
        onRetry?: OnRetry,
      ) => {
        const client = createClient({
          ...clientConfig,
          model,
          ...(effort === undefined ? {} : { reasoningEffort: effort }),
          ...(useOpencodeSession(provider)
            ? { headers: { "x-opencode-session": session } }
            : {}),
          ...(onRetry === undefined ? {} : { onRetry }),
        });
        return client.complete;
      };
      return runApp({
        input: process.stdin,
        output: process.stdout,
        env: process.env,
        cwd: process.cwd(),
        home,
        makeComplete,
        contextWindow,
        model: clientConfig.model,
        version: VERSION,
        ...(resume === undefined ? {} : { resume }),
        ...(continueLatest ? { continueLatest } : {}),
      });
    }
    process.stdout.write(`${formatVersion()}\n`);
    return 0;
  }
  if (rest.length === 1 && rest[0] === "--version") {
    process.stdout.write(`${formatVersion()}\n`);
    return 0;
  }
  if (rest[0] === "bench") {
    return runBenchCli(rest.slice(1));
  }

  const instruction = rest.join(" ");
  const home = process.env.JA_HARNESS_HOME ?? homedir();
  const { settings } = loadSettings({
    cwd: process.cwd(),
    home,
    env: process.env,
  });
  const provider = resolveProvider(process.env, settings.provider);
  loadCatalogFromCache({ home, provider });
  startCatalogRefresh({ home, provider });
  const {
    contextWindow,
    provider: _provider,
    ...clientConfig
  } = readConfig(process.env, {
    provider,
    model: settings.model,
    catalog: providerInfo(provider),
  });
  const mcpServers = resolveServers(settings.mcp, {
    onWarning: (warning) => process.stderr.write(`${warning}\n`),
  });
  const hub = await connectMcp(mcpServers, { cwd: process.cwd() });
  for (const warning of hub.warnings) {
    process.stderr.write(`${warning}\n`);
  }
  const instructions = loadInstructions({ cwd: process.cwd(), home });
  const skills = loadSkills({
    cwd: process.cwd(),
    home,
    builtinDir: builtinSkillsDir(),
    disabled: settings.skills?.disabled ?? [],
  });
  const selectedModel = settings.model ?? clientConfig.model;
  const uiMessages = getMessages(settings.language?.ui);
  const client = createClient({
    ...clientConfig,
    model: selectedModel,
    ...(settings.effort === undefined
      ? {}
      : { reasoningEffort: settings.effort }),
    ...(useOpencodeSession(provider)
      ? { headers: { "x-opencode-session": randomUUID() } }
      : {}),
    onRetry: (attempt, waitMs) => {
      const seconds = Math.ceil(waitMs / 1000);
      process.stderr.write(
        `${uiMessages.app.retry(seconds, attempt, MAX_RETRIES)}\n`,
      );
    },
  });
  const estimate = createEstimator();
  const saver = createFileSaver(join(process.cwd(), ".ja-harness", "out"));
  const save = (text: string) => relative(process.cwd(), saver(text));
  const prices = modelPrices(selectedModel);
  const manager = createContextManager({
    config: {
      ...DEFAULT_CONTEXT,
      contextWindow,
      ...(prices === undefined ? {} : { prices }),
    },
    complete: client.complete,
    estimate,
  });

  const messages: Message[] = [
    {
      role: "system",
      content:
        SYSTEM_PROMPT +
        instructions.text +
        formatSkillList(skills.skills) +
        formatMcpList(hub.tools),
    },
    { role: "user", content: instruction },
  ];

  const controller = new AbortController();
  const onSigint = () => controller.abort();
  process.on("SIGINT", onSigint);

  try {
    const result = await runTurn({
      complete: client.complete,
      tools: createTools(
        process.cwd(),
        createTerminalConfirm({
          input: process.stdin,
          output: process.stderr,
          isTTY: process.stdin.isTTY === true,
          onInterrupt: () => controller.abort(),
        }),
        { skills: skills.skills, mcp: hub },
      ),
      messages,
      signal: controller.signal,
      context: {
        manager,
        overflowRetries: DEFAULT_CONTEXT.overflowRetries,
      },
      repeat: createRepeatTracker(),
      limitResult: (text, tool) =>
        limitToolResult(text, {
          maxTokens: tool?.maxResultTokens ?? 2000,
          estimate,
          save,
        }),
      onEvent: (event) => {
        if (event.type === "text") {
          process.stdout.write(event.text);
        } else if (event.type === "tool-start") {
          process.stderr.write(`${formatToolStart(event.name, event.args)}\n`);
        } else if (event.type === "tool-end" && event.isError) {
          const firstLine = event.result.split(/\r?\n/)[0] ?? "";
          process.stderr.write(`  ✗ ${firstLine.slice(0, 80)}\n`);
        } else if (event.type === "context") {
          const action =
            event.action === "prune"
              ? "pruned"
              : event.action === "mask"
                ? "masked"
                : "summarized";
          process.stderr.write(
            ` (Context: ${action} -${event.savedTokens} tokens)\n`,
          );
        }
      },
    });
    process.stdout.write("\n");
    process.stderr.write(`${formatUsage(result.usage)}\n`);
    return 0;
  } catch (error) {
    if (controller.signal.aborted) {
      process.stdout.write("\n");
      return 130;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`エラー: ${message}\n`);
    return 1;
  } finally {
    await hub.close();
    process.off("SIGINT", onSigint);
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`エラー: ${message}\n`);
    process.exitCode = 1;
  },
);
