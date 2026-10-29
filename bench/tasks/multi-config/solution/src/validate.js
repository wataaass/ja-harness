function show(value) {
  return String(value);
}

function checkPort(value) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new Error(`port は1〜65535の整数にしてください（今: ${show(value)}）`);
  }
}

function checkHost(value) {
  if (typeof value !== "string" || value === "") {
    throw new Error(
      `host は空でない文字列にしてください（今: ${show(value)}）`,
    );
  }
}

function checkDebug(value) {
  if (typeof value !== "boolean") {
    throw new Error(`debug は真偽値にしてください（今: ${show(value)}）`);
  }
}

function checkLogLevel(value) {
  if (
    value !== "debug" &&
    value !== "info" &&
    value !== "warn" &&
    value !== "error"
  ) {
    throw new Error(
      `logLevel は debug・info・warn・error のどれかにしてください（今: ${show(value)}）`,
    );
  }
}

function checkDbUrl(value) {
  if (typeof value !== "string" || value === "") {
    throw new Error(
      `db.url は空でない文字列にしてください（今: ${show(value)}）`,
    );
  }
}

function checkDbPool(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(
      `db.pool は1以上の整数にしてください（今: ${show(value)}）`,
    );
  }
}

export function validateConfig(config) {
  const value = config ?? {};
  checkPort(value.port);
  checkHost(value.host);
  checkDebug(value.debug);
  checkLogLevel(value.logLevel);
  const db = value.db ?? {};
  checkDbUrl(db.url);
  checkDbPool(db.pool);
  return config;
}
