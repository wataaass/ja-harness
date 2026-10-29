import { messageOf } from "./errors.js";
import { runJob } from "./worker.js";

export async function runQueue(queue) {
  const pending = queue.pendingRecords();
  let next = 0;
  const completed = [];
  const failed = [];

  const work = async () => {
    while (true) {
      if (queue.stopped) {
        return;
      }
      if (next >= pending.length) {
        return;
      }
      const record = pending[next];
      next += 1;
      queue.markRunning(record);
      try {
        const result = await runJob(queue, record);
        queue.finish(record, null, result);
        completed.push(record);
      } catch (error) {
        queue.finish(record, error);
        failed.push(record);
        queue.logger.error(`${record.type} が失敗しました: ${messageOf(error)}`);
      }
      try {
        await queue.save();
      } catch (error) {
        queue.logger.error(`状態を保存できません: ${messageOf(error)}`);
      }
    }
  };

  const workers = [];
  const size = Math.min(queue.concurrency, pending.length);
  for (let index = 0; index < size; index += 1) {
    workers.push(work());
  }
  await Promise.all(workers);
  return { completed, failed };
}
