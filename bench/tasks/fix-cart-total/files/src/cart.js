import { applyDiscounts, describeDiscount, roundYen } from "./discount.js";
import { calculateTax, DEFAULT_TAX_RATE, validateRate } from "./tax.js";
import { formatCartSummary, formatReceipt, formatYen } from "./format.js";

function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    throw new TypeError("item must be an object");
  }
  const sku = String(item.sku ?? "");
  if (sku === "") throw new RangeError("sku is required");
  const unitPrice = Number(item.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new RangeError("unitPrice must be a non-negative number");
  }
  const quantity = Number(item.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError("quantity must be a positive integer");
  }
  return {
    sku,
    name: item.name ?? sku,
    unitPrice,
    quantity,
    category: item.category ?? "standard",
  };
}

export class Cart {
  constructor(options = {}) {
    this.taxRate = validateRate(options.taxRate ?? DEFAULT_TAX_RATE);
    this.discounts = [...(options.discounts ?? [])];
    this.coupons = [];
    this.lines = [];
  }

  get items() {
    return this.lines.map((line) => ({ ...line }));
  }

  get lineCount() {
    return this.lines.length;
  }

  get itemCount() {
    return this.lines.reduce((total, line) => total + line.quantity, 0);
  }

  get subtotal() {
    return this.lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  }

  get activeDiscounts() {
    return [...this.discounts, ...this.coupons];
  }

  get discountResult() {
    return applyDiscounts(this.subtotal, this.activeDiscounts);
  }

  get discountTotal() {
    return this.discountResult.discountTotal;
  }

  get taxableAmount() {
    return this.discountResult.discountedSubtotal;
  }

  get tax() {
    return calculateTax(this.subtotal, this.taxRate);
  }

  get total() {
    return this.subtotal + this.tax - this.discountTotal;
  }

  addItem(item) {
    const normalized = normalizeItem(item);
    const existing = this.lines.find((line) => line.sku === normalized.sku);
    if (existing) {
      existing.quantity += normalized.quantity;
      return { ...existing };
    }
    this.lines.push(normalized);
    return { ...normalized };
  }

  addItems(items = []) {
    return items.map((item) => this.addItem(item));
  }

  removeItem(sku) {
    const index = this.lines.findIndex((line) => line.sku === sku);
    if (index === -1) return false;
    this.lines.splice(index, 1);
    return true;
  }

  updateQuantity(sku, quantity) {
    const line = this.lines.find((entry) => entry.sku === sku);
    if (!line) return false;
    if (quantity <= 0) return this.removeItem(sku);
    if (!Number.isInteger(quantity)) throw new RangeError("quantity must be an integer");
    line.quantity = quantity;
    return true;
  }

  clear() {
    this.lines = [];
    this.coupons = [];
  }

  addDiscount(discount) {
    this.discounts.push(discount);
  }

  applyCoupon(code) {
    const discount = { type: "coupon", code: String(code).toUpperCase() };
    this.coupons.push(discount);
    return describeDiscount(discount);
  }

  removeCoupon(code) {
    const normalized = String(code).toUpperCase();
    const before = this.coupons.length;
    this.coupons = this.coupons.filter((coupon) => coupon.code !== normalized);
    return this.coupons.length !== before;
  }

  lineTotal(sku) {
    const line = this.lines.find((entry) => entry.sku === sku);
    if (!line) return 0;
    return line.unitPrice * line.quantity;
  }

  quantityOf(sku) {
    const line = this.lines.find((entry) => entry.sku === sku);
    return line ? line.quantity : 0;
  }

  hasItem(sku) {
    return this.lines.some((line) => line.sku === sku);
  }

  summary() {
    const discountResult = this.discountResult;
    return {
      items: this.items,
      applied: discountResult.applied,
      subtotal: this.subtotal,
      discountTotal: discountResult.discountTotal,
      taxableAmount: this.taxableAmount,
      tax: this.tax,
      total: this.total,
      itemCount: this.itemCount,
      lineCount: this.lineCount,
      taxRate: this.taxRate,
    };
  }

  receipt(options = {}) {
    return formatReceipt(this.summary(), options);
  }

  description() {
    return formatCartSummary(this.summary());
  }

  empty() {
    return this.lines.length === 0;
  }

  clone() {
    const copy = new Cart({ taxRate: this.taxRate, discounts: this.discounts });
    copy.lines = this.items;
    copy.coupons = [...this.coupons];
    return copy;
  }

  static from(items, options = {}) {
    const cart = new Cart(options);
    cart.addItems(items);
    return cart;
  }
}

export function subtotalOf(items) {
  return items.reduce((total, item) => total + Number(item.unitPrice) * Number(item.quantity), 0);
}

export function cartTotal(items, options = {}) {
  const cart = Cart.from(items, options);
  return cart.total;
}

export function discountedSubtotalOf(items, discounts = []) {
  return applyDiscounts(subtotalOf(items), discounts).discountedSubtotal;
}

export function taxOf(items, rate = DEFAULT_TAX_RATE) {
  return calculateTax(subtotalOf(items), rate);
}

export function roundedAmount(value) {
  return roundYen(value);
}

export function itemLabel(item) {
  return `${item.name ?? item.sku} x${item.quantity} ${formatYen(item.unitPrice * item.quantity)}`;
}

export function mergeItems(items) {
  const merged = new Map();
  for (const item of items) {
    const normalized = normalizeItem(item);
    const existing = merged.get(normalized.sku);
    if (existing) {
      existing.quantity += normalized.quantity;
    } else {
      merged.set(normalized.sku, normalized);
    }
  }
  return [...merged.values()];
}
