import { mkdir, readFile, rm, writeFile } from "node:fs";
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

export function createMemoryStore(initial) {
  let state = initial === undefined ? emptyState() : cloneState(initial);
  return {
    load(callback) {
      process.nextTick(() => callback(null, cloneState(state)));
    },
    save(next, callback) {
      state = cloneState(next);
      process.nextTick(() => callback(null));
    },
    clear(callback) {
      state = emptyState();
      process.nextTick(() => callback(null));
    },
  };
}

export function createStore(directory) {
  if (typeof directory !== "string" || directory === "") {
    throw new JobError("store の保存先を指定してください");
  }
  const file = join(directory, "state.json");
  return {
    load(callback) {
      mkdir(directory, { recursive: true }, (mkdirError) => {
        if (mkdirError) {
          callback(asJobError(mkdirError));
          return;
        }
        readFile(file, "utf8", (readError, text) => {
          if (readError) {
            if (readError.code === "ENOENT") {
              callback(null, emptyState());
              return;
            }
            callback(asJobError(readError));
            return;
          }
          try {
            callback(null, parseState(text));
          } catch (error) {
            callback(asJobError(error));
          }
        });
      });
    },
    save(state, callback) {
      mkdir(directory, { recursive: true }, (mkdirError) => {
        if (mkdirError) {
          callback(asJobError(mkdirError));
          return;
        }
        writeFile(
          file,
          `${JSON.stringify(state, null, 2)}\n`,
          "utf8",
          (writeError) => {
            callback(writeError ? asJobError(writeError) : null);
          },
        );
      });
    },
    clear(callback) {
      rm(file, { force: true }, (error) => {
        callback(error ? asJobError(error) : null);
      });
    },
  };
}
