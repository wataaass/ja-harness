#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { runTurn } from "./agent/loop.js";
import { SYSTEM_PROMPT } from "./agent/prompt.js";
import { readConfig } from "./cli/config.js";
import { formatUsage } from "./cli/usage.js";
import { createClient } from "./llm/openai.js";
import type { Message } from "./llm/types.js";
import { formatVersion } from "./version.js";

const HELP = `使い方: ja-harness "<指示>"

1回だけ指示を送って答えを受け取ります。

オプション:
  --help       この使い方を出す
  --version    バージョンを出す

環境変数:
  JA_HARNESS_BASE_URL   API の URL
  JA_HARNESS_MODEL      使うモデル
  JA_HARNESS_API_KEY    API キー（OPENCODE_API_KEY でもよい）
`;

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.length === 0 || (args.length === 1 && args[0] === "--version")) {
    process.stdout.write(`${formatVersion()}\n`);
    return 0;
  }

  const instruction = args.join(" ");
  const config = readConfig(process.env);
  const client = createClient({
    ...config,
    headers: { "x-opencode-session": randomUUID() },
  });

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: instruction },
  ];

  const controller = new AbortController();
  const onSigint = () => controller.abort();
  process.on("SIGINT", onSigint);

  try {
    const result = await runTurn({
      complete: client.complete,
      tools: [],
      messages,
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === "text") {
          process.stdout.write(event.text);
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
