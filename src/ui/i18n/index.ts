import { ja } from "./ja.js";

export type Messages = typeof ja;

const MESSAGES: Record<string, Messages> = { ja };

export function getMessages(lang?: string): Messages {
  return MESSAGES[lang ?? "ja"] ?? ja;
}
