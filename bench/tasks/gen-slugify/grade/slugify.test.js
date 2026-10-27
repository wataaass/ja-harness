import test from "node:test";
import assert from "node:assert/strict";
import {
  camelCase,
  charLength,
  kebabCase,
  normalizeWhitespace,
  slugify,
  stripAccents,
  toHalfWidth,
  truncate,
} from "../src/text.js";
import { articlePath, tagPath, withTrailingSlash } from "../src/urls.js";
import {
  collapseWhitespace,
  foldSpecialLatin,
  formatNumber,
  isNil,
} from "../src/util.js";

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

test("特殊なラテン文字を直す", () => {
  assert.equal(slugify("Straße"), "strasse");
  assert.equal(slugify("Æther"), "aether");
  assert.equal(slugify("Œuvre"), "oeuvre");
  assert.equal(slugify("Øresund"), "oresund");
  assert.equal(slugify("Łódź"), "lodz");
  assert.equal(slugify("Þing"), "thing");
  assert.equal(slugify("Đà Nẵng"), "da-nang");
});

test("全角の英数字を半角に直す", () => {
  assert.equal(slugify("Ｈｅｌｌｏ　Ｗｏｒｌｄ"), "hello-world");
  assert.equal(slugify("１２３"), "123");
  assert.equal(slugify("ＡＢＣ１２３"), "abc123");
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
});

