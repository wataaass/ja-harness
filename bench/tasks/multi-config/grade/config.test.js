import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/load.js";
import { validateConfig } from "../src/validate.js";

const base = {
  host: "localhost",
  port: 3000,
  debug: false,
  logLevel: "info",
  db: { url: "file:app.db", pool: 5 },
};

function withFile(value, run) {
  const dir = mkdtempSync(join(tmpdir(), "multi-config-"));
  try {
    const path = join(dir, "config.json");
    writeFileSync(path, JSON.stringify(value), "utf8");
    return run(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("ファイルの値が既定値より優先される", () => {
  withFile({ port: 8080, db: { pool: 10 } }, (path) => {
    assert.deepEqual(loadConfig(path, { env: {} }), {
      ...base,
      port: 8080,
      db: { url: "file:app.db", pool: 10 },
    });
  });
  withFile({ db: { url: "file:custom.db" } }, (path) => {
    const config = loadConfig(path, { env: {} });
    assert.equal(config.db.url, "file:custom.db");
    assert.equal(config.db.pool, 5);
    assert.equal(config.host, "localhost");
  });
});

test("すべての値をファイルで変えられる", () => {
  const value = {
    host: "example.test",
    port: 9000,
    debug: true,
    logLevel: "error",
    db: { url: "file:prod.db", pool: 20 },
  };
  withFile(value, (path) => {
    assert.deepEqual(loadConfig(path, { env: {} }), value);
  });
});

test("環境変数がファイルより優先される", () => {
  withFile({ port: 8080, db: { pool: 10 } }, (path) => {
    const config = loadConfig(path, {
      env: {
        APP_HOST: "0.0.0.0",
        APP_PORT: "9090",
        APP_DEBUG: "true",
        APP_LOG_LEVEL: "warn",
        APP_DB_URL: "file:test.db",
      },
    });
    assert.deepEqual(config, {
      host: "0.0.0.0",
      port: 9090,
      debug: true,
      logLevel: "warn",
      db: { url: "file:test.db", pool: 10 },
    });
  });
});

test("真偽値の環境変数とない環境変数", () => {
  withFile({ port: 8080 }, (path) => {
    assert.equal(loadConfig(path, { env: {} }).port, 8080);
    for (const [value, expected] of [
      ["1", true],
      ["yes", true],
      ["0", false],
      ["no", false],
    ]) {
      assert.equal(
        loadConfig(path, { env: { APP_DEBUG: value } }).debug,
        expected,
      );
    }
  });
});

test("正しい設定はそのまま返す", () => {
  assert.equal(validateConfig(base), base);
});

test("各項目のエラー文", () => {
  const cases = [
    [{ port: 0 }, /port は1〜65535の整数にしてください（今: 0）/],
    [{ port: 70000 }, /port は1〜65535の整数にしてください/],
    [{ port: 1.5 }, /port は1〜65535の整数にしてください/],
    [{ port: "3000" }, /port は1〜65535の整数にしてください/],
    [{ host: "" }, /host は空でない文字列にしてください（今: ）/],
    [{ debug: "yes" }, /debug は真偽値にしてください（今: yes）/],
    [
      { logLevel: "trace" },
      /logLevel は debug・info・warn・error のどれかにしてください（今: trace）/,
    ],
    [{ db: { ...base.db, url: "" } }, /db.url は空でない文字列にしてください/],
    [
      { db: { ...base.db, pool: 0 } },
      /db.pool は1以上の整数にしてください（今: 0）/,
    ],
  ];
  for (const [patch, message] of cases) {
    assert.throws(() => validateConfig({ ...base, ...patch }), message);
  }
});

test("config や db がなくても分かりやすくエラーにする", () => {
  assert.throws(() => validateConfig({}), /port は1〜65535の整数/);
  assert.throws(
    () => validateConfig({ ...base, db: undefined }),
    /db.url は空でない文字列/,
  );
});

test("環境変数の不正な値は読み込みでエラーになる", () => {
  withFile({}, (path) => {
    assert.throws(
      () => loadConfig(path, { env: { APP_PORT: "abc" } }),
      /port は1〜65535の整数にしてください/,
    );
    assert.throws(
      () => loadConfig(path, { env: { APP_DB_URL: "" } }),
      /db.url は空でない文字列にしてください/,
    );
  });
});
