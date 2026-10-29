import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { asJobError, JobError } from "../errors.js";

export async function deleteFileJob(payload, context) {
  if (typeof payload !== "object" || payload === null) {
    throw new JobError("delete-file の payload はオブジェクトです");
  }
  if (typeof payload.path !== "string" || payload.path === "") {
    throw new JobError("delete-file には path が必要です");
  }
  const target = resolve(payload.path);
  const missingOk = payload.missingOk ?? true;
  try {
    await unlink(target);
  } catch (error) {
    if (error.code === "ENOENT" && missingOk) {
      context.logger.info(`delete-file: ${target} はありません`);
      return { path: target, removed: false };
    }
    throw asJobError(error, `ファイルを消せません: ${target}`);
  }
  context.logger.info(`delete-file: ${target}`);
  return { path: target, removed: true };
}

export default deleteFileJob;
