import { discountAmount, normalizeRate } from "./discount.js";
import { lineAmount, roundYen } from "./money.js";

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
  const subtotal = items.reduce((sum, item) => sum + lineAmount(item), 0);
  const rate = normalizeRate(invoice.discountRate ?? 0, "discountRate");
  const taxRate = normalizeRate(invoice.taxRate ?? 0, "taxRate");
  const discount = roundYen(discountAmount(subtotal, rate));
  const tax = roundYen((subtotal - discount) * taxRate);
  const total = subtotal - discount + tax;
  return { subtotal, discount, tax, total };
}
