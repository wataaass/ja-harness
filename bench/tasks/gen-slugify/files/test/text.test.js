import test from "node:test";
import assert from "node:assert/strict";
import {
  byteLength,
  camelCase,
  capitalize,
  charLength,
  dedent,
  escapeHtml,
  excerpt,
  indent,
  kebabCase,
  levenshtein,
  mask,
  normalizeWhitespace,
  ordinal,
  pascalCase,
  pluralize,
  reverse,
  similarity,
  snakeCase,
  stripAccents,
  stripHtml,
  titleCase,
  toAscii,
  toFullWidth,
  toHalfWidth,
  truncate,
  truncateMiddle,
  unescapeHtml,
  uniqueWords,
  wordCount,
  wrapText,
} from "../src/text.js";

test("空白をそろえる", () => {
  assert.equal(normalizeWhitespace("  a   b\n c "), "a b c");
});

test("全角と半角", () => {
  assert.equal(toHalfWidth("ＡＢＣ１２３"), "ABC123");
  assert.equal(toFullWidth("ABC123"), "ＡＢＣ１２３");
});

test("アクセントを外す", () => {
  assert.equal(stripAccents("Café naïve"), "Cafe naive");
});

test("文字数とバイト数", () => {
  assert.equal(charLength("日本語"), 3);
  assert.equal(byteLength("あ"), 3);
});

test("大文字小文字の変換", () => {
  assert.equal(capitalize("hello"), "Hello");
  assert.equal(titleCase("hello world"), "Hello World");
  assert.equal(camelCase("hello world"), "helloWorld");
  assert.equal(pascalCase("hello world"), "HelloWorld");
  assert.equal(snakeCase("helloWorld"), "hello_world");
  assert.equal(kebabCase("helloWorld"), "hello-world");
});

test("切り詰め", () => {
  assert.equal(truncate("abcdef", 4), "abc…");
  assert.equal(truncate("abc", 4), "abc");
  assert.equal(truncateMiddle("abcdefgh", 5), "ab…gh");
});

test("字下げと余白の除去", () => {
  assert.equal(indent("a\nb", 2), "  a\n  b");
  assert.equal(dedent("  a\n  b"), "a\nb");
});

test("HTML のエスケープ", () => {
  assert.equal(escapeHtml('<a href="x">'), "&lt;a href=&quot;x&quot;&gt;");
  assert.equal(unescapeHtml("&lt;a&gt;"), "<a>");
  assert.equal(stripHtml("<p>hello <b>world</b></p>"), "hello world");
});

test("単語の数と重複除去", () => {
  assert.equal(wordCount("a b  c"), 3);
  assert.deepEqual(uniqueWords("a b a"), ["a", "b"]);
});

test("反転と文字列の長さ分割", () => {
  assert.equal(reverse("abc"), "cba");
});

test("編集距離と類似度", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(similarity("abc", "abc"), 1);
});

test("マスク", () => {
  assert.equal(mask("12345678", 4), "****5678");
});

test("序数と複数形", () => {
  assert.equal(ordinal(1), "1st");
  assert.equal(ordinal(12), "12th");
  assert.equal(pluralize("item", 2), "items");
  assert.equal(pluralize("box", 2), "boxes");
});

test("ASCII への変換", () => {
  assert.equal(toAscii("Café 日本"), "Cafe ");
});

test("折り返し", () => {
  assert.equal(wrapText("aaa bbb ccc", 7), "aaa bbb\nccc");
});

test("抜粋", () => {
  assert.match(excerpt("hello world", "world", 3), /world/);
  assert.equal(excerpt("hello", "zzz", 10), "hello");
});
