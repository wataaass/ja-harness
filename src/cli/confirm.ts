import { createInterface } from "node:readline/promises";
import type { Confirm } from "../tools/confirm.js";

export type ConfirmIO = {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  isTTY: boolean;
  onInterrupt?: () => void;
};

export function isYes(answer: string): boolean {
  const text = answer.trim().toLowerCase();
  return text === "y" || text === "yes";
}

export function handleInterrupt(
  onInterrupt: (() => void) | undefined,
  finish: (answer: string) => void,
  close: () => void,
): void {
  onInterrupt?.();
  finish("");
  close();
}

export function createTerminalConfirm(io: ConfirmIO): Confirm {
  return async (request) => {
    if (!io.isTTY) {
      io.output.write(`（確認できないため断りました: ${request.title}）\n`);
      return false;
    }

    if (request.detail !== "") {
      io.output.write(`${request.detail}\n`);
    }
    io.output.write(`${request.title}\n`);
    io.output.write("実行しますか？ [y/N] ");

    const rl = createInterface({
      input: io.input,
      output: io.output,
      terminal: io.isTTY,
    });
    try {
      const answer = await new Promise<string>((resolve) => {
        let settled = false;
        const finish = (value: string) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        };
        rl.on("SIGINT", () =>
          handleInterrupt(io.onInterrupt, finish, () => rl.close()),
        );
        rl.once("close", () => finish(""));
        rl.question("").then(finish, () => finish(""));
      });
      return isYes(answer);
    } finally {
      rl.close();
    }
  };
}
