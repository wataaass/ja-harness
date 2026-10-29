/**
 * 注文・在庫・出荷で使う値と、その検査。
 *
 * このファイルは計算を持たない。入力の形をそろえ、おかしな値を
 * 早い段階でエラーにすることだけを担当する。
 */

export const ORDER_STATUSES = Object.freeze([
  "draft",
  "placed",
  "paid",
  "shipped",
  "cancelled",
]);

export const DEFAULT_STATUS = "placed";

/**
 * 入力の誤りを表す。呼び出し側はメッセージだけを画面に出せばよい。
 */
export class ValidationError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * 文字列であることを確かめる。
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {string}
 */
export function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${name} は空でない文字列です`);
  }
  return value.trim();
}

/**
 * 0 以上の整数であることを確かめる。
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function requireNonNegativeInteger(value, name) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${name} は0以上の整数です`);
  }
  return value;
}

/**
 * 1 以上の整数であることを確かめる。
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function requirePositiveInteger(value, name) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ValidationError(`${name} は1以上の整数です`);
  }
  return value;
}

/**
 * 0 以上の有限の数であることを確かめる。
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function requireNonNegativeNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${name} は0以上の数です`);
  }
  return value;
}

/**
 * 割合（0 以上 1 以下）であることを確かめる。
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function requireRate(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ValidationError(`${name} は0から1の数です`);
  }
  return value;
}

/**
 * 日時を Date にそろえる。
 *
 * @param {Date|string|number} value
 * @param {string} name
 * @returns {Date}
 */
