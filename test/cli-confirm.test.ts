import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createTerminalConfirm,
  handleInterrupt,
  isYes,
} from "../src/cli/confirm.js";

function run(
  answer: string,
  isTTY = true,
): Promise<{ accepted: boolean; written: string }> {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = "";
  output.on("data", (chunk: Buffer) => {
    written += chunk.toString();
  });

  const confirm = createTerminalConfirm({ input, output, isTTY });
  const promise = confirm({
    tool: "edit",
    title: "Edit a.ts",
    detail: "- old\n+ new",
  });
  input.end(answer);

  return promise.then((accepted) => ({ accepted, written }));
}

describe("isYes", () => {
  it("y と yes を受け付ける", () => {
    expect(isYes("y")).toBe(true);
    expect(isYes("Y")).toBe(true);
    expect(isYes("yes")).toBe(true);
    expect(isYes("YES")).toBe(true);
    expect(isYes("  Yes  ")).toBe(true);
  });

  it("それ以外は受け付けない", () => {
    expect(isYes("")).toBe(false);
    expect(isYes("n")).toBe(false);
    expect(isYes("no")).toBe(false);
    expect(isYes("yess")).toBe(false);
    expect(isYes("1")).toBe(false);
  });
});

describe("createTerminalConfirm", () => {
  it("y なら実行する", async () => {
    const { accepted, written } = await run("y\n");

    expect(accepted).toBe(true);
    expect(written).toContain("- old\n+ new\n");
    expect(written).toContain("Edit a.ts\n実行しますか？ [y/N] ");
  });

  it("n なら実行しない", async () => {
    const { accepted } = await run("n\n");
    expect(accepted).toBe(false);
  });

  it("空の答えなら実行しない", async () => {
    const { accepted } = await run("\n");
    expect(accepted).toBe(false);
  });

  it("入力が閉じたら実行しない", async () => {
    const { accepted } = await run("");
    expect(accepted).toBe(false);
  });

  it("isTTY が false なら聞かずに断る", async () => {
    const { accepted, written } = await run("y\n", false);

    expect(accepted).toBe(false);
    expect(written).toBe("（確認できないため断りました: Edit a.ts）\n");
  });
});

describe("handleInterrupt", () => {
  it("onInterrupt を呼び、空の答えで終えて閉じる", () => {
    const onInterrupt = vi.fn();
    const finish = vi.fn();
    const close = vi.fn();

    handleInterrupt(onInterrupt, finish, close);

    expect(onInterrupt).toHaveBeenCalledOnce();
    expect(finish).toHaveBeenCalledWith("");
    expect(close).toHaveBeenCalledOnce();
  });

  it("onInterrupt が無くても終えて閉じる", () => {
    const finish = vi.fn();
    const close = vi.fn();

    handleInterrupt(undefined, finish, close);

    expect(finish).toHaveBeenCalledWith("");
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("createTerminalConfirm の Ctrl+C", () => {
  it("Ctrl+C で中断すると onInterrupt を呼び、実行しない", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const onInterrupt = vi.fn();
    const confirm = createTerminalConfirm({
      input,
      output,
      isTTY: true,
      onInterrupt,
    });

    const pending = confirm({
      tool: "edit",
      title: "Edit a.ts",
      detail: "",
    });
    input.write("\x03");

    await expect(pending).resolves.toBe(false);
    expect(onInterrupt).toHaveBeenCalledOnce();
  });
});
