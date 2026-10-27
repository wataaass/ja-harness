export type History = {
  push: (text: string) => void;
  prev: (current: string) => string;
  next: () => string;
};

export function createHistory(limit = 200): History {
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  let entries: string[] = [];
  let index: number | null = null;
  let live = "";

  return {
    push(text: string) {
      if (entries[entries.length - 1] !== text) {
        entries.push(text);
      }
      if (max === 0) {
        entries = [];
      } else if (entries.length > max) {
        entries = entries.slice(entries.length - max);
      }
      index = null;
      live = "";
    },
    prev(current: string) {
      if (entries.length === 0) {
        return current;
      }
      if (index === null) {
        live = current;
        index = entries.length - 1;
        return entries[index] ?? current;
      }
      if (index > 0) {
        index -= 1;
      }
      return entries[index] ?? current;
    },
    next() {
      if (index === null) {
        return live;
      }
      if (index < entries.length - 1) {
        index += 1;
        return entries[index] ?? live;
      }
      index = null;
      return live;
    },
  };
}