test("絵文字を残さない", () => {
  assert.equal(slugify("😀🎉"), "");
  assert.equal(slugify("hello 😀 world"), "hello-world");
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

test("数値も文字列にする", () => {
  assert.equal(slugify(123), "123");
  assert.equal(slugify(12.5), "12-5");
});

test("lowercase を false にすると大文字を残す", () => {
  assert.equal(slugify("Hello World", { lowercase: false }), "Hello-World");
  assert.equal(slugify("ABC def", { lowercase: false }), "ABC-def");
});

test("区切り文字を変えられる", () => {
  assert.equal(slugify("Café au lait", { separator: "_" }), "cafe_au_lait");
  assert.equal(slugify("A_B C.D/E", { separator: "." }), "a.b.c.d.e");
  assert.equal(slugify("---hello---", { separator: "_" }), "hello");
});

test("区切り文字の検証", () => {
  for (const separator of ["", "ab", "a", "1", " "]) {
    assert.throws(() => slugify("hello", { separator }), RangeError, separator);
    assert.throws(() => slugify("hello", { separator }), /separator/, separator);
  }
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

test("maxLength は整数に切り捨てる", () => {
  assert.equal(slugify("abcdefghij", { maxLength: 4.9 }), "abcd");
  assert.equal(slugify("the quick brown fox", { maxLength: 12.9 }), "the-quick");
});

test("maxLength は区切りも数える", () => {
  assert.equal(slugify("the quick brown fox", { maxLength: 9, separator: "_" }), "the_quick");
  assert.equal(slugify("the quick brown fox", { maxLength: 8, separator: "_" }), "the");
  assert.equal(slugify("aa bb cc", { maxLength: 5, separator: "." }), "aa.bb");
});

test("maxLength が有限でなければ切らない", () => {
  assert.equal(slugify("hello world", { maxLength: Number.POSITIVE_INFINITY }), "hello-world");
  assert.equal(slugify("hello world", { maxLength: Number.NaN }), "hello-world");
  assert.equal(slugify("hello world", { maxLength: null }), "hello-world");
});

test("maxLength を指定しなければ切らない", () => {
  assert.equal(slugify("hello world"), "hello-world");
  assert.equal(slugify("a".repeat(200)).length, 200);
});

test("maxLength を付けても形が崩れない", () => {
  const value = slugify("Café & 日本語 -- Test!! 2024", { maxLength: 10 });
  assert.match(value, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(value, "cafe-test");
});

test("maxLength と特殊文字", () => {
  assert.equal(slugify("Straße", { maxLength: 4 }), "stra");
  assert.equal(slugify("Straße", { maxLength: 7 }), "strasse");
});

test("lowercase false と maxLength", () => {
  assert.equal(slugify("Hello World", { lowercase: false, maxLength: 7 }), "Hello");
});

test("結果は英小文字・数字・ハイフンだけ", () => {
  const value = slugify("Café & 日本語 -- Test!! 2024");
  assert.match(value, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(value, "cafe-test-2024");
});

test("結果は区切りで始まらない・終わらない", () => {
  for (const separator of ["-", "_", "."]) {
    const value = slugify("!! hello world !!", { separator });
    assert.equal(value.startsWith(separator), false);
    assert.equal(value.endsWith(separator), false);
  }
});

test("既存の toHalfWidth と stripAccents", () => {
  assert.equal(toHalfWidth("ＡＢＣ１２３"), "ABC123");
  assert.equal(stripAccents("Café naïve"), "Cafe naive");
});

test("既存の文字列の関数", () => {
  assert.equal(normalizeWhitespace("  a   b\n c "), "a b c");
  assert.equal(charLength("日本語"), 3);
  assert.equal(truncate("abcdef", 4), "abc…");
  assert.equal(camelCase("hello world"), "helloWorld");
  assert.equal(kebabCase("helloWorld"), "hello-world");
});

test("既存の util の関数", () => {
  assert.equal(foldSpecialLatin("Straße"), "Strasse");
  assert.equal(isNil(null), true);
  assert.equal(isNil(0), false);
  assert.equal(collapseWhitespace(" a  b "), "a b");
  assert.equal(formatNumber(1234567), "1,234,567");
});

test("articlePath から使える", () => {
  assert.equal(articlePath(1, "Café au lait"), "/articles/1/cafe-au-lait");
  assert.equal(articlePath(2, "日本語"), "/articles/2");
});

test("tagPath から使える", () => {
  assert.equal(tagPath("Hello World"), "/tags/hello-world");
  assert.equal(tagPath("日本語"), "/tags");
});

test("withTrailingSlash は既存のまま", () => {
  assert.equal(withTrailingSlash("/a"), "/a/");
  assert.equal(withTrailingSlash("/a/"), "/a/");
});

test("記号だけの入力と区切り文字", () => {
  assert.equal(slugify("!!!", { separator: "." }), "");
  assert.equal(slugify("A & B", { separator: "." }), "a.b");
});

test("maxLength がちょうどの長さならそのまま", () => {
  assert.equal(slugify("hello", { maxLength: 5 }), "hello");
  assert.equal(slugify("hello", { maxLength: 6 }), "hello");
});

test("区切りが連続しても1つ", () => {
  assert.equal(slugify("a--b__c", { separator: "." }), "a.b.c");
  assert.equal(slugify("-a-", { separator: "." }), "a");
});

test("maxLength と区切りの境界", () => {
  assert.equal(slugify("a  b", { maxLength: 3, separator: "_" }), "a_b");
  assert.equal(slugify("a  b", { maxLength: 2, separator: "_" }), "a");
});

test("英数字の組み合わせ", () => {
  assert.equal(slugify("A1 B2"), "a1-b2");
  assert.equal(slugify("foo.bar", { separator: "_" }), "foo_bar");
});

test("アクセント付きの大文字を残す", () => {
  assert.equal(slugify("École Normale", { lowercase: false }), "Ecole-Normale");
});

test("ポルトガル語とフランス語のアクセント", () => {
  assert.equal(slugify("São Paulo"), "sao-paulo");
  assert.equal(slugify("Ça va"), "ca-va");
  assert.equal(slugify("İstanbul"), "istanbul");
});

test("1文字の特殊文字", () => {
  assert.equal(slugify("ß"), "ss");
  assert.equal(slugify("Ø"), "o");
});

test("区切りだけの入力", () => {
  assert.equal(slugify("__"), "");
  assert.equal(slugify("--"), "");
  assert.equal(slugify("..", { separator: "." }), "");
});

test("maxLength 1 でも区切りを残さない", () => {
  assert.equal(slugify("hello world", { maxLength: 1 }), "h");
  assert.equal(slugify("hello world", { maxLength: 2 }), "he");
});

test("isNil は undefined も見る", () => {
  assert.equal(isNil(undefined), true);
  assert.equal(isNil(""), false);
});
