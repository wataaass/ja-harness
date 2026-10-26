import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/text.js";

test("英字を小文字にしてつなぐ", () => {
  assert.equal(slugify("Café au lait"), "cafe-au-lait");
  assert.equal(slugify("Hello World"), "hello-world");
});

test("全角の英数字を半角に直す", () => {
  assert.equal(slugify("Ｈｅｌｌｏ　Ｗｏｒｌｄ"), "hello-world");
});

test("日本語と記号を残さない", () => {
  assert.equal(slugify("日本語"), "");
  assert.equal(slugify("A_B C.D/E"), "a-b-c-d-e");
});

test("maxLength で単語の途中を切らない", () => {
  assert.equal(slugify("the quick brown fox", { maxLength: 12 }), "the-quick");
  assert.equal(slugify("abcdefghij", { maxLength: 4 }), "abcd");
});

test("区切り文字を変えられる", () => {
  assert.equal(slugify("Café au lait", { separator: "_" }), "cafe_au_lait");
});

test("大文字を残せる", () => {
  assert.equal(slugify("Hello World", { lowercase: false }), "Hello-World");
});
