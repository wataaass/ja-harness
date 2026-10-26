import test from "node:test";
import assert from "node:assert/strict";
import { Cart, cartTotal, mergeItems, subtotalOf } from "../src/cart.js";
import {
  applyDiscounts,
  coupon,
  discountAmount,
  fixed,
  percentage,
  roundYen,
  threshold,
} from "../src/discount.js";
import { calculateTax, taxIncluded, totalWithTax } from "../src/tax.js";
import {
  formatDateTime,
  formatPercent,
  formatPhone,
  formatReceipt,
  formatSummary,
  formatYen,
} from "../src/format.js";

const items = [
  { sku: "A", name: "ノート", unitPrice: 1200, quantity: 2 },
  { sku: "B", name: "ペン", unitPrice: 350, quantity: 3 },
];

test("小計を出す", () => {
  const cart = Cart.from(items);
  assert.equal(cart.subtotal, 3450);
  assert.equal(cart.itemCount, 5);
  assert.equal(cart.lineCount, 2);
});

test("同じ商品を足すと数量が増える", () => {
  const cart = new Cart();
  cart.addItem({ sku: "A", unitPrice: 100, quantity: 1 });
  cart.addItem({ sku: "A", unitPrice: 100, quantity: 2 });
  assert.equal(cart.lineCount, 1);
  assert.equal(cart.quantityOf("A"), 3);
  assert.equal(cart.subtotal, 300);
});

test("数量の更新と削除", () => {
  const cart = Cart.from(items);
  assert.equal(cart.updateQuantity("A", 1), true);
  assert.equal(cart.quantityOf("A"), 1);
  assert.equal(cart.updateQuantity("A", 0), true);
  assert.equal(cart.hasItem("A"), false);
  assert.equal(cart.removeItem("B"), true);
  assert.equal(cart.empty(), true);
});

test("クリア", () => {
  const cart = Cart.from(items);
  cart.applyCoupon("SAVE10");
  cart.clear();
  assert.equal(cart.subtotal, 0);
  assert.equal(cart.discountTotal, 0);
});

test("割合の割引", () => {
  const result = applyDiscounts(1000, [percentage(0.1)]);
  assert.equal(result.discountTotal, 100);
  assert.equal(result.discountedSubtotal, 900);
});

test("固定額の割引は小計を超えない", () => {
  assert.equal(discountAmount(300, fixed(500)), 300);
  const result = applyDiscounts(300, [fixed(500)]);
  assert.equal(result.discountTotal, 300);
  assert.equal(result.discountedSubtotal, 0);
});

test("割引を順番にかける", () => {
  const result = applyDiscounts(1000, [fixed(500), percentage(0.1)]);
  assert.equal(result.discountTotal, 550);
  assert.equal(result.discountedSubtotal, 450);
});

test("しきい値の割引", () => {
  assert.equal(discountAmount(4000, threshold(5000, 500)), 0);
  assert.equal(discountAmount(5000, threshold(5000, 500)), 500);
});

test("クーポン", () => {
  const result = applyDiscounts(2000, [coupon("SAVE20")]);
  assert.equal(result.discountTotal, 400);
  assert.equal(result.discountedSubtotal, 1600);
});

test("割引額の端数は四捨五入", () => {
  assert.equal(roundYen(199.5), 200);
  assert.equal(applyDiscounts(1999, [percentage(0.1)]).discountTotal, 200);
});

test("税は切り捨て", () => {
  assert.equal(calculateTax(1000), 100);
  assert.equal(calculateTax(1999), 199);
  assert.equal(calculateTax(105), 10);
  assert.equal(calculateTax(999), 99);
});

test("税込み価格から税を出す", () => {
  assert.deepEqual(taxIncluded(1100), { gross: 1100, net: 1000, tax: 100, rate: 0.1 });
});

test("税込合計", () => {
  assert.equal(totalWithTax(1999), 2198);
});

test("割引後の金額に税をかける", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  assert.equal(cart.discountTotal, 345);
  assert.equal(cart.taxableAmount, 3105);
  assert.equal(cart.tax, 310);
});

test("割引後の合計", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  assert.equal(cart.total, 3415);
  assert.equal(cartTotal(items, { discounts: [percentage(0.1)] }), 3415);
});

test("クーポンを適用した合計", () => {
  const cart = Cart.from(items);
  cart.applyCoupon("SAVE10");
  assert.equal(cart.total, 3415);
});

test("空のカート", () => {
  const cart = new Cart();
  assert.equal(cart.subtotal, 0);
  assert.equal(cart.discountTotal, 0);
  assert.equal(cart.tax, 0);
  assert.equal(cart.total, 0);
  assert.equal(cart.empty(), true);
});

test("まとめの項目", () => {
  const cart = Cart.from([{ sku: "A", unitPrice: 1000, quantity: 1 }]);
  const summary = cart.summary();
  assert.equal(summary.subtotal, 1000);
  assert.equal(summary.tax, 100);
  assert.equal(summary.total, 1100);
  assert.equal(summary.lineCount, 1);
  assert.equal(summary.itemCount, 1);
});

test("金額の整形", () => {
  assert.equal(formatYen(1234), "¥1,234");
  assert.equal(formatYen(-500), "-¥500");
  assert.equal(formatYen(0), "¥0");
});

test("割合と電話番号の整形", () => {
  assert.equal(formatPercent(0.1), "10%");
  assert.equal(formatPhone("09012345678"), "090-1234-5678");
  assert.equal(formatPhone("0312345678"), "03-1234-5678");
});

test("レシートの整形", () => {
  const cart = Cart.from([
    { sku: "A", name: "ノート", unitPrice: 1000, quantity: 1 },
  ]);
  assert.equal(
    formatReceipt(cart.summary(), { title: "レシート" }),
    ["レシート", "ノート x1 ¥1,000", "---", "小計 ¥1,000", "税 ¥100", "合計 ¥1,100"].join("\n"),
  );
});

test("まとめの文字列", () => {
  const cart = Cart.from([{ sku: "A", unitPrice: 1000, quantity: 1 }]);
  assert.equal(formatSummary(cart.summary()), "小計 ¥1,000\n割引 -¥0\n税 ¥100\n合計 ¥1,100");
});

test("日時の整形", () => {
  assert.equal(formatDateTime(new Date(2024, 0, 2, 3, 4)), "2024/01/02 03:04");
});

test("小計と商品の結合", () => {
  assert.equal(subtotalOf(items), 3450);
  assert.deepEqual(mergeItems([...items, { sku: "A", unitPrice: 1200, quantity: 1 }]), [
    { sku: "A", name: "ノート", unitPrice: 1200, quantity: 3, category: "standard" },
    { sku: "B", name: "ペン", unitPrice: 350, quantity: 3, category: "standard" },
  ]);
});
