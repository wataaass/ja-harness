import type { ConfirmRequest } from "../tools/confirm.js";

export type Permission = "ask" | "auto-edit" | "auto-all";

export const PERMISSIONS: Permission[] = ["ask", "auto-edit", "auto-all"];

export const PERMISSION_LABELS: Record<Permission, string> = {
  ask: "確認する",
  "auto-edit": "編集は自動",
  "auto-all": "すべて自動",
};

export function permissionLabel(permission: Permission): string {
  return PERMISSION_LABELS[permission];
}

export function parsePermission(text: string): Permission | undefined {
  const value = text.trim();
  const byLabel = PERMISSIONS.find(
    (permission) => PERMISSION_LABELS[permission] === value,
  );
  if (byLabel !== undefined) {
    return byLabel;
  }
  return PERMISSIONS.find((permission) => permission === value);
}

export function needsConfirm(
  permission: Permission,
  request: Pick<ConfirmRequest, "tool" | "outside">,
): boolean {
  if (request.outside === true) {
    return true;
  }
  if (request.tool === "edit" || request.tool === "write") {
    return permission === "ask";
  }
  return permission !== "auto-all";
}
