import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addTodo,
  completeTodo,
  listTodos,
  listOverdue,
  loadTodos,
  saveTodos,
  snoozeTodo,
} from "../src/todo.js";

function sample() {
  return addTodo(
    addTodo(addTodo([], "A"), "B", { due: "2024-01-10" }),
    "C",
    { due: "2024-01-20T09:30:00" },
  );
}

test("追加は入力の配列を変えない", () => {
  const before = [{ id: 4, title: "X", done: true, due: null }];
  const after = addTodo(before, "Y");
  assert.deepEqual(before, [{ id: 4, title: "X", done: true, due: null }]);
  assert.deepEqual(after, [
    { id: 4, title: "X", done: true, due: null },
    { id: 5, title: "Y", done: false, due: null },
  ]);
});

test("title と filter の検証", () => {
  assert.throws(() => addTodo([], ""), TypeError);
  assert.throws(() => addTodo([], ""), /title/);
  assert.throws(() => listTodos([], { filter: "other" }), RangeError);
  assert.throws(() => listTodos([], { filter: "other" }), /filter/);
});

test("完了は新しい配列を返す", () => {
  const todos = sample();
  const done = completeTodo(todos, 2);
  assert.equal(todos[1].done, false);
  assert.equal(done[1].done, true);
  assert.throws(() => completeTodo(todos, 99), /99/);
});

test("一覧は id の昇順で絞り込む", () => {
  const todos = completeTodo(sample(), 2);
  assert.deepEqual(
    listTodos([...todos].reverse()).map((todo) => todo.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    listTodos(todos, { filter: "active" }).map((todo) => todo.id),
    [1, 3],
  );
  assert.deepEqual(
    listTodos(todos, { filter: "done" }).map((todo) => todo.id),
    [2],
  );
});

test("期限切れは日付だけで比べる", () => {
  const todos = sample();
  assert.deepEqual(
    listOverdue(todos, "2024-01-15").map((todo) => todo.id),
    [2],
  );
  assert.deepEqual(
    listOverdue(todos, "2024-01-20T23:59:00").map((todo) => todo.id),
    [2],
  );
  assert.deepEqual(
    listOverdue(todos, new Date("2024-01-21T00:00:00Z")).map((todo) => todo.id),
    [2, 3],
  );
  assert.deepEqual(listOverdue(todos, "2024-01-10"), []);
});

test("完了した項目は期限切れにしない", () => {
  const todos = completeTodo(sample(), 2);
  assert.deepEqual(
    listOverdue(todos, "2024-02-01").map((todo) => todo.id),
    [3],
  );
});

test("日時つきの期限は日付だけを保存する", () => {
  const todos = sample();
  assert.equal(todos[2].due, "2024-01-20");
});

test("延期は入力の配列を変えない", () => {
  const todos = sample();
  const next = snoozeTodo(todos, 1, "2024-03-01");
  assert.equal(todos[0].due, null);
  assert.equal(next[0].due, "2024-03-01");
  assert.throws(() => snoozeTodo(todos, 99, "2024-03-01"), /99/);
  assert.throws(() => snoozeTodo(todos, 1, "2024/03/01"), /due/);
});

test("保存と読み込み", () => {
  const dir = mkdtempSync(join(tmpdir(), "multi-todo-"));
  try {
    const path = join(dir, "todos.json");
    const todos = sample();
    saveTodos(path, todos);
    assert.deepEqual(loadTodos(path), todos);

    const text = readFileSync(path, "utf8");
    assert.equal(text.endsWith("\n"), true);
    assert.equal(JSON.parse(text).version, 1);
    assert.equal(text, `${JSON.stringify({ version: 1, todos }, null, 2)}\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ないファイルは空の配列", () => {
  assert.deepEqual(loadTodos(join(tmpdir(), "multi-todo-nope.json")), []);
});

test("壊れたファイルはエラーに path を入れる", () => {
  const dir = mkdtempSync(join(tmpdir(), "multi-todo-"));
  try {
    const broken = join(dir, "broken.json");
    writeFileSync(broken, "{", "utf8");
    assert.throws(() => loadTodos(broken), new RegExp(broken));

    const wrong = join(dir, "wrong.json");
    writeFileSync(wrong, JSON.stringify({ todos: "x" }), "utf8");
    assert.throws(() => loadTodos(wrong), new RegExp(wrong));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("保存したデータをそのまま捨てない", () => {
  const todos = sample();
  completeTodo(todos, 1);
  assert.equal(todos[0].done, false);
});
