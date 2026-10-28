import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTasks } from "../src/bench/tasks.js";

const tasksDir = join(process.cwd(), "bench", "tasks");

describe("loadTasks", () => {
  it("課題を読み込む", () => {
    const tasks = loadTasks(tasksDir, ["sample-add"]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: "sample-add",
      kind: "fix",
      dir: join(tasksDir, "sample-add"),
    });
    expect(tasks[0].turns).toHaveLength(1);
    expect(tasks[0].turns[0]).toContain("足し算");
  });

  it("指定がなければフォルダを並べて読む", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-tasks-"));
    try {
      for (const name of ["b-task", "a-task"]) {
        const dir = join(root, name);
        for (const folder of ["files", "grade", "solution"]) {
          mkdirSync(join(dir, folder), { recursive: true });
        }
        writeFileSync(
          join(dir, "task.json"),
          JSON.stringify({ id: name, kind: "fix", prompt: "直す" }),
        );
      }

      expect(loadTasks(root).map((task) => task.id)).toEqual([
        "a-task",
        "b-task",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ない課題はエラー", () => {
    expect(() => loadTasks(tasksDir, ["nope"])).toThrow("nope");
  });

  it("足りないフォルダはエラー", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-tasks-"));
    try {
      const dir = join(root, "broken");
      mkdirSync(join(dir, "files"), { recursive: true });
      mkdirSync(join(dir, "grade"), { recursive: true });
      writeFileSync(
        join(dir, "task.json"),
        JSON.stringify({ id: "broken", kind: "fix", prompt: "直す" }),
      );

      expect(() => loadTasks(root, ["broken"])).toThrow("solution");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("kind が違えばエラー", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-tasks-"));
    try {
      const dir = join(root, "broken");
      mkdirSync(join(dir, "files"), { recursive: true });
      mkdirSync(join(dir, "grade"), { recursive: true });
      mkdirSync(join(dir, "solution"), { recursive: true });
      writeFileSync(
        join(dir, "task.json"),
        JSON.stringify({ id: "broken", kind: "other", prompt: "直す" }),
      );

      expect(() => loadTasks(root, ["broken"])).toThrow("kind");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("turns を読む", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-tasks-"));
    try {
      const dir = join(root, "multi");
      for (const folder of ["files", "grade", "solution"]) {
        mkdirSync(join(dir, folder), { recursive: true });
      }
      writeFileSync(
        join(dir, "task.json"),
        JSON.stringify({
          id: "multi",
          kind: "fix",
          turns: ["まず直す", "次に変える"],
        }),
      );

      expect(loadTasks(root, ["multi"])[0]?.turns).toEqual([
        "まず直す",
        "次に変える",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prompt と turns が両方あるとエラー", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-tasks-"));
    try {
      const dir = join(root, "broken");
      for (const folder of ["files", "grade", "solution"]) {
        mkdirSync(join(dir, folder), { recursive: true });
      }
      writeFileSync(
        join(dir, "task.json"),
        JSON.stringify({
          id: "broken",
          kind: "fix",
          prompt: "直す",
          turns: ["直す", "変える"],
        }),
      );

      expect(() => loadTasks(root, ["broken"])).toThrow("どちらか一方");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("空の turns はエラー", () => {
    const root = mkdtempSync(join(tmpdir(), "ja-harness-tasks-"));
    try {
      const dir = join(root, "broken");
      for (const folder of ["files", "grade", "solution"]) {
        mkdirSync(join(dir, folder), { recursive: true });
      }
      writeFileSync(
        join(dir, "task.json"),
        JSON.stringify({ id: "broken", kind: "fix", turns: [] }),
      );

      expect(() => loadTasks(root, ["broken"])).toThrow("turns");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
