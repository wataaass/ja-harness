import { messageOf } from "./errors.js";
import { runJob } from "./worker.js";

export function runQueue(queue, callback) {
  const pending = queue.pendingRecords();
  let next = 0;
  let active = 0;
  let finished = false;
  const completed = [];
  const failed = [];

  const finish = () => {
    if (finished) {
      return;
    }
    if (active === 0 && (next >= pending.length || queue.stopped)) {
      finished = true;
      callback(null, { completed, failed });
    }
  };

  const pump = () => {
    if (finished) {
      return;
    }
    while (
      active <= queue.concurrency &&
      !queue.stopped &&
      next < pending.length
    ) {
      const record = pending[next];
      next += 1;
      active += 1;
      queue.markRunning(record);
      runJob(queue, record, (error, result) => {
        active -= 1;
        if (error) {
          queue.finish(record, error);
          failed.push(record);
          queue.logger.error(`${record.type} が失敗しました: ${messageOf(error)}`);
        } else {
          queue.finish(record, null, result);
          completed.push(record);
        }
        queue.save((saveError) => {
          if (saveError) {
            queue.logger.error(`状態を保存できません: ${messageOf(saveError)}`);
          }
          pump();
        });
      });
    }
    finish();
  };

  pump();
}
