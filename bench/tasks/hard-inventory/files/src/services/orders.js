/**
 * 注文の受付。
 *
 * 明細を作り、在庫を引き当て、金額と送料を出す。
 * 在庫の引き当てに失敗したら、注文は保存しない。
 */

import { createOrder, lineFromProduct, orderWeight } from "../models.js";
import { calculateTotals } from "../pricing.js";
import { shippingFee } from "../shipping.js";

/**
 * 明細と割引率から金額を出す。
 *
 * @param {{lines: Array<{unitPrice: number, quantity: number, taxCategory: string}>, discountRate: number}} order
 * @returns {ReturnType<typeof calculateTotals>}
 */
export function totalsForOrder(order) {
  return calculateTotals(order.lines, { discountRate: order.discountRate });
}

/**
 * 注文の金額と送料をまとめる。
 *
 * @param {{lines: Array<{unitPrice: number, quantity: number, taxCategory: string, weightKg: number}>, discountRate: number}} order
 * @returns {{
 *   totals: ReturnType<typeof calculateTotals>,
 *   shipping: number,
 *   grandTotal: number,
 * }}
 */
export function quoteOrder(order) {
  const totals = totalsForOrder(order);
  const shipping = shippingFee(orderWeight(order));
  return { totals, shipping, grandTotal: totals.total + shipping };
}

/**
 * 注文を受け付ける。
 */
export class OrderService {
  /**
   * @param {{
   *   products: {require: (id: string) => object},
   *   orders: {add: Function},
   *   inventory: {reserve: Function, release: Function},
   *   nextId?: () => string,
   *   now?: () => Date,
   * }} options
   */
  constructor(options) {
    this.products = options.products;
    this.orders = options.orders;
    this.inventory = options.inventory;
    this.nextId = options.nextId ?? (() => `order-${Date.now()}`);
    this.now = options.now ?? (() => new Date());
  }

  /**
   * 明細を作る。
   *
   * @param {Array<{productId: string, quantity: number}>} items
   * @returns {Array<ReturnType<typeof lineFromProduct>>}
   */
  buildLines(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new TypeError("注文には1つ以上の商品が必要です");
    }
    return items.map((item) => {
      const product = this.products.require(item.productId);
      return lineFromProduct(product, item.quantity);
    });
  }

  /**
   * 注文を作って在庫を引き当てる。
   *
   * @param {{
   *   customerId: string,
   *   items: Array<{productId: string, quantity: number}>,
   *   discountRate?: number,
   * }} input
   * @returns {{order: object, totals: object, shipping: number, grandTotal: number}}
   */
  place(input) {
    const lines = this.buildLines(input.items);
    const order = createOrder({
      id: this.nextId(),
      customerId: input.customerId,
      lines,
      placedAt: this.now(),
      discountRate: input.discountRate ?? 0,
    });
    this.inventory.reserve(lines);
    const quote = quoteOrder(order);
    this.orders.add(order);
    return { order, ...quote };
  }

  /**
   * 注文を取り消し、在庫を戻す。
   *
   * @param {{lines: Array<{productId: string, quantity: number}>, status: string}} order
   * @returns {object}
   */
  cancel(order) {
    if (order.status === "cancelled") {
      return order;
    }
    this.inventory.release(order.lines);
    order.status = "cancelled";
    return order;
  }

  /**
   * 注文の金額を出し直す。割引率を変えて試すときに使う。
   *
   * @param {{lines: Array<object>, discountRate: number}} order
   * @param {number} discountRate
   * @returns {ReturnType<typeof quoteOrder>}
   */
  requote(order, discountRate) {
    return quoteOrder({ ...order, discountRate });
  }
}

/**
 * 商品と数量の配列から、金額だけを出す。
 *
 * @param {{
 *   products: {require: (id: string) => object},
 *   items: Array<{productId: string, quantity: number}>,
 *   discountRate?: number,
 * }} input
 * @returns {ReturnType<typeof quoteOrder>}
 */
export function priceItems(input) {
  const lines = input.items.map((item) => {
    const product = input.products.require(item.productId);
    return lineFromProduct(product, item.quantity);
  });
  const order = {
    lines,
    discountRate: input.discountRate ?? 0,
  };
  return quoteOrder(order);
}
