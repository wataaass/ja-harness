import { describe, expect, it } from "vitest";
import { parseBenchArgs } from "../src/bench/cli.js";

describe("parseBenchArgs", () => {
  it("既定値を返す", () => {
    expect(parseBenchArgs([])).toEqual({
      conditions: ["none", "input-only", "default"],
      reps: 3,
      concurrency: 3,
      tasksDir: "bench/tasks",
      validate: false,
      help: false,
    });
  });

  it("オプションを読む", () => {
    expect(
      parseBenchArgs([
        "--tasks",
        "a,b",
        "--conditions",
        "none,default",
        "--reps",
        "2",
        "--concurrency",
        "5",
        "--tasks-dir",
        "my/tasks",
        "--work-dir",
        "my/work",
      ]),
    ).toEqual({
      tasks: ["a", "b"],
      conditions: ["none", "default"],
      reps: 2,
      concurrency: 5,
      tasksDir: "my/tasks",
      workDir: "my/work",
      validate: false,
      help: false,
    });
  });

  it("validate・prepare・grade・help を読む", () => {
    expect(parseBenchArgs(["--validate"]).validate).toBe(true);
    expect(parseBenchArgs(["--rerun-errors", "old.json"]).rerunErrors).toBe(
      "old.json",
    );
    expect(parseBenchArgs(["--prepare", "other"]).prepare).toBe("other");
    expect(parseBenchArgs(["--grade", "other"]).grade).toBe("other");
    expect(parseBenchArgs(["--help"]).help).toBe(true);
  });

  it("知らない条件はエラー", () => {
    expect(() => parseBenchArgs(["--conditions", "none,other"])).toThrow(
      "other",
    );
  });

  it("正でない回数はエラー", () => {
    expect(() => parseBenchArgs(["--reps", "0"])).toThrow("正の整数");
    expect(() => parseBenchArgs(["--reps", "x"])).toThrow("正の整数");
  });

  it("値のないオプションはエラー", () => {
    expect(() => parseBenchArgs(["--tasks"])).toThrow("値");
  });

  it("prepare と grade は同時に使えない", () => {
    expect(() => parseBenchArgs(["--prepare", "a", "--grade", "b"])).toThrow(
      "同時",
    );
  });

  it("rerun-errors と validate は同時に使えない", () => {
    expect(() =>
      parseBenchArgs(["--rerun-errors", "old.json", "--validate"]),
    ).toThrow("同時");
  });
});
