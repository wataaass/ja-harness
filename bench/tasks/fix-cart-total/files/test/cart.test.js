import test from "node:test";
import assert from "node:assert/strict";
import {
  Cart,
  averageUnitPrice,
  cartTotal,
  cheapestItem,
  mergeItems,
  mostExpensiveItem,
  sortLines,
  subtotalOf,
  totalQuantity,
} from "../src/cart.js";
import {
  allocateDiscount,
  applyDiscounts,
  coupon,
  couponCodes,
  describeDiscount,
  discountAmount,
  discountedSubtotal,
  eligibleDiscounts,
  fixed,
  percentage,
  threshold,
  totalDiscount,
} from "../src/discount.js";
import {
  ROUNDING_MODES,
  allocate,
  applyRate,
  average,
  ceilToUnit,
  floorToUnit,
  formatRate,
  roundToMinor,
  roundToUnit,
  roundWithMode,
  splitEvenly,
  sum,
  sumWhere,
} from "../src/money.js";
import {
  BASE_SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
  amountUntilFreeShipping,
  deliveryDays,
  isFreeShipping,
  methodMultiplier,
  prefectures,
  regionOf,
  shippingFee,
  shippingMethods,
  shippingQuote,
} from "../src/shipping.js";
import {
  DEFAULT_TAX_RATE,
  REDUCED_TAX_RATE,
  amountWithoutTax,
  calculateMixedTax,
  calculateTax,
  formatTaxRate,
  isReducedCategory,
  rateForCategory,
  summarizeTax,
  taxBreakdown,
  taxIncluded,
  totalWithTax,
  validateRate,
} from "../src/tax.js";
import {
  formatApprox,
  formatCartSummary,
  formatDiscountLine,
  formatItemsTable,
  formatLine,
  formatNumber,
  formatPercent,
  formatReceipt,
  formatSummaryFields,
  formatYen,
} from "../src/format.js";

const items = [
  { sku: "A", name: "ノート", unitPrice: 1200, quantity: 2 },
  { sku: "B", name: "ペン", unitPrice: 350, quantity: 3 },
];

for (let amount = 0; amount <= 120; amount += 1) {
  test(`税額（標準税率）${amount}円`, () => {
    assert.equal(calculateTax(amount), Math.floor(amount * 0.1));
  });
}

for (let amount = 1; amount <= 60; amount += 1) {
  test(`税額（軽減税率）${amount * 7}円`, () => {
    assert.equal(calculateTax(amount * 7, REDUCED_TAX_RATE), Math.floor(amount * 7 * 0.08));
  });
}

for (let amount = 0; amount <= 40; amount += 1) {
  test(`税込合計 ${amount * 11}円`, () => {
    const base = amount * 11;
    assert.equal(totalWithTax(base), base + Math.floor(base * 0.1));
  });
}

for (let amount = 0; amount <= 35; amount += 1) {
  test(`税込から税抜 ${amount * 13}円`, () => {
    const gross = amount * 13;
    assert.equal(amountWithoutTax(gross), Math.floor(gross / 1.1));
  });
}

for (let amount = 1; amount <= 30; amount += 1) {
  test(`税込に含まれる税 ${amount * 17}円`, () => {
    const gross = amount * 17;
    assert.equal(taxIncluded(gross), gross - Math.floor(gross / 1.1));
  });
}

for (let amount = 0; amount <= 30; amount += 1) {
  test(`割引額（10%）${amount * 105}円`, () => {
    assert.equal(discountAmount(amount * 105, percentage(0.1)), Math.round(amount * 105 * 0.1));
  });
}

for (let amount = 0; amount <= 20; amount += 1) {
  test(`割引額（固定）${amount * 50}円`, () => {
    assert.equal(discountAmount(amount * 50, fixed(300)), Math.min(amount * 50, 300));
  });
}

for (let amount = 0; amount <= 20; amount += 1) {
  test(`割引額（しきい値）${amount * 250}円`, () => {
    const base = amount * 250;
    assert.equal(
      discountAmount(base, threshold(3000, 400)),
      base >= 3000 ? Math.min(base, 400) : 0,
    );
  });
}

for (let amount = 0; amount <= 25; amount += 1) {
  test(`割引の直列適用 ${amount * 200}円`, () => {
    const result = applyDiscounts(amount * 200, [fixed(100), percentage(0.05)]);
    assert.ok(result.discountedSubtotal >= 0);
    assert.equal(result.discountTotal + result.discountedSubtotal, amount * 200);
  });
}

