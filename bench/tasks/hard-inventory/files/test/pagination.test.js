import test from "node:test";
import assert from "node:assert/strict";
import { allPages, PaginationError, paginate } from "../src/repository.js";

test("ちょうど割り切れる件数はそのページ数になる", () => {
  const result = paginate([1, 2, 3, 4], { page: 1, pageSize: 2 });
  assert.equal(result.totalPages, 2);
  assert.equal(result.hasNext, true);
  assert.deepEqual(result.items, [1, 2]);
});

test("端数のある最後のページも返す", () => {
  const items = Array.from({ length: 23 }, (_, index) => index);
  const result = paginate(items, { page: 3, pageSize: 10 });
  assert.equal(result.totalPages, 3);
  assert.equal(result.items.length, 3);
  assert.equal(result.hasNext, false);
  assert.equal(result.hasPrevious, true);
});

test("件数が0ならページも0", () => {
  const result = paginate([], { page: 1, pageSize: 10 });
  assert.equal(result.totalPages, 0);
  assert.deepEqual(result.items, []);
  assert.equal(result.hasNext, false);
});

test("ページ数より後ろは空", () => {
  const result = paginate([1, 2, 3], { page: 5, pageSize: 2 });
  assert.deepEqual(result.items, []);
  assert.equal(result.hasNext, false);
});

test("おかしなページはエラー", () => {
  assert.throws(() => paginate([1], { page: 0 }), PaginationError);
  assert.throws(() => paginate([1], { pageSize: 0 }), PaginationError);
});

test("すべてのページを順に取れる", () => {
  const pages = allPages([1, 2, 3, 4, 5], 2);
  assert.deepEqual(pages, [[1, 2], [3, 4], [5]]);
});
