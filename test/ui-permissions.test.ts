import { describe, expect, it } from "vitest";
import {
  needsConfirm,
  parsePermission,
  permissionLabel,
} from "../src/ui/permissions.js";

describe("permissions", () => {
  it("表示名と直接の指定を読む", () => {
    expect(permissionLabel("ask")).toBe("Confirm");
    expect(permissionLabel("auto-edit")).toBe("Auto-edit");
    expect(permissionLabel("auto-all")).toBe("Auto");
    expect(parsePermission("Auto-edit")).toBe("auto-edit");
    expect(parsePermission("Auto")).toBe("auto-all");
    expect(parsePermission("Confirm")).toBe("ask");
    expect(parsePermission("unknown")).toBeUndefined();
  });

  it("確認する: 編集もシェルも聞く", () => {
    expect(needsConfirm("ask", { tool: "edit" })).toBe(true);
    expect(needsConfirm("ask", { tool: "shell" })).toBe(true);
  });

  it("編集は自動: 編集は聞かず、シェルは聞く", () => {
    expect(needsConfirm("auto-edit", { tool: "edit" })).toBe(false);
    expect(needsConfirm("auto-edit", { tool: "write" })).toBe(false);
    expect(needsConfirm("auto-edit", { tool: "shell" })).toBe(true);
  });

  it("すべて自動: どちらも聞かない", () => {
    expect(needsConfirm("auto-all", { tool: "edit" })).toBe(false);
    expect(needsConfirm("auto-all", { tool: "shell" })).toBe(false);
  });

  it("作業フォルダの外はどの権限でも聞く", () => {
    expect(needsConfirm("auto-edit", { tool: "edit", outside: true })).toBe(
      true,
    );
    expect(needsConfirm("auto-all", { tool: "write", outside: true })).toBe(
      true,
    );
  });
});
