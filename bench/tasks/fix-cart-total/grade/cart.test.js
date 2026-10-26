import test from "node:test";
import assert from "node:assert/strict";
import { Cart } from "../src/cart.js";
import { allocateDiscount, applyDiscounts, fixed, percentage, threshold } from "../src/discount.js";
import { allocate, splitEvenly } from "../src/money.js";
import {
  FREE_SHIPPING_THRESHOLD,
  amountUntilFreeShipping,
  shippingFee,
  shippingQuote,
} from "../src/shipping.js";
import { calculateTax } from "../src/tax.js";

const items = [
  { sku: "A", name: "ノート", unitPrice: 1200, quantity: 2 },
  { sku: "B", name: "ペン", unitPrice: 350, quantity: 3 },
];

test("税は割引後の課税対象額にかかる", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  assert.equal(cart.taxableAmount, 3105);
  assert.equal(cart.tax, 310);
});

test("固定額の割引でも税は割引後にかかる", () => {
  const cart = Cart.from(items, { discounts: [fixed(500)] });
  assert.equal(cart.taxableAmount, 2950);
  assert.equal(cart.tax, 295);
});

test("割引が重なっても税は最後の課税対象額にかかる", () => {
  const cart = Cart.from(items, { discounts: [fixed(500), percentage(0.1)] });
  assert.equal(cart.taxableAmount, 2655);
  assert.equal(cart.tax, 265);
});

test("クーポンでも税は割引後にかかる", () => {
  const cart = Cart.from(items);
  cart.applyCoupon("SAVE20");
  assert.equal(cart.taxableAmount, 2760);
  assert.equal(cart.tax, 276);
});

test("割引がなければ税は小計にかかる", () => {
  const cart = Cart.from(items);
  assert.equal(cart.tax, calculateTax(3450));
});

test("送料無料は割引後の商品金額で判定する", () => {
  assert.equal(
    shippingFee({ merchandiseTotal: 5250, discountTotal: 525 }),
    500,
  );
  assert.equal(
    shippingFee({ merchandiseTotal: 5250, discountTotal: 250 }),
    0,
  );
});

test("割引後の金額がちょうどしきい値なら送料無料", () => {
  assert.equal(
    shippingFee({ merchandiseTotal: 5600, discountTotal: 600 }),
    0,
  );
  assert.equal(
    shippingFee({ merchandiseTotal: 5599, discountTotal: 600 }),
    500,
  );
});

test("割引前の金額だけを見て無料にしない", () => {
  const quote = shippingQuote({
    merchandiseTotal: 5200,
    discountTotal: 520,
    prefecture: "東京都",
  });
  assert.equal(quote.shipping, 500);
  assert.equal(quote.freeShipping, false);
  assert.equal(quote.total, 5180);
});

test("送料無料までの残額も割引後で数える", () => {
  assert.equal(
    amountUntilFreeShipping({ merchandiseTotal: 5250, discountTotal: 250 }),
    0,
  );
  assert.equal(
    amountUntilFreeShipping({ merchandiseTotal: 5250, discountTotal: 100 }),
    0,
  );
  assert.equal(
    amountUntilFreeShipping({ merchandiseTotal: 4000, discountTotal: 500 }),
    1500,
  );
});

test("無料しきい値は 5000 円", () => {
  assert.equal(FREE_SHIPPING_THRESHOLD, 5000);
  assert.equal(shippingFee({ merchandiseTotal: 5000 }), 0);
  assert.equal(shippingFee({ merchandiseTotal: 4999 }), 500);
});

test("割引額の按分は小数部の大きい順に配る", () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocate(5, [1, 1, 1]), [2, 2, 1]);
  assert.deepEqual(allocate(10, [1, 2, 3]), [2, 3, 5]);
});

test("按分の合計は元の金額と一致する", () => {
  const samples = [
    [100, [1, 1, 1]],
    [501, [3, 5, 7]],
    [999, [1, 2, 4, 8]],
    [7, [1, 1, 1, 1, 1]],
  ];
  for (const [amount, weights] of samples) {
    const parts = allocate(amount, weights);
    assert.equal(
      parts.reduce((total, value) => total + value, 0),
      amount,
    );
  }
});

test("小数部が同じなら前の要素を優先する", () => {
  assert.deepEqual(allocate(10, [1, 1, 1, 1, 1, 1]), [2, 2, 2, 2, 1, 1]);
  assert.deepEqual(splitEvenly(10, 4), [3, 3, 2, 2]);
});

test("重みが 0 の要素には配らない", () => {
  assert.deepEqual(allocate(100, [1, 0, 1]), [50, 0, 50]);
});

test("割引の按分も同じ規則で配る", () => {
  assert.deepEqual(allocateDiscount(100, [1000, 1000, 1000]), [34, 33, 33]);
  assert.deepEqual(allocateDiscount(10, [100, 200, 300]), [2, 3, 5]);
});

test("カートの明細ごとの割引も合計が一致する", () => {
  const cart = Cart.from(
    [
      { sku: "A", unitPrice: 1000, quantity: 1 },
      { sku: "B", unitPrice: 1000, quantity: 1 },
      { sku: "C", unitPrice: 1000, quantity: 1 },
    ],
    { discounts: [fixed(100)] },
  );
  assert.deepEqual(cart.lineDiscounts(), [34, 33, 33]);
  assert.equal(
    cart.lineDiscounts().reduce((total, value) => total + value, 0),
    cart.discountTotal,
  );
});

test("按分した税抜金額から明細ごとの税を出す", () => {
  const cart = Cart.from(
    [
      { sku: "A", unitPrice: 1001, quantity: 1 },
      { sku: "B", unitPrice: 1000, quantity: 1 },
    ],
    { discounts: [fixed(1)] },
  );
  const taxable = cart.lineTaxableAmounts();
  assert.equal(taxable.reduce((total, value) => total + value, 0), cart.taxableAmount);
  const taxes = cart.lineTaxes();
  assert.equal(taxes.length, 2);
});

test("通常の割引計算は変わらない", () => {
  const result = applyDiscounts(3450, [fixed(500), percentage(0.1)]);
  assert.equal(result.discountTotal, 795);
  assert.equal(result.discountedSubtotal, 2655);
});

test("しきい値ちょうどでも割引が適用される", () => {
  assert.equal(applyDiscounts(3000, [threshold(3000, 500)]).discountTotal, 500);
});
