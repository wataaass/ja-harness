import test from "node:test";
import assert from "node:assert/strict";
import { addTodo, completeTodo, listTodos } from "../src/todo.js";

test("追加すると新しい配列になる", () => {
  const before = [];
  const after = addTodo(before, "牛乳を買う");
  assert.deepEqual(before, []);
  assert.deepEqual(after, [
    { id: 1, title: "牛乳を買う", done: false, due: null },
  ]);
});

test("id は既存の最大に1を足す", () => {
  const todos = addTodo(addTodo([], "A"), "B");
  assert.equal(todos[1].id, 2);
});

test("完了にすると done が true になる", () => {
  const todos = addTodo([], "A");
  const done = completeTodo(todos, 1);
  assert.equal(done[0].done, true);
  assert.equal(todos[0].done, false);
});

test("一覧を絞り込める", () => {
  const todos = completeTodo(addTodo(addTodo([], "A"), "B"), 1);
  assert.deepEqual(
    listTodos(todos, { filter: "active" }).map((todo) => todo.title),
    ["B"],
  );
  assert.deepEqual(
    listTodos(todos, { filter: "done" }).map((todo) => todo.title),
    ["A"],
  );
  assert.equal(listTodos(todos).length, 2);
});
