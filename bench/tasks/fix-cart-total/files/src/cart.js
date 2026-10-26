import {
  allocateDiscount,
  applyDiscounts,
  coupon,
  couponCodes,
  describeDiscount,
  fixed,
  percentage,
  threshold,
} from "./discount.js";
import { formatCartSummary, formatReceipt, formatYen } from "./format.js";
import { allocate, roundWithMode, splitEvenly, sum } from "./money.js";
import { shippingFee } from "./shipping.js";
import { calculateTax, DEFAULT_TAX_RATE, validateRate } from "./tax.js";

function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    throw new TypeError("item must be an object");
  }
  const sku = String(item.sku ?? "");
  if (sku === "") {
    throw new RangeError("sku is required");
  }
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
    unitPrice: Math.trunc(unitPrice),
    quantity,
    category: item.category ?? "standard",
  };
}

/**
 * 買い物カート。
 *
 * 金額は円の整数で扱う。税は割引後の課税対象額に対して計算し、
 * 1 円未満は切り捨てる。送料は割引後の商品金額で無料判定する。
 */
export class Cart {
  /**
   * @param {{taxRate?: number, discounts?: object[], prefecture?: string, method?: string}} [options]
   */
  constructor(options = {}) {
    this.taxRate = validateRate(options.taxRate ?? DEFAULT_TAX_RATE);
    this.discounts = [...(options.discounts ?? [])];
    this.coupons = [];
    this.lines = [];
    this.prefecture = options.prefecture ?? "東京都";
    this.method = options.method ?? "standard";
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

  /**
   * 税額。割引後の課税対象額に対して計算する。
   */
  get tax() {
    return calculateTax(this.subtotal, this.taxRate);
  }

  get shipping() {
    return shippingFee({
      merchandiseTotal: this.subtotal,
      discountTotal: this.discountTotal,
      prefecture: this.prefecture,
      method: this.method,
    });
  }

  get total() {
    return this.taxableAmount + this.tax + this.shipping;
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
    if (!Number.isInteger(quantity)) {
      throw new RangeError("quantity must be an integer");
    }
    line.quantity = quantity;
    return true;
  }

  updatePrice(sku, unitPrice) {
    const line = this.lines.find((entry) => entry.sku === sku);
    if (!line) return false;
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      throw new RangeError("unitPrice must be a non-negative number");
    }
    line.unitPrice = Math.trunc(price);
    return true;
  }

  clear() {
    this.lines = [];
    this.coupons = [];
  }

  addDiscount(discount) {
    this.discounts.push(discount);
    return describeDiscount(discount);
  }

  applyCoupon(code) {
    const discount = coupon(code);
    this.coupons.push({ ...discount });
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

  /**
   * 割引額を明細ごとに配分したものを返す。
   * 合計は discountTotal と一致する。
   * @returns {number[]}
   */
  lineDiscounts() {
    return allocateDiscount(
      this.discountTotal,
      this.lines.map((line) => line.unitPrice * line.quantity),
    );
  }

  /**
   * 明細ごとの税抜金額（割引後）を返す。
   * @returns {number[]}
   */
  lineTaxableAmounts() {
    const discounts = this.lineDiscounts();
    return this.lines.map((line, index) => line.unitPrice * line.quantity - discounts[index]);
  }

  /**
   * 明細ごとの税額を返す。税額は明細ごとに切り捨てる。
   * @returns {number[]}
   */
  lineTaxes() {
    return this.lineTaxableAmounts().map((amount) => calculateTax(Math.max(0, amount), this.taxRate));
  }

  /**
   * まとめの情報を返す。
   */
  summary() {
    const discountResult = this.discountResult;
    const tax = this.tax;
    return {
      items: this.items,
      applied: discountResult.applied,
      subtotal: this.subtotal,
      discountTotal: discountResult.discountTotal,
      taxableAmount: this.taxableAmount,
      tax,
      shipping: this.shipping,
      total: this.total,
      itemCount: this.itemCount,
      lineCount: this.lineCount,
      taxRate: this.taxRate,
      prefecture: this.prefecture,
      method: this.method,
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
    const copy = new Cart({
      taxRate: this.taxRate,
      discounts: this.discounts,
      prefecture: this.prefecture,
      method: this.method,
    });
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
  return items.reduce(
    (total, item) => total + Number(item.unitPrice) * Number(item.quantity),
    0,
  );
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
  return roundWithMode(value, "half-up", 0);
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

export function sortLines(lines, order = "added") {
  const copy = lines.map((line) => ({ ...line }));
  if (order === "price") {
    return copy.sort((left, right) => right.unitPrice - left.unitPrice);
  }
  if (order === "name") {
    return copy.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  }
  if (order === "quantity") {
    return copy.sort((left, right) => right.quantity - left.quantity);
  }
  return copy;
}

export function totalQuantity(items) {
  return items.reduce((total, item) => total + Number(item.quantity ?? 0), 0);
}

export function averageUnitPrice(items) {
  const quantity = totalQuantity(items);
  if (quantity === 0) return 0;
  return Math.round(subtotalOf(items) / quantity);
}

export function cheapestItem(items) {
  if (items.length === 0) return null;
  return items.reduce((best, item) =>
    Number(item.unitPrice) < Number(best.unitPrice) ? item : best,
  );
}

export function mostExpensiveItem(items) {
  if (items.length === 0) return null;
  return items.reduce((best, item) =>
    Number(item.unitPrice) > Number(best.unitPrice) ? item : best,
  );
}

export function splitDiscount(amount, count) {
  return splitEvenly(amount, count);
}

export function sumLines(lines) {
  return sum(lines.map((line) => Number(line.unitPrice) * Number(line.quantity)));
}
