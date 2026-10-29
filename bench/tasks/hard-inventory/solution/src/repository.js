/**
 * 商品と注文の保管場所。
 *
 * 実物ではデータベースになる部分を、ここでは Map で置き換える。
 * ページ送りは、一覧の画面と API の両方から使う。
 */

import { createOrder, createProduct, ValidationError } from "./models.js";

/**
 * 見つからないときのエラー。
 */
export class NotFoundError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * 商品の保管場所。
 */
export class ProductRepository {
  /**
   * @param {Array<ReturnType<typeof createProduct>>} [products]
   */
  constructor(products = []) {
    this.items = new Map();
    for (const product of products) {
      this.add(product);
    }
  }

  /**
   * 商品を足す。同じ id があればエラー。
   *
   * @param {Parameters<typeof createProduct>[0]} product
   * @returns {ReturnType<typeof createProduct>}
   */
  add(product) {
    const normalized = createProduct(product);
    if (this.items.has(normalized.id)) {
      throw new ValidationError(`商品 id が重複しています: ${normalized.id}`);
    }
    this.items.set(normalized.id, normalized);
    return normalized;
  }

  /**
   * 商品を返す。なければ undefined。
   *
   * @param {string} id
   * @returns {ReturnType<typeof createProduct>|undefined}
   */
  get(id) {
    return this.items.get(id);
  }

  /**
   * 商品を返す。なければエラー。
   *
   * @param {string} id
   * @returns {ReturnType<typeof createProduct>}
   */
  require(id) {
    const product = this.items.get(id);
    if (product === undefined) {
      throw new NotFoundError(`商品がありません: ${id}`);
    }
    return product;
  }

  /**
   * すべての商品を入れた順で返す。
   *
   * @returns {Array<ReturnType<typeof createProduct>>}
   */
  all() {
    return [...this.items.values()];
  }

  /**
   * 条件に合う商品を返す。
   *
   * @param {(product: ReturnType<typeof createProduct>) => boolean} predicate
   * @returns {Array<ReturnType<typeof createProduct>>}
   */
  find(predicate) {
    return this.all().filter(predicate);
  }

  /**
   * 商品を書き換える。
   *
   * @param {string} id
   * @param {Partial<ReturnType<typeof createProduct>>} patch
   * @returns {ReturnType<typeof createProduct>}
   */
  update(id, patch) {
    const current = this.require(id);
    const next = createProduct({ ...current, ...patch, id: current.id });
    this.items.set(id, next);
    return next;
  }

  /**
   * 商品を消す。
   *
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    return this.items.delete(id);
  }

  /**
   * 件数。
   *
   * @returns {number}
   */
  get size() {
    return this.items.size;
  }
}

/**
 * 注文の保管場所。
 */
export class OrderRepository {
  /**
   * @param {Array<Parameters<typeof createOrder>[0]>} [orders]
   */
  constructor(orders = []) {
    this.items = new Map();
    for (const order of orders) {
      this.add(order);
    }
  }

  /**
   * 注文を足す。
   *
   * @param {Parameters<typeof createOrder>[0]} order
   * @returns {ReturnType<typeof createOrder>}
   */
  add(order) {
    const normalized = createOrder(order);
    if (this.items.has(normalized.id)) {
      throw new ValidationError(`注文 id が重複しています: ${normalized.id}`);
    }
    this.items.set(normalized.id, normalized);
    return normalized;
  }

  /**
   * 注文を返す。なければ undefined。
   *
   * @param {string} id
   * @returns {ReturnType<typeof createOrder>|undefined}
   */
  get(id) {
    return this.items.get(id);
  }

  /**
   * 注文を返す。なければエラー。
   *
   * @param {string} id
   * @returns {ReturnType<typeof createOrder>}
   */
  require(id) {
    const order = this.items.get(id);
    if (order === undefined) {
      throw new NotFoundError(`注文がありません: ${id}`);
    }
    return order;
  }

  /**
   * すべての注文を入れた順で返す。
   *
   * @returns {Array<ReturnType<typeof createOrder>>}
   */
  all() {
    return [...this.items.values()];
  }

  /**
   * 条件に合う注文を返す。
   *
   * @param {(order: ReturnType<typeof createOrder>) => boolean} predicate
   * @returns {Array<ReturnType<typeof createOrder>>}
   */
  find(predicate) {
    return this.all().filter(predicate);
  }

