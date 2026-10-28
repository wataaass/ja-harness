import { unlink } from "node:fs";
import { resolve } from "node:path";
import { JobError } from "../errors.js";

function fail(callback, message) {
  process.nextTick(() => callback(new JobError(message)));
}

export function deleteFileJob(payload, context, callback) {
  if (typeof payload !== "object" || payload === null) {
    fail(callback, "delete-file の payload はオブジェクトです");
    return;
  }
  if (typeof payload.path !== "string" || payload.path === "") {
    fail(callback, "delete-file には path が必要です");
    return;
  }
  const target = resolve(payload.path);
  const missingOk = payload.missingOk ?? true;
  unlink(target, (error) => {
    if (error) {
      if (error.code === "ENOENT" && missingOk) {
        context.logger.info(`delete-file: ${target} はありません`);
        callback(null, { path: target, removed: false });
        return;
      }
      callback(new JobError(`ファイルを消せません: ${target}`, error));
      return;
    }
    context.logger.info(`delete-file: ${target}`);
    callback(null, { path: target, removed: true });
  });
}

export default deleteFileJob;
