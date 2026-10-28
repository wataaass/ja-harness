import test from "node:test";
import assert from "node:assert/strict";
import { shippingBreakdown, shippingFee } from "../src/shipping.js";

test("5kg 未満は 500 円", () => {
  assert.equal(shippingFee(0), 500);
  assert.equal(shippingFee(3.2), 500);
});

test("ちょうど 5kg は 500 円の段に入る", () => {
  assert.equal(shippingFee(5), 500);
  assert.equal(shippingFee(5.001), 800);
});

test("10kg と 20kg の区切りも以下で読む", () => {
  assert.equal(shippingFee(10), 800);
  assert.equal(shippingFee(20), 1200);
});

test("20kg を超えたら 5kg ごとに 100 円を足す", () => {
  assert.equal(shippingFee(20.1), 1300);
  assert.equal(shippingFee(25), 1300);
  assert.equal(shippingFee(25.1), 1400);
});

test("送料の内訳に段の名前を入れる", () => {
  const breakdown = shippingBreakdown(5);
  assert.equal(breakdown.fee, 500);
  assert.equal(breakdown.tier, "5kg以下");
});

test("負の重さはエラー", () => {
  assert.throws(() => shippingFee(-1), RangeError);
});
