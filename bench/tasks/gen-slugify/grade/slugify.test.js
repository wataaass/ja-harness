import test from "node:test";
import assert from "node:assert/strict";
import * as text from "../src/text.js";

const slugify = text.slugify ?? (() => {
  throw new Error("slugify がありません");
});

test("英数字を小文字にしてつなぐ", () => {
  assert.equal(slugify("Hello World"), "hello-world");
  assert.equal(slugify("ABC"), "abc");
  assert.equal(slugify("HelloWorld"), "helloworld");
});

test("数字を残す", () => {
  assert.equal(slugify("Article 2024"), "article-2024");
  assert.equal(slugify("v1.2.3"), "v1-2-3");
});

test("アクセント記号を外す", () => {
  assert.equal(slugify("Café au lait"), "cafe-au-lait");
  assert.equal(slugify("Crème brûlée"), "creme-brulee");
  assert.equal(slugify("naïve"), "naive");
  assert.equal(slugify("Über"), "uber");
});

test("全角の英数字を半角に直す", () => {
  assert.equal(slugify("Ｈｅｌｌｏ　Ｗｏｒｌｄ"), "hello-world");
  assert.equal(slugify("１２３"), "123");
});

test("記号と区切りをまとめる", () => {
  assert.equal(slugify("  Hello,   World!  "), "hello-world");
  assert.equal(slugify("foo_bar--baz"), "foo-bar-baz");
  assert.equal(slugify("foo---bar"), "foo-bar");
  assert.equal(slugify("A_B C.D/E"), "a-b-c-d-e");
  assert.equal(slugify("A & B"), "a-b");
  assert.equal(slugify("don't"), "don-t");
  assert.equal(slugify("(test) [case]"), "test-case");
});

test("前後の区切りを残さない", () => {
  assert.equal(slugify("---hello---"), "hello");
  assert.equal(slugify("!!!hello!!!"), "hello");
});

test("日本語を残さない", () => {
  assert.equal(slugify("日本語のタイトル"), "");
  assert.equal(slugify("Article 日本語 2024"), "article-2024");
  assert.equal(slugify("東京 2024 大阪"), "2024");
  assert.equal(slugify("😀🎉"), "");
});

test("記号だけの入力", () => {
  assert.equal(slugify(""), "");
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify("   "), "");
});

test("null と undefined", () => {
  assert.equal(slugify(null), "");
  assert.equal(slugify(undefined), "");
});

test("maxLength で単語の途中を切らない", () => {
  assert.equal(slugify("the quick brown fox", { maxLength: 12 }), "the-quick");
  assert.equal(slugify("the quick brown fox", { maxLength: 9 }), "the-quick");
  assert.equal(slugify("the quick brown fox", { maxLength: 8 }), "the");
  assert.equal(slugify("the quick brown fox", { maxLength: 15 }), "the-quick-brown");
  assert.equal(slugify("the quick brown fox", { maxLength: 11 }), "the-quick");
});

test("maxLength が結果以上のときはそのまま", () => {
  assert.equal(slugify("hello world", { maxLength: 11 }), "hello-world");
  assert.equal(slugify("hello world", { maxLength: 100 }), "hello-world");
});

test("1語だけで maxLength を超える場合は先頭から切る", () => {
  assert.equal(slugify("abcdefghij", { maxLength: 4 }), "abcd");
  assert.equal(slugify("abcdefghij", { maxLength: 1 }), "a");
  assert.equal(slugify("hello world", { maxLength: 3 }), "hel");
});

test("maxLength が0以下なら空", () => {
  assert.equal(slugify("hello", { maxLength: 0 }), "");
  assert.equal(slugify("hello", { maxLength: -3 }), "");
});

test("maxLength を指定しなければ切らない", () => {
  assert.equal(slugify("hello world"), "hello-world");
  assert.equal(slugify("a".repeat(200)).length, 200);
});

test("結果は英小文字・数字・ハイフンだけ", () => {
  const value = slugify("Café & 日本語 -- Test!! 2024");
  assert.match(value, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(value, "cafe-test-2024");
});

test("maxLength を付けても形が崩れない", () => {
  const value = slugify("Café & 日本語 -- Test!! 2024", { maxLength: 10 });
  assert.match(value, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(value, "cafe-test");
});
