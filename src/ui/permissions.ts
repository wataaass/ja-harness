import type { ConfirmRequest } from "../tools/confirm.js";
import { getMessages, type Messages } from "./i18n/index.js";

export type Permission = "ask" | "auto-edit" | "auto-all";

export const PERMISSIONS: Permission[] = ["ask", "auto-edit", "auto-all"];

export function permissionLabel(
  permission: Permission,
  messages: Messages = getMessages(),
): string {
  return messages.permissions[permission];
}

export function parsePermission(
  text: string,
  messages: Messages = getMessages(),
): Permission | undefined {
  const value = text.trim();
  const byLabel = PERMISSIONS.find(
    (permission) => messages.permissions[permission] === value,
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