export function requireDate(value, name) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${name} は日時です`);
  }
  return date;
}

/**
 * 商品を作る。
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   unitPrice: number,
 *   weightKg?: number,
 *   taxCategory?: string,
 *   stock?: number,
 * }} input
 * @returns {{id: string, name: string, unitPrice: number, weightKg: number, taxCategory: string, stock: number}}
 */
export function createProduct(input) {
  return {
    id: requireString(input.id, "商品の id"),
    name: requireString(input.name, "商品の名前"),
    unitPrice: requirePositiveInteger(input.unitPrice, "商品の単価"),
    weightKg: requireNonNegativeNumber(input.weightKg ?? 0, "商品の重さ"),
    taxCategory: requireString(input.taxCategory ?? "standard", "税の区分"),
    stock: requireNonNegativeInteger(input.stock ?? 0, "在庫"),
  };
}

/**
 * 注文の明細を作る。単価と重さは商品から写した値を持つ。
 *
 * @param {{
 *   productId: string,
 *   quantity: number,
 *   unitPrice: number,
 *   weightKg?: number,
 *   taxCategory?: string,
 * }} input
 * @returns {{
 *   productId: string,
 *   quantity: number,
 *   unitPrice: number,
 *   weightKg: number,
 *   taxCategory: string,
 * }}
 */
export function createOrderLine(input) {
  return {
    productId: requireString(input.productId, "明細の商品 id"),
    quantity: requirePositiveInteger(input.quantity, "明細の数量"),
    unitPrice: requirePositiveInteger(input.unitPrice, "明細の単価"),
    weightKg: requireNonNegativeNumber(input.weightKg ?? 0, "明細の重さ"),
    taxCategory: requireString(input.taxCategory ?? "standard", "明細の税の区分"),
  };
}

/**
 * 商品と数量から明細を作る。
 *
 * @param {{id: string, unitPrice: number, weightKg: number, taxCategory: string}} product
 * @param {number} quantity
 * @returns {ReturnType<typeof createOrderLine>}
 */
export function lineFromProduct(product, quantity) {
  return createOrderLine({
    productId: product.id,
    quantity,
    unitPrice: product.unitPrice,
    weightKg: product.weightKg,
    taxCategory: product.taxCategory,
  });
}

/**
 * 注文を作る。合計はまだ入れない。
 *
 * @param {{
 *   id: string,
 *   customerId: string,
 *   lines: Array<ReturnType<typeof createOrderLine>>,
 *   placedAt?: Date|string|number,
 *   status?: string,
 *   discountRate?: number,
 * }} input
 * @returns {{
 *   id: string,
 *   customerId: string,
 *   lines: Array<ReturnType<typeof createOrderLine>>,
 *   placedAt: Date,
 *   status: string,
 *   discountRate: number,
 * }}
 */
export function createOrder(input) {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new ValidationError("注文には1つ以上の明細が必要です");
  }
  const status = input.status ?? DEFAULT_STATUS;
  if (!ORDER_STATUSES.includes(status)) {
    throw new ValidationError(`知らない注文の状態です: ${status}`);
  }
  return {
    id: requireString(input.id, "注文の id"),
    customerId: requireString(input.customerId, "顧客の id"),
    lines: input.lines.map((line) => createOrderLine(line)),
    placedAt: requireDate(input.placedAt ?? new Date(), "注文日時"),
    status,
    discountRate: requireRate(input.discountRate ?? 0, "割引率"),
  };
}

/**
 * 明細の小計（単価 × 数量）。円未満は四捨五入する。
 *
 * @param {{unitPrice: number, quantity: number}} line
 * @returns {number}
 */
export function lineSubtotal(line) {
  return Math.round(line.unitPrice * line.quantity);
}

/**
 * 注文の合計の重さ。
 *
 * @param {{lines: Array<{weightKg: number, quantity: number}>}} order
 * @returns {number}
 */
export function orderWeight(order) {
  let total = 0;
  for (const line of order.lines) {
    total += line.weightKg * line.quantity;
  }
  return Math.round(total * 1000) / 1000;
}

/**
 * 注文の数量の合計。
 *
 * @param {{lines: Array<{quantity: number}>}} order
 * @returns {number}
 */
export function orderQuantity(order) {
  return order.lines.reduce((total, line) => total + line.quantity, 0);
}

/**
 * 明細を商品 id ごとの数量にまとめる。
 *
 * @param {Array<{productId: string, quantity: number}>} lines
 * @returns {Map<string, number>}
 */
export function quantitiesByProduct(lines) {
  const quantities = new Map();
  for (const line of lines) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }
  return quantities;
}

/**
 * 注文を短い文にする。
 *
 * @param {{id: string, lines: unknown[], status: string}} order
 * @returns {string}
 */
export function describeOrder(order) {
  return `${order.id} ${order.status} ${order.lines.length}明細`;
}

/**
 * 税の区分の表示名。
 */
export const TAX_CATEGORY_LABELS = Object.freeze({
  standard: "標準税率",
  reduced: "軽減税率",
  exempt: "非課税",
});

/**
 * 税の区分の表示名を返す。
 *
 * @param {string} category
 * @returns {string}
 */
export function taxCategoryLabel(category) {
  return TAX_CATEGORY_LABELS[category] ?? category;
}

/**
 * 注文の状態の表示名。
 */
export const ORDER_STATUS_LABELS = Object.freeze({
  draft: "下書き",
  placed: "受付済み",
  paid: "支払済み",
  shipped: "発送済み",
  cancelled: "取り消し",
});

/**
 * 注文の状態の表示名を返す。
 *
 * @param {string} status
 * @returns {string}
 */
export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

/**
 * 金額を「1,234 円」の形にする。桁区切りだけを入れる。
 *
 * @param {number} value
 * @returns {string}
 */
export function formatYen(value) {
  if (!Number.isFinite(value)) {
    throw new ValidationError("金額は有限の数です");
  }
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped} 円`;
}

/**
 * 重さを kg の表示にする。小数は3桁まで。
 *
 * @param {number} weightKg
 * @returns {string}
 */
export function formatWeight(weightKg) {
  const value = requireNonNegativeNumber(weightKg, "重さ");
  return `${Math.round(value * 1000) / 1000} kg`;
}

/**
 * 明細の一覧を、数量と小計の合計でまとめる。
 *
 * @param {Array<{quantity: number, unitPrice: number}>} lines
 * @returns {{lines: number, quantity: number, subtotal: number}}
 */
export function summarizeLines(lines) {
  let quantity = 0;
  let subtotal = 0;
  for (const line of lines) {
    quantity += line.quantity;
    subtotal += lineSubtotal(line);
  }
  return { lines: lines.length, quantity, subtotal };
}

/**
 * 注文の明細が正しい形か確かめる。
 *
 * @param {unknown} lines
 * @returns {boolean}
 */
export function validateOrderLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new ValidationError("注文には1つ以上の明細が必要です");
  }
  for (const line of lines) {
    createOrderLine(line);
  }
  return true;
}

/**
 * 注文を1行の短い文にする。一覧の画面で使う。
 *
 * @param {{id: string, customerId: string, placedAt: Date, status: string, lines: Array<{quantity: number}>}} order
 * @returns {string}
 */
export function orderLineText(order) {
  return `${order.id} ${order.customerId} ${orderStatusLabel(order.status)} ${order.lines.length}明細`;
}
