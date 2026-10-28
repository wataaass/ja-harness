import { copyFile, mkdir } from "node:fs";
import { dirname, resolve } from "node:path";
import { JobError } from "../errors.js";

function fail(callback, message) {
  process.nextTick(() => callback(new JobError(message)));
}

export function copyFileJob(payload, context, callback) {
  if (typeof payload !== "object" || payload === null) {
    fail(callback, "copy-file の payload はオブジェクトです");
    return;
  }
  if (typeof payload.source !== "string" || payload.source === "") {
    fail(callback, "copy-file には source が必要です");
    return;
  }
  if (typeof payload.target !== "string" || payload.target === "") {
    fail(callback, "copy-file には target が必要です");
    return;
  }
  const source = resolve(payload.source);
  const target = resolve(payload.target);
  mkdir(dirname(target), { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      callback(new JobError(`フォルダを作れません: ${target}`, mkdirError));
      return;
    }
    copyFile(source, target, (copyError) => {
      if (copyError) {
        callback(new JobError(`コピーできません: ${source}`, copyError));
        return;
      }
      context.logger.info(`copy-file: ${source} -> ${target}`);
      callback(null, { source, target });
    });
  });
}

export default copyFileJob;
