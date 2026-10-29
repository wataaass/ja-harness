import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { asJobError, JobError } from "../errors.js";

export async function copyFileJob(payload, context) {
  if (typeof payload !== "object" || payload === null) {
    throw new JobError("copy-file の payload はオブジェクトです");
  }
  if (typeof payload.source !== "string" || payload.source === "") {
    throw new JobError("copy-file には source が必要です");
  }
  if (typeof payload.target !== "string" || payload.target === "") {
    throw new JobError("copy-file には target が必要です");
  }
  const source = resolve(payload.source);
  const target = resolve(payload.target);
  try {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  } catch (error) {
    throw asJobError(error, `コピーできません: ${source}`);
  }
  context.logger.info(`copy-file: ${source} -> ${target}`);
  return { source, target };
}

export default copyFileJob;
