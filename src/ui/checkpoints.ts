import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type CheckpointFile = {
  path: string;
  before: string | null;
};

type Turn = {
  files: CheckpointFile[];
};

export type Checkpoints = {
  beginTurn(): void;
  recordBefore(absPath: string): void;
  changedFiles(turnsBack?: number): CheckpointFile[];
  undo(n?: number): { restored: string[]; deleted: string[] };
  turns(): number;
};

export function createCheckpoints(): Checkpoints {
  const turns: Turn[] = [];

  function current(): Turn | undefined {
    return turns[turns.length - 1];
  }

  return {
    beginTurn() {
      turns.push({ files: [] });
    },

    recordBefore(absPath) {
      let turn = current();
      if (turn === undefined) {
        turn = { files: [] };
        turns.push(turn);
      }
      if (turn.files.some((file) => file.path === absPath)) {
        return;
      }
      let before: string | null = null;
      try {
        before = readFileSync(absPath, "utf8");
      } catch {
        before = null;
      }
      turn.files.push({ path: absPath, before });
    },

    changedFiles(turnsBack = 0) {
      const back = Math.max(0, Math.floor(turnsBack));
      const turn = turns[turns.length - 1 - back];
      return turn === undefined ? [] : turn.files.map((file) => ({ ...file }));
    },

    undo(n = 1) {
      const count = Math.max(0, Math.floor(n));
      const restored: string[] = [];
      const deleted: string[] = [];

      for (let turnIndex = 0; turnIndex < count; turnIndex += 1) {
        const turn = turns.pop();
        if (turn === undefined) {
          break;
        }
        for (const file of turn.files) {
          if (file.before === null) {
            if (existsSync(file.path)) {
              unlinkSync(file.path);
            }
            if (!deleted.includes(file.path)) {
              deleted.push(file.path);
            }
            continue;
          }
          mkdirSync(dirname(file.path), { recursive: true });
          writeFileSync(file.path, file.before, "utf8");
          if (!restored.includes(file.path)) {
            restored.push(file.path);
          }
        }
      }

      return { restored, deleted };
    },

    turns() {
      return turns.length;
    },
  };
}
