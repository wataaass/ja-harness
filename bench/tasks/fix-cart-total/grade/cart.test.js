import test from "node:test";
import assert from "node:assert/strict";
import { Cart, cartTotal } from "../src/cart.js";
import {
  applyDiscounts,
  coupon,
  describeDiscount,
  discountAmount,
  fixed,
  percentage,
  threshold,
} from "../src/discount.js";
import { calculateTax, totalWithTax } from "../src/tax.js";
import { formatReceipt, formatSummary, formatYen } from "../src/format.js";

const items = [
  { sku: "A", name: "ノート", unitPrice: 1200, quantity: 2 },
  { sku: "B", name: "ペン", unitPrice: 350, quantity: 3 },
];

test("税は1円未満を切り捨てる", () => {
  assert.equal(calculateTax(1999), 199);
  assert.equal(calculateTax(999), 99);
  assert.equal(calculateTax(105), 10);
  assert.equal(calculateTax(1), 0);
  assert.equal(calculateTax(0), 0);
  assert.equal(calculateTax(1000), 100);
  assert.equal(calculateTax(3105), 310);
});

test("軽減税率でも切り捨てる", () => {
  assert.equal(calculateTax(999, 0.08), 79);
  assert.equal(calculateTax(1050, 0.08), 84);
});

test("税込合計も切り捨てに合わせる", () => {
  assert.equal(totalWithTax(1999), 2198);
  assert.equal(totalWithTax(999), 1098);
  assert.equal(totalWithTax(1050, 0.08), 1134);
});

test("割引額の端数は四捨五入する", () => {
  assert.equal(discountAmount(1999, percentage(0.1)), 200);
  assert.equal(discountAmount(105, percentage(0.1)), 11);
  assert.equal(discountAmount(104, percentage(0.1)), 10);
});

test("割引を順番にかける", () => {
  const result = applyDiscounts(3450, [fixed(500), percentage(0.1)]);
  assert.equal(result.discountTotal, 795);
  assert.equal(result.discountedSubtotal, 2655);
  assert.deepEqual(
    result.applied.map((entry) => entry.amount),
    [500, 295],
  );
});

test("割引は小計を超えない", () => {
  const result = applyDiscounts(300, [fixed(500), percentage(0.2)]);
  assert.equal(result.discountTotal, 300);
  assert.equal(result.discountedSubtotal, 0);
});

test("クーポンとしきい値", () => {
  assert.equal(applyDiscounts(3450, [coupon("SAVE20")]).discountTotal, 690);
  assert.equal(applyDiscounts(3450, [threshold(3000, 500)]).discountTotal, 500);
  assert.equal(applyDiscounts(2999, [threshold(3000, 500)]).discountTotal, 0);
});

test("割引の説明", () => {
  assert.equal(describeDiscount(percentage(0.1)), "10%オフ");
  assert.equal(describeDiscount(fixed(500)), "500円引き");
  assert.equal(describeDiscount(threshold(5000, 500)), "5000円以上で500円引き");
  assert.equal(describeDiscount(coupon("SAVE10")), "10%オフ");
});

test("割引後の金額に税をかける", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  assert.equal(cart.subtotal, 3450);
  assert.equal(cart.discountTotal, 345);
  assert.equal(cart.taxableAmount, 3105);
  assert.equal(cart.tax, 310);
  assert.equal(cart.total, 3415);
});

test("固定額の割引のあとに税をかける", () => {
  const cart = Cart.from(items, { discounts: [fixed(500)] });
  assert.equal(cart.discountTotal, 500);
  assert.equal(cart.taxableAmount, 2950);
  assert.equal(cart.tax, 295);
  assert.equal(cart.total, 3245);
});

test("複数の割引のあとに税をかける", () => {
  const cart = Cart.from(items, { discounts: [fixed(500), percentage(0.1)] });
  assert.equal(cart.discountTotal, 795);
  assert.equal(cart.taxableAmount, 2655);
  assert.equal(cart.tax, 265);
  assert.equal(cart.total, 2920);
});

test("クーポンのあとに税をかける", () => {
  const cart = Cart.from(items);
  cart.applyCoupon("SAVE20");
  assert.equal(cart.discountTotal, 690);
  assert.equal(cart.taxableAmount, 2760);
  assert.equal(cart.tax, 276);
  assert.equal(cart.total, 3036);
});

test("割引がなければ小計に税をかける", () => {
  const cart = Cart.from(items);
  assert.equal(cart.taxableAmount, 3450);
  assert.equal(cart.tax, 345);
  assert.equal(cart.total, 3795);
});

test("端数が残る場合の合計", () => {
  const cart = Cart.from(
    [{ sku: "X", unitPrice: 1050, quantity: 1 }],
    { discounts: [percentage(0.1)] },
  );
  assert.equal(cart.discountTotal, 105);
  assert.equal(cart.taxableAmount, 945);
  assert.equal(cart.tax, 94);
  assert.equal(cart.total, 1039);
});

test("空のカートの合計", () => {
  const cart = new Cart();
  assert.equal(cart.tax, 0);
  assert.equal(cart.total, 0);
  assert.equal(cartTotal([]), 0);
});

test("まとめとレシート", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  const summary = cart.summary();
  assert.equal(
    formatSummary(summary),
    "小計 ¥3,450\n割引 -¥345\n税 ¥310\n合計 ¥3,415",
  );
  assert.equal(
    formatReceipt(summary, { title: "レシート" }),
    [
      "レシート",
      "ノート x2 ¥2,400",
      "ペン x3 ¥1,050",
      "---",
      "小計 ¥3,450",
      "10%オフ: -¥345",
      "税 ¥310",
      "合計 ¥3,415",
    ].join("\n"),
  );
});

test("数量変更で合計が変わる", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  cart.updateQuantity("A", 1);
  assert.equal(cart.subtotal, 2250);
  assert.equal(cart.discountTotal, 225);
  assert.equal(cart.tax, 202);
  assert.equal(cart.total, 2227);
});

test("金額の整形", () => {
  assert.equal(formatYen(1234567), "¥1,234,567");
  assert.equal(formatYen(-500), "-¥500");
  assert.equal(formatYen(12.6), "¥13");
});
