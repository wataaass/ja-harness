import test from "node:test";
import assert from "node:assert/strict";
import { calculateInvoice } from "../src/invoice.js";

test("割引は小計の割合で引く", () => {
  const result = calculateInvoice({
    items: [{ quantity: 1, unitPrice: 1000 }],
    discountRate: 0.1,
    taxRate: 0.1,
  });
  assert.deepEqual(result, {
    subtotal: 1000,
    discount: 100,
    tax: 90,
    total: 990,
  });
});

test("税は割引後の額にかける", () => {
  const result = calculateInvoice({
    items: [{ quantity: 2, unitPrice: 500 }],
    discountRate: 0.2,
    taxRate: 0.1,
  });
  assert.equal(result.discount, 200);
  assert.equal(result.tax, 80);
  assert.equal(result.total, 880);
});

test("1円未満は切り捨てる", () => {
  const result = calculateInvoice({
    items: [{ quantity: 1, unitPrice: 10.5 }],
    taxRate: 0.1,
  });
  assert.equal(result.subtotal, 10);
  assert.equal(result.tax, 1);
  assert.equal(result.total, 11);
});

test("入力を変更しない", () => {
  const invoice = {
    items: [{ quantity: 1, unitPrice: 1000 }],
    discountRate: 0.1,
    taxRate: 0.1,
  };
  const before = JSON.stringify(invoice);
  calculateInvoice(invoice);
  assert.equal(JSON.stringify(invoice), before);
});