  /**
   * 注文の状態を変える。
   *
   * @param {string} id
   * @param {string} status
   * @returns {ReturnType<typeof createOrder>}
   */
  setStatus(id, status) {
    const current = this.require(id);
    const next = createOrder({ ...current, status });
    this.items.set(id, next);
    return next;
  }

  /**
   * 件数。
   *
   * @returns {number}
   */
  get size() {
    return this.items.size;
  }
}

/**
 * ページ送りの指定がおかしいときのエラー。
 */
export class PaginationError extends RangeError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "PaginationError";
  }
}

/**
 * 配列をページに分ける。最後のページは、端数があっても必ず含める。
 *
 * @template T
 * @param {T[]} items
 * @param {{page?: number, pageSize?: number}} [options]
 * @returns {{
 *   items: T[],
 *   page: number,
 *   pageSize: number,
 *   total: number,
 *   totalPages: number,
 *   hasNext: boolean,
 *   hasPrevious: boolean,
 * }}
 */
export function paginate(items, options = {}) {
  if (!Array.isArray(items)) {
    throw new TypeError("items は配列です");
  }
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  if (!Number.isInteger(page) || page < 1) {
    throw new PaginationError("page は1以上の整数です");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new PaginationError("pageSize は1以上の整数です");
  }

  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const pageItems = page <= totalPages ? items.slice(start, start + pageSize) : [];

  return {
    items: pageItems,
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * すべてのページを順に返す。確認と CSV の書き出しで使う。
 *
 * @template T
 * @param {T[]} items
 * @param {number} pageSize
 * @returns {T[][]}
 */
export function allPages(items, pageSize) {
  const pages = [];
  for (let page = 1; ; page += 1) {
    const result = paginate(items, { page, pageSize });
    if (result.items.length > 0) {
      pages.push(result.items);
    }
    if (!result.hasNext) {
      break;
    }
  }
  return pages;
}

/**
 * ページの見出しを返す。
 *
 * @param {{page: number, totalPages: number, total: number}} result
 * @returns {string}
 */
export function describePage(result) {
  return `${result.page} / ${result.totalPages} ページ（${result.total} 件）`;
}

/**
 * 商品を指定の項目で並べ替える。元の配列は変えない。
 *
 * @param {Array<{id: string, name: string, unitPrice: number, stock: number}>} products
 * @param {"id"|"name"|"unitPrice"|"stock"} [key]
 * @returns {Array<object>}
 */
export function sortProducts(products, key = "id") {
  const allowed = new Set(["id", "name", "unitPrice", "stock"]);
  if (!allowed.has(key)) {
    throw new TypeError(`並べ替えの項目が不正です: ${key}`);
  }
  return [...products].sort((left, right) => {
    const a = left[key];
    const b = right[key];
    if (typeof a === "string" && typeof b === "string") {
      return a.localeCompare(b);
    }
    return Number(a) - Number(b);
  });
}

/**
 * 商品名か id に文字を含む商品を返す。大文字と小文字は区別しない。
 *
 * @param {Array<{id: string, name: string}>} products
 * @param {string} query
 * @returns {Array<object>}
 */
export function searchProducts(products, query) {
  const needle = String(query).trim().toLowerCase();
  if (needle === "") {
    return [...products];
  }
  return products.filter(
    (product) =>
      product.id.toLowerCase().includes(needle) ||
      product.name.toLowerCase().includes(needle),
  );
}

/**
 * 全体の件数からページ数を返す。端数は1ページとして数える。
 *
 * @param {number} total
 * @param {number} pageSize
 * @returns {number}
 */
export function pageCountFor(total, pageSize) {
  if (!Number.isInteger(total) || total < 0) {
    throw new PaginationError("total は0以上の整数です");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new PaginationError("pageSize は1以上の整数です");
  }
  return Math.ceil(total / pageSize);
}

/**
 * ページの最初と最後の位置を返す。最後は含まない。
 *
 * @param {number} page
 * @param {number} pageSize
 * @returns {{start: number, end: number}}
 */
export function pageBounds(page, pageSize) {
  if (!Number.isInteger(page) || page < 1) {
    throw new PaginationError("page は1以上の整数です");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new PaginationError("pageSize は1以上の整数です");
  }
  const start = (page - 1) * pageSize;
  return { start, end: start + pageSize };
}
