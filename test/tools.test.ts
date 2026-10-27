import { describe, expect, it, vi } from "vitest";
import type { Confirm } from "../src/tools/confirm.js";
import { createTools } from "../src/tools/index.js";

describe("createTools", () => {
  it("名前の並びを固定する", () => {
    const confirm = vi.fn<Confirm>(async () => true);
    const tools = createTools("/work", confirm);
    expect(tools.map((tool) => tool.name)).toEqual([
      "read",
      "list",
      "grep",
      "edit",
      "write",
      "shell",
      "submit_plan",
    ]);
  });
});
