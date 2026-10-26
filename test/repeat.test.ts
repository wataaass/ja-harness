import { describe, expect, it } from "vitest";
import { canonicalArgs, createRepeatTracker } from "../src/agent/repeat.js";

describe("canonicalArgs", () => {
  it("キーを深いところまで並べ替える", () => {
    expect(canonicalArgs({ b: 1, a: { d: 2, c: [3, 4] } })).toBe(
      canonicalArgs({ a: { c: [3, 4], d: 2 }, b: 1 }),
    );
    expect(canonicalArgs({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("配列の順番は変えない", () => {
    expect(canonicalArgs({ a: [1, 2] })).not.toBe(canonicalArgs({ a: [2, 1] }));
  });
});

describe("createRepeatTracker", () => {
  it("3・5・8回目だけ文を返す", () => {
    const tracker = createRepeatTracker();
    const results: (string | null)[] = [];
    for (let i = 0; i < 8; i += 1) {
      results.push(tracker.record("read", { path: "a" }));
    }

    expect(results[0]).toBeNull();
    expect(results[1]).toBeNull();
    expect(results[2]).toContain("same tool with the same arguments");
    expect(results[3]).toBeNull();
    expect(results[4]).toContain("repeated tool call detected");
    expect(results[4]).toContain("tool: read");
    expect(results[4]).toContain("calls in a row: 5");
    expect(results[5]).toBeNull();
    expect(results[6]).toBeNull();
    expect(results[7]).toContain("calls in a row: 8");
  });

  it("キーの順番が違っても同じ呼び出しとみなす", () => {
    const tracker = createRepeatTracker();
    tracker.record("t", { a: 1, b: { c: 2, d: 3 } });
    tracker.record("t", { b: { d: 3, c: 2 }, a: 1 });
    expect(tracker.record("t", { a: 1, b: { c: 2, d: 3 } })).toContain(
      "same tool with the same arguments",
    );
  });

  it("違う引数なら数え直す", () => {
    const tracker = createRepeatTracker();
    tracker.record("t", { a: 1 });
    tracker.record("t", { a: 1 });
    tracker.record("t", { a: 1 });
    expect(tracker.record("t", { a: 2 })).toBeNull();
    expect(tracker.record("t", { a: 2 })).toBeNull();
    expect(tracker.record("t", { a: 2 })).toContain(
      "same tool with the same arguments",
    );
  });

  it("reset で数と直前の呼び出しを消す", () => {
    const tracker = createRepeatTracker();
    tracker.record("t", {});
    tracker.record("t", {});
    expect(tracker.record("t", {})).toContain(
      "same tool with the same arguments",
    );
    tracker.reset();
    expect(tracker.record("t", {})).toBeNull();
    expect(tracker.record("t", {})).toBeNull();
  });

  it("引数は500文字までにしてから…を付ける", () => {
    const tracker = createRepeatTracker();
    const args = { v: "x".repeat(600) };
    tracker.record("t", args);
    tracker.record("t", args);
    expect(tracker.record("t", args)).toContain(
      "same tool with the same arguments",
    );
    expect(tracker.record("t", args)).toBeNull();
    const note = tracker.record("t", args);
    const canonical = canonicalArgs(args);
    expect(canonical.length).toBeGreaterThan(500);
    expect(note).toContain(`arguments: ${canonical.slice(0, 500)}…`);
    expect(note).not.toContain("x".repeat(600));
  });

  it("不正な thresholds なら Error", () => {
    expect(() => createRepeatTracker([1])).toThrow();
    expect(() => createRepeatTracker([3, 3])).toThrow();
    expect(() => createRepeatTracker([2, 2, 5])).toThrow();
  });
});
