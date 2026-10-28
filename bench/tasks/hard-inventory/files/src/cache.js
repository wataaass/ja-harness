/**
 * 在庫の問い合わせを短くするための、小さなメモリ上のキャッシュ。
 *
 * 在庫が変わったら、その商品の項目を必ず消す。消し忘れると
 * 古い在庫のまま注文を受け付けてしまう。
 */

/**
 * 在庫のキャッシュキー。商品 id だけをキーにしない。
 *
 * @param {string} productId
 * @returns {string}
 */
export function inventoryKey(productId) {
  if (typeof productId !== "string" || productId === "") {
    throw new TypeError("商品 id は空でない文字列です");
  }
  return `inventory:${productId}`;
}

/**
 * 期限付きの値を覚えておくキャッシュ。
 */
export class MemoryCache {
  /**
   * @param {{now?: () => number}} [options]
   */
  constructor(options = {}) {
    this.entries = new Map();
    this.now = options.now ?? Date.now;
  }

  /**
   * 値を返す。ない場合と期限切れの場合は undefined。
   *
   * @param {string} key
   * @returns {unknown}
   */
  get(key) {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt !== undefined && this.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * 値を入れる。ttlMs が 0 なら期限なし。
   *
   * @param {string} key
   * @param {unknown} value
   * @param {{ttlMs?: number}} [options]
   * @returns {MemoryCache}
   */
  set(key, value, options = {}) {
    if (typeof key !== "string" || key === "") {
      throw new TypeError("キーは空でない文字列です");
    }
    const ttlMs = options.ttlMs ?? 0;
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new RangeError("ttlMs は0以上の数です");
    }
    this.entries.set(key, {
      value,
      expiresAt: ttlMs === 0 ? undefined : this.now() + ttlMs,
    });
    return this;
  }

  /**
   * キーがあるか返す。期限切れは false。
   *
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * キーを消す。消せたら true。
   *
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    return this.entries.delete(key);
  }

  /**
   * すべて消す。
   *
   * @returns {MemoryCache}
   */
  clear() {
    this.entries.clear();
    return this;
  }

  /**
   * 今の件数。
   *
   * @returns {number}
   */
  get size() {
    return this.entries.size;
  }

  /**
   * キーの一覧。期限切れも含む。
   *
   * @returns {string[]}
   */
  keys() {
    return [...this.entries.keys()];
  }

  /**
   * 商品の在庫キャッシュを消す。
   *
   * @param {string} productId
   * @returns {boolean}
   */
  invalidateProduct(productId) {
    return this.delete(productId);
  }
}

/**
 * キャッシュのキーを前置きでまとめて消す。
 *
 * @param {MemoryCache} cache
 * @param {string} prefix
 * @returns {number}
 */
export function invalidatePrefix(cache, prefix) {
  let removed = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      if (cache.delete(key)) {
        removed += 1;
      }
    }
  }
  return removed;
}
