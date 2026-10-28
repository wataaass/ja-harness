import test from "node:test";
import assert from "node:assert/strict";
import { calculateTotals, priceLine } from "../src/pricing.js";

test("割引がなければ小計に税を足す", () => {
  const totals = calculateTotals([
    { unitPrice: 1000, quantity: 2, taxCategory: "standard" },
  ]);
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.discount, 0);
  assert.equal(totals.tax, 200);
  assert.equal(totals.total, 2200);
});

test("割引は税抜きの小計に掛け、税は割引後に掛ける", () => {
  const line = priceLine(
    { unitPrice: 1050, quantity: 1, taxCategory: "reduced" },
    0.15,
  );
  assert.equal(line.subtotal, 1050);
  assert.equal(line.discount, 158);
  assert.equal(line.taxable, 892);
  assert.equal(line.tax, 71);
  assert.equal(line.total, 963);
});

test("税の区分ごとに税率が変わる", () => {
  const totals = calculateTotals([
    { unitPrice: 1000, quantity: 1, taxCategory: "standard" },
    { unitPrice: 1000, quantity: 1, taxCategory: "reduced" },
    { unitPrice: 1000, quantity: 1, taxCategory: "exempt" },
  ]);
  assert.equal(totals.tax, 180);
  assert.equal(totals.total, 3180);
});

test("明細の合計を足し合わせる", () => {
  const totals = calculateTotals([
    { unitPrice: 500, quantity: 2, taxCategory: "reduced" },
    { unitPrice: 1000, quantity: 1, taxCategory: "standard" },
  ]);
  assert.equal(totals.quantity, 3);
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.tax, 180);
  assert.equal(totals.total, 2180);
});
