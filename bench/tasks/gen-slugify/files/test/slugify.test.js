import test from "node:test";
import assert from "node:assert/strict";
import * as text from "../src/text.js";

const slugify = text.slugify;

test("英数字を小文字にしてつなぐ", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});

test("アクセント記号を外す", () => {
  assert.equal(slugify("Café au lait"), "cafe-au-lait");
});

test("記号と連続する区切りをまとめる", () => {
  assert.equal(slugify("  Hello,   World!  "), "hello-world");
  assert.equal(slugify("foo_bar--baz"), "foo-bar-baz");
});

test("日本語は残さない", () => {
  assert.equal(slugify("日本語のタイトル"), "");
  assert.equal(slugify("Article 日本語 2024"), "article-2024");
});

test("maxLength で単語の途中を切らない", () => {
  assert.equal(slugify("the quick brown fox", { maxLength: 12 }), "the-quick");
  assert.equal(slugify("the quick brown fox", { maxLength: 15 }), "the-quick-brown");
});

test("1語だけで maxLength を超える場合は先頭から切る", () => {
  assert.equal(slugify("abcdefghij", { maxLength: 4 }), "abcd");
});

test("空の入力", () => {
  assert.equal(slugify(""), "");
  assert.equal(slugify("!!!"), "");
});
