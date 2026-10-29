import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { asJobError, JobError } from "../errors.js";

const MODES = new Set(["upper", "lower", "trim"]);

function transform(text, mode) {
  if (mode === "lower") {
    return text.toLowerCase();
  }
  if (mode === "trim") {
    return text.trim();
  }
  return text.toUpperCase();
}

export async function transformFileJob(payload, context) {
  if (typeof payload !== "object" || payload === null) {
    throw new JobError("transform-file の payload はオブジェクトです");
  }
  if (typeof payload.source !== "string" || payload.source === "") {
    throw new JobError("transform-file には source が必要です");
  }
  if (typeof payload.target !== "string" || payload.target === "") {
    throw new JobError("transform-file には target が必要です");
  }
  const mode = payload.mode ?? "upper";
  if (!MODES.has(mode)) {
    throw new JobError(`transform-file の mode が正しくありません: ${mode}`);
  }
  const source = resolve(payload.source);
  const target = resolve(payload.target);
  try {
    const text = await readFile(source, "utf8");
    const output = transform(text, mode);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, output, "utf8");
    context.logger.info(`transform-file: ${source} -> ${target}`);
    return { source, target, mode, bytes: Buffer.byteLength(output) };
  } catch (error) {
    throw asJobError(error, `変換できません: ${source}`);
  }
}

export default transformFileJob;
