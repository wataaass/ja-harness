import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachePath,
  clearCatalog,
  isFresh,
  loadCatalogFromCache,
  providerModels,
  refreshCatalog,
} from "../src/llm/catalog.js";
import { findModel, listModels, MODELS } from "../src/llm/models.js";

const API_JSON = {
  "opencode-go": {
    id: "opencode-go",
    name: "OpenCode Go",
    api: "https://api.example.test/v1",
    env: ["MOONSHOT_API_KEY"],
    models: {
      alpha: {
        id: "alpha",
        name: "Alpha",
        tool_call: true,
        cost: { input: 1, output: 2 },
        limit: { context: 1000, output: 100 },
      },
      beta: {
        id: "beta",
        name: "Beta",
        tool_call: false,
        cost: { input: 1, output: 2 },
      },
      gamma: {
        id: "gamma",
        name: "Gamma",
        cost: { input: 3, output: 4, cache_read: 0.3, cache_write: 0 },
      },
      delta: {
        id: "delta",
        name: "Delta",
        cost: { input: 5, output: 6, cache_write: 8 },
      },
      epsilon: {
        id: "epsilon",
        name: "Epsilon",
      },
    },
  },
  other: {
    id: "other",
    models: {
      nope: { id: "nope", cost: { input: 1, output: 1 } },
    },
  },
};

function response(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

describe("料金表", () => {
  let home = "";

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ja-harness-catalog-"));
    clearCatalog();
  });

  afterEach(() => {
    clearCatalog();
    rmSync(home, { recursive: true, force: true });
  });

  it("models.dev の形から ModelInfo に変換する", () => {
    const models = providerModels(API_JSON["opencode-go"] as never);
    const byId = new Map(models.map((model) => [model.id, model]));

    expect(models.map((model) => model.id)).toEqual([
      "alpha",
      "gamma",
      "delta",
      "epsilon",
    ]);
    expect(byId.get("alpha")?.prices).toEqual({
      input: 1,
      cachedInput: 1,
      output: 2,
    });
    expect(byId.get("alpha")?.contextWindow).toBe(1000);
    expect(byId.get("gamma")?.prices).toEqual({
      input: 3,
      cachedInput: 0.3,
      output: 4,
    });
    expect(byId.get("delta")?.prices.cacheWrite).toBe(8);
    expect(byId.get("epsilon")?.prices).toEqual({
      input: 0,
      cachedInput: 0,
      output: 0,
    });
    expect(byId.get("epsilon")?.priced).toBe(false);
  });

  it("取れたら保存し、24時間は取りに行かない", async () => {
    const now = Date.UTC(2026, 9, 28, 0, 0, 0);
    const doFetch = vi.fn(async () => response(API_JSON));
    const ok = await refreshCatalog({
      home,
      provider: "opencode-go",
      fetch: doFetch as unknown as typeof fetch,
      now,
    });

    expect(ok).toBe(true);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(existsSync(cachePath(home))).toBe(true);
    const saved = JSON.parse(readFileSync(cachePath(home), "utf8"));
    expect(saved).toMatchObject({
      fetchedAt: now,
      provider: "opencode-go",
    });
    expect(findModel("alpha")?.label).toBe("Alpha");

    clearCatalog();
    const cached = loadCatalogFromCache({ home, provider: "opencode-go", now });
    expect(cached?.fresh).toBe(true);
    expect(findModel("alpha")?.label).toBe("Alpha");

    const again = vi.fn(async () => response(API_JSON));
    expect(
      await refreshCatalog({
        home,
        provider: "opencode-go",
        fetch: again as unknown as typeof fetch,
        now: now + 60 * 60 * 1000,
      }),
    ).toBe(true);
    expect(again).not.toHaveBeenCalled();
  });

  it("24時間より古ければ取りに行く", async () => {
    const now = Date.UTC(2026, 9, 28, 0, 0, 0);
    const first = vi.fn(async () => response(API_JSON));
    await refreshCatalog({
      home,
      provider: "opencode-go",
      fetch: first as unknown as typeof fetch,
      now,
    });

    expect(isFresh(now, now + 23 * 60 * 60 * 1000)).toBe(true);
    expect(isFresh(now, now + 25 * 60 * 60 * 1000)).toBe(false);

    const stale = loadCatalogFromCache({
      home,
      provider: "opencode-go",
      now: now + 25 * 60 * 60 * 1000,
    });
    expect(stale?.fresh).toBe(false);

    const second = vi.fn(async () => response(API_JSON));
    expect(
      await refreshCatalog({
        home,
        provider: "opencode-go",
        fetch: second as unknown as typeof fetch,
        now: now + 25 * 60 * 60 * 1000,
      }),
    ).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("取れなければ組み込みの表を使う", async () => {
    const warnings: string[] = [];
    const doFetch = vi.fn(async () => {
      throw new Error("offline");
    });
    const ok = await refreshCatalog({
      home,
      provider: "opencode-go",
      fetch: doFetch as unknown as typeof fetch,
      onWarning: (line) => warnings.push(line),
    });

    expect(ok).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("組み込みの表");
    expect(listModels()).toBe(MODELS);
    expect(findModel("deepseek-v4.1-flash")?.label).toBe("deepseek-v4.1-flash");
  });

  it("選んだ provider の分だけ保存する", async () => {
    const doFetch = vi.fn(async () => response(API_JSON));
    await refreshCatalog({
      home,
      provider: "other",
      fetch: doFetch as unknown as typeof fetch,
    });

    const saved = JSON.parse(readFileSync(cachePath(home), "utf8"));
    expect(saved.provider).toBe("other");
    expect(Object.keys(saved.data.models)).toEqual(["nope"]);
    expect(findModel("nope")?.label).toBe("nope");
    expect(findModel("alpha")).toBeUndefined();
  });
});
