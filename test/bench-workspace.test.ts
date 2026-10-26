import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTasks } from "../src/bench/tasks.js";
import {
  applySolution,
  defaultWorkRoot,
  gradeWorkspace,
  prepareWorkspace,
} from "../src/bench/workspace.js";

const tasksDir = join(process.cwd(), "bench", "tasks");

describe("defaultWorkRoot", () => {
  it("既定の作業場所は tmpdir の下になる", () => {
    const now = new Date("2026-10-26T17:00:00.000Z");
    expect(defaultWorkRoot(now)).toBe(
      join(tmpdir(), "ja-harness-bench", "2026-10-26T17-00-00-000Z"),
    );
  });
});

describe("prepareWorkspace と gradeWorkspace", () => {
  let root = "";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ja-harness-workspace-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("files だけを作業場所に写す", () => {
    const task = loadTasks(tasksDir, ["sample-add"])[0];
    const workspace = prepareWorkspace(task, root, {
      condition: "none",
      rep: 1,
    });

    expect(workspace).toBe(join(root, "sample-add-none-1"));
    expect(existsSync(join(workspace, "math.js"))).toBe(true);
    expect(existsSync(join(workspace, "task.json"))).toBe(false);
    expect(readFileSync(join(workspace, "math.js"), "utf8")).toContain("a - b");
  });

  it("元のままは不合格、模範解答で合格", async () => {
    const task = loadTasks(tasksDir, ["sample-add"])[0];
    const workspace = prepareWorkspace(task, root, { suffix: "test" });

    const before = await gradeWorkspace(task, workspace);
    expect(before.pass).toBe(false);
    expect(before.passed).toBe(0);
    expect(before.failed).toBe(2);
    expect(before.output).toContain("# fail 2");

    applySolution(task, workspace);
    const after = await gradeWorkspace(task, workspace);
    expect(after.pass).toBe(true);
    expect(after.passed).toBe(2);
    expect(after.failed).toBe(0);
    expect(after.output).toContain("# pass 2");
  });

  it("モデルが作った .bench-grade を消す", async () => {
    const task = loadTasks(tasksDir, ["sample-add"])[0];
    const workspace = prepareWorkspace(task, root, { suffix: "test" });
    const leftover = join(workspace, ".bench-grade", "leftover.test.js");
    mkdirSync(join(workspace, ".bench-grade"), { recursive: true });
    writeFileSync(leftover, "throw new Error('should not run');\n");

    const result = await gradeWorkspace(task, workspace);
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(2);
  });
});