for (let amount = 0; amount <= 30; amount += 1) {
  test(`円の整形 ${amount * 1234}円`, () => {
    const text = formatYen(amount * 1234);
    assert.ok(text.startsWith("¥"));
    assert.equal(text, `¥${(amount * 1234).toLocaleString("ja-JP")}`);
  });
}

for (let value = 0; value <= 30; value += 1) {
  test(`数値の整形 ${value * 1001}`, () => {
    assert.equal(formatNumber(value * 1001), (value * 1001).toLocaleString("ja-JP"));
  });
}

for (let amount = 0; amount <= 30; amount += 1) {
  test(`送料（通常・東京）${amount * 150}円`, () => {
    const expected = amount * 150 >= FREE_SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING_FEE;
    assert.equal(shippingFee({ merchandiseTotal: amount * 150 }), expected);
  });
}

for (let amount = 0; amount <= 25; amount += 1) {
  test(`送料無料までの残額 ${amount * 200}円`, () => {
    assert.equal(
      amountUntilFreeShipping({ merchandiseTotal: amount * 200 }),
      Math.max(0, FREE_SHIPPING_THRESHOLD - amount * 200),
    );
  });
}

for (let amount = 0; amount <= 20; amount += 1) {
  test(`割引後の残額 ${amount * 300}円`, () => {
    assert.equal(
      applyDiscounts(amount * 300, [fixed(50)]).discountedSubtotal,
      Math.max(0, amount * 300 - Math.min(amount * 300, 50)),
    );
  });
}

for (let amount = 0; amount <= 20; amount += 1) {
  test(`割引なしの合計 ${amount * 100}円`, () => {
    const result = applyDiscounts(amount * 100, []);
    assert.equal(result.discountTotal, 0);
    assert.equal(result.discountedSubtotal, amount * 100);
  });
}

test("割引の説明", () => {
  assert.equal(describeDiscount(percentage(0.1)), "10%オフ");
  assert.equal(describeDiscount(fixed(500)), "500円引き");
  assert.equal(describeDiscount(threshold(5000, 500)), "5000円以上で500円引き");
  assert.equal(describeDiscount(coupon("SAVE10")), "10%オフ");
});

test("クーポンの一覧", () => {
  assert.deepEqual(couponCodes(), ["MINUS500", "SAVE10", "SAVE20", "SHIP500"]);
});

test("適用できる割引だけを選ぶ", () => {
  assert.equal(eligibleDiscounts(2500, [threshold(3000, 500), fixed(100)]).length, 1);
});

test("割引の合計と割引後金額", () => {
  assert.equal(totalDiscount(3450, [percentage(0.1)]), 345);
  assert.equal(discountedSubtotal(3450, [percentage(0.1)]), 3105);
});

test("割引額の端数は四捨五入する", () => {
  assert.equal(discountAmount(1999, percentage(0.1)), 200);
  assert.equal(discountAmount(105, percentage(0.1)), 11);
  assert.equal(discountAmount(104, percentage(0.1)), 10);
});

