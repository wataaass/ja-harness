function noop() {}

export function createLogger(custom) {
  if (custom === undefined) {
    return { info: noop, warn: noop, error: noop };
  }
  return {
    info: typeof custom.info === "function" ? custom.info : noop,
    warn: typeof custom.warn === "function" ? custom.warn : noop,
    error: typeof custom.error === "function" ? custom.error : noop,
  };
}

export const silentLogger = createLogger();
