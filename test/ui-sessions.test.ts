import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Message, Usage } from "../src/llm/types.js";
import {
  createSessionWriter,
  listSessions,
  loadSession,
  type SessionMeta,
} from "../src/ui/sessions.js";

const homes: string[] = [];

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), "ja-harness-sessions-"));
  homes.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of homes.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function meta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    type: "meta",
    id: "session-1",
    cwd: "/work/app",
    model: "deepseek-v4.1-flash",
    createdAt: "2026-10-27T03:12:00.000Z",
    ...overrides,
  };
}

function usage(input: number, cachedInput: number, cost: number): Usage {
  return {
    input,
    cachedInput,
    output: 10,
    reasoning: 0,
    cost,
  };
}

const system: Message = { role: "system", content: "prompt" };
const user: Message = { role: "user", content: "最初の発言" };
const assistant: Message = { role: "assistant", content: "答え" };

describe("createSessionWriter と loadSession", () => {
  it("書いて読み戻す", () => {
    const dir = home();
    const writer = createSessionWriter(dir, meta());
    expect(writer.path.endsWith("-app.jsonl")).toBe(true);
    expect(writer.append({ type: "message", message: system })).toBeUndefined();
    expect(writer.append({ type: "message", message: user })).toBeUndefined();
    expect(
      writer.append({ type: "message", message: assistant }),
    ).toBeUndefined();
    expect(writer.append({ type: "usage", usage: usage(100, 50, 0.01) })).toBe(
      undefined,
    );

    const loaded = loadSession(writer.path);
    expect(loaded.meta).toEqual(meta());
    expect(loaded.messages).toEqual([system, user, assistant]);
    expect(loaded.usage).toEqual(usage(100, 50, 0.01));
  });

  it("reset を順に再生して messages を作り直す", () => {
    const dir = home();
    const writer = createSessionWriter(dir, meta());
    writer.append({ type: "message", message: system });
    writer.append({ type: "message", message: user });
    writer.append({ type: "message", message: assistant });
    writer.append({
      type: "reset",
      messages: [system, { role: "user", content: "要約" }],
    });
    writer.append({ type: "message", message: assistant });

    expect(loadSession(writer.path).messages).toEqual([
      system,
      { role: "user", content: "要約" },
      assistant,
    ]);
  });

  it("壊れた行は飛ばす", () => {
    const dir = home();
    const writer = createSessionWriter(dir, meta());
    writer.append({ type: "message", message: system });
    const path = writer.path;
    writeFileSync(
      path,
      `${readFileSync(path, "utf8")}not json\n${JSON.stringify({ type: "message", message: user })}\n`,
      "utf8",
    );

    expect(loadSession(path).messages).toEqual([system, user]);
  });

  it("書けないときも落ちず、警告は1回だけ返す", () => {
    const dir = home();
    const blocker = join(dir, "file");
    writeFileSync(blocker, "x", "utf8");
    const writer = createSessionWriter(blocker, meta());

    const first = writer.append({ type: "message", message: system });
    const second = writer.append({ type: "message", message: system });
    expect(typeof first).toBe("string");
    expect(second).toBeUndefined();
  });
});

describe("listSessions", () => {
  it("その作業フォルダのものを新しい順に、要約つきで返す", () => {
    const dir = home();
    const older = createSessionWriter(
      dir,
      meta({ id: "older", createdAt: "2026-10-26T01:00:00.000Z" }),
    );
    older.append({ type: "message", message: system });
    older.append({
      type: "message",
      message: { role: "user", content: "古い発言".repeat(20) },
    });
    older.append({ type: "message", message: assistant });
    older.append({ type: "usage", usage: usage(100, 80, 0.01) });

    const newer = createSessionWriter(
      dir,
      meta({ id: "newer", createdAt: "2026-10-27T03:12:00.000Z" }),
    );
    newer.append({ type: "message", message: system });
    newer.append({ type: "message", message: user });
    newer.append({ type: "message", message: assistant });
    newer.append({ type: "usage", usage: usage(10, 5, 0.002) });
    newer.append({ type: "usage", usage: usage(10, 5, 0.003) });

    const other = createSessionWriter(
      dir,
      meta({ id: "other", cwd: "/elsewhere" }),
    );
    other.append({ type: "message", message: user });

    const sessions = listSessions(dir, "/work/app");
    expect(sessions.map((session) => session.id)).toEqual(["newer", "older"]);
    expect(sessions[0]).toMatchObject({
      id: "newer",
      firstUser: "最初の発言",
      cost: 0.005,
      cacheRatio: 0.5,
      turns: 2,
    });
    expect(sessions[0]?.path).toBe(newer.path);
    expect(sessions[1]?.firstUser).toBe("古い発言".repeat(10));
  });
});
