import test from "node:test";
import assert from "node:assert/strict";
import { calculateInvoice } from "../src/invoice.js";
import { lineAmount, roundYen } from "../src/money.js";
import { discountAmount } from "../src/discount.js";

test("割引額は小計の割合", () => {
  assert.equal(discountAmount(1000, 0.1), 100);
  assert.equal(discountAmount(2500, 0.2), 500);
  assert.equal(discountAmount(1200, 0), 0);
});

test("税は割引後の額にかける", () => {
  assert.deepEqual(
    calculateInvoice({
      items: [{ quantity: 2, unitPrice: 500 }],
      discountRate: 0.1,
      taxRate: 0.1,
    }),
    { subtotal: 1000, discount: 100, tax: 90, total: 990 },
  );
  assert.deepEqual(
    calculateInvoice({
      items: [{ quantity: 1, unitPrice: 1000 }],
      discountRate: 0.25,
      taxRate: 0.08,
    }),
    { subtotal: 1000, discount: 250, tax: 60, total: 810 },
  );
});

test("roundYen は四捨五入", () => {
  assert.equal(roundYen(10.4), 10);
  assert.equal(roundYen(10.5), 11);
  assert.equal(roundYen(10.9), 11);
});

test("明細ごとに丸める", () => {
  assert.equal(lineAmount({ quantity: 1, unitPrice: 10.4 }), 10);
  assert.equal(lineAmount({ quantity: 3, unitPrice: 1.5 }), 5);
  assert.deepEqual(
    calculateInvoice({
      items: [
        { quantity: 1, unitPrice: 10.4 },
        { quantity: 1, unitPrice: 10.4 },
      ],
      discountRate: 0.1,
      taxRate: 0.1,
    }),
    { subtotal: 20, discount: 2, tax: 2, total: 20 },
  );
});

test("合計してから丸めるのとは違う", () => {
  const result = calculateInvoice({
    items: [
      { quantity: 1, unitPrice: 10.4 },
      { quantity: 1, unitPrice: 10.4 },
    ],
  });
  assert.equal(result.subtotal, 20);
});

test("単価の端数も明細ごとに四捨五入", () => {
  const result = calculateInvoice({
    items: [{ quantity: 1, unitPrice: 10.5 }],
    taxRate: 0.1,
  });
  assert.deepEqual(result, {
    subtotal: 11,
    discount: 0,
    tax: 1,
    total: 12,
  });
});

test("割引と税の端数も四捨五入", () => {
  const result = calculateInvoice({
    items: [{ quantity: 1, unitPrice: 101 }],
    discountRate: 0.1,
    taxRate: 0.05,
  });
  assert.deepEqual(result, {
    subtotal: 101,
    discount: 10,
    tax: 5,
    total: 96,
  });
});

test("明細が空なら0", () => {
  assert.deepEqual(calculateInvoice({ items: [], taxRate: 0.1 }), {
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  });
});

test("入力を変更しない", () => {
  const invoice = {
    items: [
      { quantity: 1, unitPrice: 10.4 },
      { quantity: 2, unitPrice: 3.3 },
    ],
    discountRate: 0.15,
    taxRate: 0.1,
  };
  const before = JSON.stringify(invoice);
  calculateInvoice(invoice);
  assert.equal(JSON.stringify(invoice), before);
});

test("税率と割引率の検証", () => {
  assert.throws(
    () => calculateInvoice({ items: [], taxRate: 2 }),
    RangeError,
  );
  assert.throws(
    () => calculateInvoice({ items: [], taxRate: 2 }),
    /taxRate/,
  );
  assert.throws(
    () => calculateInvoice({ items: [], discountRate: -1 }),
    /discountRate/,
  );
  assert.throws(
    () => calculateInvoice({ items: [], discountRate: "0.1" }),
    /discountRate/,
  );
});

test("明細の検証", () => {
  assert.throws(() => calculateInvoice({ items: "x" }), /items/);
  assert.throws(
    () => calculateInvoice({ items: [{ quantity: "1", unitPrice: 10 }] }),
    /quantity/,
  );
  assert.throws(
    () => calculateInvoice({ items: [{ quantity: 1, unitPrice: Number.NaN }] }),
    /unitPrice/,
  );
});
