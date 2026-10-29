import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { asJobError, JobError } from "../errors.js";

export async function writeFileJob(payload, context) {
  if (typeof payload !== "object" || payload === null) {
    throw new JobError("write-file の payload はオブジェクトです");
  }
  if (typeof payload.path !== "string" || payload.path === "") {
    throw new JobError("write-file には path が必要です");
  }
  if (typeof payload.content !== "string" && !Buffer.isBuffer(payload.content)) {
    throw new JobError("write-file の content は文字列か Buffer です");
  }
  const target = resolve(payload.path);
  const encoding = payload.encoding ?? "utf8";
  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, payload.content, encoding);
  } catch (error) {
    throw asJobError(error, `ファイルを書けません: ${target}`);
  }
  context.logger.info(`write-file: ${target}`);
  return {
    path: target,
    bytes: Buffer.byteLength(payload.content, encoding),
  };
}

export default writeFileJob;
