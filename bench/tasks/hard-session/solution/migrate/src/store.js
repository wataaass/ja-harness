import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { JobError, asJobError } from "./errors.js";

function emptyState() {
  return { records: [] };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function parseState(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new JobError("保存された状態を読めません", error);
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray(value.records)
  ) {
    throw new JobError("保存された状態の形が正しくありません");
  }
  return { records: value.records };
}

function settle(promise, callback) {
  if (typeof callback === "function") {
    promise.then(
      (value) => callback(null, value),
      (error) => callback(asJobError(error)),
    );
    return undefined;
  }
  return promise.catch((error) => {
    throw asJobError(error);
  });
}

export function createMemoryStore(initial) {
  let state = initial === undefined ? emptyState() : cloneState(initial);
  return {
    load(callback) {
      return settle(
        Promise.resolve().then(() => cloneState(state)),
        callback,
      );
    },
    save(next, callback) {
      return settle(
        Promise.resolve().then(() => {
          state = cloneState(next);
        }),
        callback,
      );
    },
    clear(callback) {
      return settle(
        Promise.resolve().then(() => {
          state = emptyState();
        }),
        callback,
      );
    },
  };
}

export function createStore(directory) {
  if (typeof directory !== "string" || directory === "") {
    throw new JobError("store の保存先を指定してください");
  }
  const file = join(directory, "state.json");

  async function loadState() {
    await mkdir(directory, { recursive: true });
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return emptyState();
      }
      throw asJobError(error);
    }
    return parseState(text);
  }

  async function saveState(state) {
    await mkdir(directory, { recursive: true });
    await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  return {
    load(callback) {
      return settle(loadState(), callback);
    },
    save(state, callback) {
      return settle(saveState(state), callback);
    },
    clear(callback) {
      return settle(
        rm(file, { force: true }).catch((error) => {
          throw asJobError(error);
        }),
        callback,
      );
    },
  };
}