test("複数の割引を順番にかける", () => {
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

test("税率の検証", () => {
  assert.equal(validateRate(0.1), 0.1);
  assert.throws(() => validateRate(-0.1), RangeError);
  assert.throws(() => validateRate(1.1), RangeError);
});

test("税率の表示", () => {
  assert.equal(formatTaxRate(DEFAULT_TAX_RATE), "10%");
  assert.equal(formatTaxRate(REDUCED_TAX_RATE), "8%");
});

test("軽減税率の区分", () => {
  assert.equal(isReducedCategory("food"), true);
  assert.equal(isReducedCategory("newspaper"), true);
  assert.equal(isReducedCategory("standard"), false);
  assert.equal(rateForCategory("food"), REDUCED_TAX_RATE);
  assert.equal(rateForCategory("toy"), DEFAULT_TAX_RATE);
});

test("税率ごとの内訳", () => {
  const breakdown = taxBreakdown(1050, REDUCED_TAX_RATE);
  assert.equal(breakdown.tax, 84);
  assert.equal(breakdown.total, 1134);
});

test("混合税率の合計", () => {
  const mixed = calculateMixedTax([
    { amount: 1000, reduced: false },
    { amount: 1000, reduced: true },
  ]);
  assert.equal(mixed.standard, 100);
  assert.equal(mixed.reduced, 80);
  assert.equal(mixed.total, 180);
});

test("税のまとめ", () => {
  const summary = summarizeTax([
    { rate: 0.1, taxable: 1000 },
    { rate: 0.1, taxable: 500 },
    { rate: 0.08, taxable: 1000 },
  ]);
  assert.equal(summary.length, 2);
  const standard = summary.find((entry) => entry.rate === 0.1);
  const reduced = summary.find((entry) => entry.rate === 0.08);
  assert.equal(standard.tax, 150);
  assert.equal(reduced.tax, 80);
});

test("割引後の金額に税をかける", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  assert.equal(cart.subtotal, 3450);
  assert.equal(cart.discountTotal, 345);
  assert.equal(cart.taxableAmount, 3105);
  assert.equal(cart.tax, 310);
  assert.equal(cart.total, 3915);
});

test("固定額の割引のあとの課税対象額", () => {
  const cart = Cart.from(items, { discounts: [fixed(500)] });
  assert.equal(cart.taxableAmount, 2950);
});

test("割引がなければ小計に税をかける", () => {
  const cart = Cart.from(items);
  assert.equal(cart.taxableAmount, 3450);
  assert.equal(cart.tax, 345);
  assert.equal(cart.total, 4295);
});

test("クーポンの適用と削除", () => {
  const cart = Cart.from(items);
  assert.equal(cart.applyCoupon("SAVE20"), "20%オフ");
  assert.equal(cart.discountTotal, 690);
  assert.equal(cart.removeCoupon("save20"), true);
  assert.equal(cart.discountTotal, 0);
});

test("明細の追加と更新", () => {
  const cart = new Cart();
  cart.addItem({ sku: "A", name: "ノート", unitPrice: 1200, quantity: 2 });
  cart.addItem({ sku: "A", unitPrice: 1200, quantity: 1 });
  assert.equal(cart.quantityOf("A"), 3);
  assert.equal(cart.lineCount, 1);
  assert.equal(cart.updateQuantity("A", 5), true);
  assert.equal(cart.itemCount, 5);
  assert.equal(cart.updatePrice("A", 1000), true);
  assert.equal(cart.lineTotal("A"), 5000);
});

test("明細の削除とクリア", () => {
  const cart = Cart.from(items);
  assert.equal(cart.removeItem("A"), true);
  assert.equal(cart.removeItem("A"), false);
  cart.clear();
  assert.equal(cart.empty(), true);
  assert.equal(cart.itemCount, 0);
});

test("カートの複製", () => {
  const cart = Cart.from(items, { discounts: [percentage(0.1)] });
  const copy = cart.clone();
  copy.addItem({ sku: "C", unitPrice: 100, quantity: 1 });
  assert.equal(cart.lineCount, 2);
  assert.equal(copy.lineCount, 3);
});

test("合計の関数", () => {
  assert.equal(subtotalOf(items), 3450);
  assert.equal(totalQuantity(items), 5);
  assert.equal(averageUnitPrice(items), 690);
  assert.equal(cartTotal(items), 3450 + 345 + 500);
});

test("商品の並べ替え", () => {
  assert.equal(sortLines(items, "price")[0].sku, "A");
  assert.equal(sortLines(items, "quantity")[0].sku, "B");
  assert.equal(sortLines(items, "name")[0].sku, "A");
});

test("もっとも安い・高い商品", () => {
  assert.equal(cheapestItem(items).sku, "B");
  assert.equal(mostExpensiveItem(items).sku, "A");
  assert.equal(cheapestItem([]), null);
});

test("商品のまとめ", () => {
  const merged = mergeItems([
    { sku: "A", unitPrice: 100, quantity: 1 },
    { sku: "B", unitPrice: 200, quantity: 2 },
    { sku: "A", unitPrice: 100, quantity: 4 },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].quantity, 5);
});

test("まとめの文字列", () => {
  const cart = Cart.from(items);
  assert.equal(
    formatCartSummary(cart.summary()),
    "小計 ¥3,450\n税 ¥345\n送料 ¥500\n合計 ¥4,295",
  );
});

test("レシートの整形", () => {
  const cart = Cart.from(items);
  assert.equal(
    formatReceipt(cart.summary(), { title: "レシート" }),
    [
      "レシート",
      "ノート x2 ¥2,400",
      "ペン x3 ¥1,050",
      "---",
      "小計 ¥3,450",
      "税 ¥345",
      "送料 ¥500",
      "合計 ¥4,295",
    ].join("\n"),
  );
});

test("明細の表", () => {
  const table = formatItemsTable(items);
  assert.equal(table.split("\n").length, 3);
  assert.equal(formatLine(items[0]), "ノート\t2\t¥1,200\t¥2,400");
});

test("割引の表示", () => {
  assert.equal(formatDiscountLine({ label: "10%オフ", amount: 345 }), "10%オフ: -¥345");
  assert.equal(formatApprox(1000), "約¥1,000");
  assert.equal(formatPercent(0.1), "10%");
});

test("まとめの項目", () => {
  const cart = Cart.from(items);
  const fields = formatSummaryFields(cart.summary());
  assert.equal(fields.subtotal, "¥3,450");
  assert.equal(fields.tax, "¥345");
  assert.equal(fields.total, "¥4,295");
});

for (let index = 0; index < ROUNDING_MODES.length; index += 1) {
  const mode = ROUNDING_MODES[index];
  test(`丸めの種類 ${mode}`, () => {
    assert.equal(typeof roundWithMode(1234.5, mode), "number");
  });
}

for (let amount = 0; amount <= 20; amount += 1) {
  test(`整数への丸め ${amount * 105 + 4}`, () => {
    assert.equal(roundWithMode(amount * 105 + 4, "half-up"), amount * 105 + 4);
  });
}

for (let count = 1; count <= 15; count += 1) {
  test(`均等割り ${count}人`, () => {
    const parts = splitEvenly(1000, count);
    assert.equal(sum(parts), 1000);
    assert.equal(parts.length, count);
  });
}

for (let count = 1; count <= 15; count += 1) {
  test(`按分の合計 ${count}口`, () => {
    const parts = allocate(500, new Array(count).fill(1));
    assert.equal(sum(parts), 500);
  });
}

for (let amount = 0; amount <= 20; amount += 1) {
  test(`割合の適用 ${amount * 250}円`, () => {
    assert.equal(applyRate(amount * 250, 0.08), Math.round(amount * 250 * 0.08));
  });
}

for (let amount = 0; amount <= 15; amount += 1) {
  test(`平均 ${amount * 200}円`, () => {
    assert.equal(average([amount * 200]), amount * 200);
  });
}

for (let amount = 0; amount <= 15; amount += 1) {
  test(`条件つき合計 ${amount * 100}円`, () => {
    assert.equal(sumWhere([amount * 100, 50, 150], (value) => value >= 100), amount * 100 + 150);
  });
}

for (let amount = 0; amount <= 15; amount += 1) {
  test(`単位で切り上げ ${amount * 37}円`, () => {
    assert.equal(ceilToUnit(amount * 37, 10), Math.ceil((amount * 37) / 10) * 10);
  });
}

for (let amount = 0; amount <= 15; amount += 1) {
  test(`単位で切り捨て ${amount * 37}円`, () => {
    assert.equal(floorToUnit(amount * 37, 10), Math.floor((amount * 37) / 10) * 10);
  });
}

for (let amount = 0; amount <= 15; amount += 1) {
  test(`単位で四捨五入 ${amount * 37}円`, () => {
    assert.equal(roundToUnit(amount * 37, 10), Math.round((amount * 37) / 10) * 10);
  });
}

for (let amount = 0; amount <= 20; amount += 1) {
  test(`最小単位への丸め ${amount * 3}円`, () => {
    assert.equal(roundToMinor(amount * 3, "JPY"), amount * 3);
  });
}

for (let amount = 0; amount <= 10; amount += 1) {
  test(`割合の表示 ${amount * 5}%`, () => {
    assert.equal(formatRate(amount / 20), `${amount * 5}%`);
  });
}

for (const prefecture of prefectures()) {
  test(`地域の判定 ${prefecture}`, () => {
    const region = regionOf(prefecture);
    assert.equal(typeof region, "string");
    assert.ok(region.length > 0);
  });
}

for (const method of shippingMethods()) {
  test(`配送方法 ${method.id}`, () => {
    assert.equal(typeof methodMultiplier(method.id), "number");
    assert.equal(deliveryDays(method.id), method.days);
  });
}

test("送料の見積もり", () => {
  const quote = shippingQuote({ merchandiseTotal: 4000, prefecture: "沖縄県" });
  assert.equal(quote.shipping, 1500);
  assert.equal(quote.total, 5500);
});

test("店頭受け取りは送料無料", () => {
  assert.equal(shippingFee({ merchandiseTotal: 1000, method: "pickup" }), 0);
  assert.equal(isFreeShipping({ merchandiseTotal: 1000, method: "pickup" }), true);
});

test("割引額の配分（等分）", () => {
  assert.deepEqual(allocateDiscount(300, [1000, 1000, 1000]), [100, 100, 100]);
});
