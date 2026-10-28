import { mkdir, readFile, writeFile } from "node:fs";
import { dirname, resolve } from "node:path";
import { JobError } from "../errors.js";

const MODES = new Set(["upper", "lower", "trim"]);

function fail(callback, message) {
  process.nextTick(() => callback(new JobError(message)));
}

function transform(text, mode) {
  if (mode === "lower") {
    return text.toLowerCase();
  }
  if (mode === "trim") {
    return text.trim();
  }
  return text.toUpperCase();
}

export function transformFileJob(payload, context, callback) {
  if (typeof payload !== "object" || payload === null) {
    fail(callback, "transform-file の payload はオブジェクトです");
    return;
  }
  if (typeof payload.source !== "string" || payload.source === "") {
    fail(callback, "transform-file には source が必要です");
    return;
  }
  if (typeof payload.target !== "string" || payload.target === "") {
    fail(callback, "transform-file には target が必要です");
    return;
  }
  const mode = payload.mode ?? "upper";
  if (!MODES.has(mode)) {
    fail(callback, `transform-file の mode が正しくありません: ${mode}`);
    return;
  }
  const source = resolve(payload.source);
  const target = resolve(payload.target);
  readFile(source, "utf8", (readError, text) => {
    if (readError) {
      callback(new JobError(`ファイルを読めません: ${source}`, readError));
      return;
    }
    const output = transform(text, mode);
    mkdir(dirname(target), { recursive: true }, (mkdirError) => {
      if (mkdirError) {
        callback(new JobError(`フォルダを作れません: ${target}`, mkdirError));
        return;
      }
      writeFile(target, output, "utf8", (writeError) => {
        if (writeError) {
          callback(new JobError(`ファイルを書けません: ${target}`, writeError));
          return;
        }
        context.logger.info(`transform-file: ${source} -> ${target}`);
        callback(null, { source, target, mode, bytes: Buffer.byteLength(output) });
      });
    });
  });
}

export default transformFileJob;
