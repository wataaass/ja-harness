export function validateConfig(config) {
  if (
    typeof config.port !== "number" ||
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535
  ) {
    throw new Error("設定が正しくありません");
  }
  if (typeof config.host !== "string" || config.host === "") {
    throw new Error("設定が正しくありません");
  }
  if (typeof config.debug !== "boolean") {
    throw new Error("設定が正しくありません");
  }
  if (
    config.logLevel !== "debug" &&
    config.logLevel !== "info" &&
    config.logLevel !== "warn" &&
    config.logLevel !== "error"
  ) {
    throw new Error("設定が正しくありません");
  }
  if (
    config.db === null ||
    typeof config.db !== "object" ||
    typeof config.db.url !== "string" ||
    config.db.url === ""
  ) {
    throw new Error("設定が正しくありません");
  }
  if (
    typeof config.db.pool !== "number" ||
    !Number.isInteger(config.db.pool) ||
    config.db.pool < 1
  ) {
    throw new Error("設定が正しくありません");
  }
  return config;
}
