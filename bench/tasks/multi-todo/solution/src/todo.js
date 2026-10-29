import { existsSync, readFileSync, writeFileSync } from "node:fs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function nextId(todos) {
  let max = 0;
  for (const todo of todos) {
    if (Number.isInteger(todo.id) && todo.id > max) {
      max = todo.id;
    }
  }
  return max + 1;
}

function datePart(value, label) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError(`${label} は正しい日付にしてください`);
    }
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.length >= 10) {
    const text = value.slice(0, 10);
    if (DATE.test(text)) {
      return text;
    }
  }
  throw new TypeError(`${label} は日付にしてください（今: ${value}）`);
}

function normalizeDue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return datePart(value, "due");
}

export function addTodo(todos, title, options = {}) {
  if (typeof title !== "string" || title === "") {
    throw new TypeError("title は空でない文字列にしてください");
  }
  const due = normalizeDue(options.due);
  return [
    ...todos,
    { id: nextId(todos), title, done: false, due },
  ];
}

export function completeTodo(todos, id) {
  let found = false;
  const next = todos.map((todo) => {
    if (todo.id !== id) {
      return todo;
    }
    found = true;
    return { ...todo, done: true };
  });
  if (!found) {
    throw new Error(`id ${id} の項目がありません`);
  }
  return next;
}

export function listTodos(todos, options = {}) {
  const filter = options.filter ?? "all";
  if (filter !== "all" && filter !== "active" && filter !== "done") {
    throw new RangeError(`filter は all・active・done のどれかにしてください（今: ${filter}）`);
  }
  return todos
    .filter((todo) => {
      if (filter === "active") {
        return !todo.done;
      }
      if (filter === "done") {
        return todo.done;
      }
      return true;
    })
    .sort((left, right) => left.id - right.id);
}

export function listOverdue(todos, now) {
  const today = datePart(now, "now");
  return todos
    .filter(
      (todo) => !todo.done && todo.due !== null && todo.due < today,
    )
    .sort((left, right) => left.id - right.id);
}

export function snoozeTodo(todos, id, due) {
  if (typeof due !== "string" || !DATE.test(due)) {
    throw new TypeError(`due は YYYY-MM-DD にしてください（今: ${due}）`);
  }
  let found = false;
  const next = todos.map((todo) => {
    if (todo.id !== id) {
      return todo;
    }
    found = true;
    return { ...todo, due };
  });
  if (!found) {
    throw new Error(`id ${id} の項目がありません`);
  }
  return next;
}

export function saveTodos(path, todos) {
  const data = { version: 1, todos };
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function loadTodos(path) {
  if (!existsSync(path)) {
    return [];
  }
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} を読めません: ${message}`);
  }
  if (value === null || typeof value !== "object" || !Array.isArray(value.todos)) {
    throw new Error(`${path} に todos の配列がありません`);
  }
  return value.todos;
}
