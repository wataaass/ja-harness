import { mkdir, writeFile } from "node:fs";
import { dirname, resolve } from "node:path";
import { JobError } from "../errors.js";

function fail(callback, message) {
  process.nextTick(() => callback(new JobError(message)));
}

export function writeFileJob(payload, context, callback) {
  if (typeof payload !== "object" || payload === null) {
    fail(callback, "write-file の payload はオブジェクトです");
    return;
  }
  if (typeof payload.path !== "string" || payload.path === "") {
    fail(callback, "write-file には path が必要です");
    return;
  }
  if (typeof payload.content !== "string" && !Buffer.isBuffer(payload.content)) {
    fail(callback, "write-file の content は文字列か Buffer です");
    return;
  }
  const target = resolve(payload.path);
  const encoding = payload.encoding ?? "utf8";
  mkdir(dirname(target), { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      callback(new JobError(`フォルダを作れません: ${target}`, mkdirError));
      return;
    }
    writeFile(target, payload.content, encoding, (writeError) => {
      if (writeError) {
        callback(new JobError(`ファイルを書けません: ${target}`, writeError));
        return;
      }
      context.logger.info(`write-file: ${target}`);
      callback(null, {
        path: target,
        bytes: Buffer.byteLength(payload.content, encoding),
      });
    });
  });
}

export default writeFileJob;
