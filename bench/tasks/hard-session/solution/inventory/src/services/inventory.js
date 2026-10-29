/**
 * 在庫の引き当て。
 *
 * 同じ商品が複数の明細に分かれていても、合計してから在庫と比べる。
 * 1行ずつ見ると、足りていないのに注文が通ってしまう。
 */

import { inventoryKey } from "../cache.js";
import {
  quantitiesByProduct,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from "../models.js";

/**
 * 在庫が足りないときのエラー。
 */
export class InsufficientStockError extends Error {
  /**
   * @param {string} productId
   * @param {number} requested
   * @param {number} available
   */
  constructor(productId, requested, available) {
    super(
      `在庫が足りません: ${productId}（必要 ${requested}、在庫 ${available}）`,
    );
    this.name = "InsufficientStockError";
    this.productId = productId;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * 在庫を見て、引き当てる。
 */
export class InventoryService {
  /**
   * @param {{
   *   products: {require: (id: string) => {id: string, stock: number}, all?: () => Array<{id: string, stock: number}>},
   *   cache?: {get: Function, set: Function, invalidateProduct: Function},
   * }} options
   */
  constructor(options) {
    this.products = options.products;
    this.cache = options.cache;
  }

  /**
   * 商品の今の在庫。キャッシュがあればそれを使う。
   *
   * @param {string} productId
   * @returns {number}
   */
  available(productId) {
    const product = this.products.require(productId);
    if (this.cache === undefined) {
      return product.stock;
    }
    const key = inventoryKey(productId);
    const cached = this.cache.get(key);
    if (typeof cached === "number") {
      return cached;
    }
    this.cache.set(key, product.stock);
    return product.stock;
  }

  /**
   * 在庫を書き換える。キャッシュも必ず消す。
   *
   * @param {string} productId
   * @param {number} stock
   * @returns {number}
   */
  updateStock(productId, stock) {
    const next = requireNonNegativeInteger(stock, "在庫");
    const product = this.products.require(productId);
    product.stock = next;
    this.cache?.invalidateProduct(productId);
    return next;
  }

  /**
   * 明細の分だけ在庫を引き当てる。
   *
   * 同じ商品の明細は合計し、すべての商品で足りることを確かめてから
   * まとめて減らす。途中で失敗しても在庫は変えない。
   *
   * @param {Array<{productId: string, quantity: number}>} lines
   * @returns {Map<string, number>} 引き当てた数量
   */
  reserve(lines) {
    if (!Array.isArray(lines)) {
      throw new TypeError("明細は配列です");
    }
    const quantities = quantitiesByProduct(lines);
    for (const line of lines) {
      requirePositiveInteger(line.quantity, "明細の数量");
    }

    for (const [productId, quantity] of quantities) {
      const available = this.available(productId);
      if (quantity > available) {
        throw new InsufficientStockError(productId, quantity, available);
      }
    }

    for (const [productId, quantity] of quantities) {
      this.updateStock(productId, this.available(productId) - quantity);
    }
    return quantities;
  }

  /**
   * 引き当てを戻す。
   *
   * @param {Array<{productId: string, quantity: number}>} lines
   * @returns {Map<string, number>}
   */
  release(lines) {
    if (!Array.isArray(lines)) {
      throw new TypeError("明細は配列です");
    }
    const quantities = quantitiesByProduct(lines);
    for (const line of lines) {
      requirePositiveInteger(line.quantity, "明細の数量");
    }
    for (const [productId, quantity] of quantities) {
      this.updateStock(productId, this.available(productId) + quantity);
    }
    return quantities;
  }

  /**
   * 在庫が少ない商品を返す。
   *
   * @param {number} [threshold]
   * @returns {Array<{id: string, stock: number}>}
   */
  lowStock(threshold = 5) {
    requireNonNegativeInteger(threshold, "しきい値");
    const all = this.products.all?.() ?? [];
    return all
      .filter((product) => product.stock <= threshold)
      .map((product) => ({ id: product.id, stock: product.stock }));
  }

  /**
   * 商品ごとの在庫を返す。
   *
   * @returns {Array<{id: string, stock: number}>}
   */
  snapshot() {
    const all = this.products.all?.() ?? [];
    return all.map((product) => ({ id: product.id, stock: product.stock }));
  }
}

/**
 * 明細を商品 id ごとの数量にまとめる。
 *
 * @param {Array<{productId: string, quantity: number}>} lines
 * @returns {Map<string, number>}
 */
export function requiredQuantities(lines) {
  return quantitiesByProduct(lines);
}

/**
 * 足りない商品だけを返す。注文の確認画面で使う。
 *
 * @param {{available: (id: string) => number}} inventory
 * @param {Array<{productId: string, quantity: number}>} lines
 * @returns {Array<{productId: string, requested: number, available: number}>}
 */
export function shortages(inventory, lines) {
  const quantities = quantitiesByProduct(lines);
  const result = [];
  for (const [productId, requested] of quantities) {
    const available = inventory.available(productId);
    if (requested > available) {
      result.push({ productId, requested, available });
    }
  }
  return result;
}
