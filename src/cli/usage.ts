import type { Usage } from "../llm/types.js";

export function formatUsage(u: Usage): string {
  const rate = u.input === 0 ? 0 : Math.round((u.cachedInput / u.input) * 100);
  let text = `入力 ${u.input.toLocaleString("en-US")}（キャッシュ ${u.cachedInput.toLocaleString("en-US")}・${rate}%）・出力 ${u.output.toLocaleString("en-US")}`;
  if (u.cost !== undefined) {
    text += `・$${u.cost.toFixed(4)}`;
  }
  return text;
}
