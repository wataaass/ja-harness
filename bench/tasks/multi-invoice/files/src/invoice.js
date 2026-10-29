import { discountAmount, normalizeRate } from "./discount.js";
import { roundYen } from "./money.js";

function checkItems(items) {
  if (!Array.isArray(items)) {
    throw new TypeError("items は配列にしてください");
  }
  for (const item of items) {
    if (
      item === null ||
      typeof item !== "object" ||
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      typeof item.unitPrice !== "number" ||
      !Number.isFinite(item.unitPrice)
    ) {
      throw new TypeError("明細の quantity と unitPrice は数にしてください");
    }
  }
}

export function calculateInvoice(invoice) {
  const items = invoice.items;
  checkItems(items);
  const rawSubtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const subtotal = roundYen(rawSubtotal);
  const rate = normalizeRate(invoice.discountRate ?? 0, "discountRate");
  const taxRate = normalizeRate(invoice.taxRate ?? 0, "taxRate");
  const discount = discountAmount(subtotal, rate);
  const tax = roundYen(subtotal * taxRate);
  const total = subtotal - discount + tax;
  return { subtotal, discount, tax, total };
}
