import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/load.js";

test("ファイルの値で既定値を上書きする", () => {
  const config = loadConfig(new URL("../config/app.json", import.meta.url));
  assert.deepEqual(config, {
    host: "localhost",
    port: 8080,
    debug: false,
    logLevel: "info",
    db: {
      url: "file:app.db",
      pool: 10,
    },
  });
});
