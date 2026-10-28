import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryCache,
  ProductRepository,
  InventoryService,
  InsufficientStockError,
  createProduct,
  calculateTotals,
  priceLine,
  shippingFee,
  paginate,
  allPages,
  jstDateKey,
  dailySales,
  monthlySales,
  inventoryKey,
} from "../src/index.js";

function product(id, stock, extra = {}) {
  return createProduct({
    id,
    name: id,
    unitPrice: 100,
    weightKg: 1,
    taxCategory: "standard",
    stock,
    ...extra,
  });
}

function setup(stock = 10) {
  const products = new ProductRepository([
    product("a", stock),
    product("b", stock),
  ]);
  const cache = new MemoryCache();
  const inventory = new InventoryService({ products, cache });
  return { products, cache, inventory };
}

test("在庫: 複数明細を合計して足りなければ失敗する", () => {
  const { products, inventory } = setup(10);
  assert.throws(
    () =>
      inventory.reserve([
        { productId: "a", quantity: 6 },
        { productId: "a", quantity: 5 },
      ]),
    InsufficientStockError,
  );
  assert.equal(products.require("a").stock, 10);
});

test("在庫: 合計が在庫と同じなら成功する", () => {
  const { products, inventory } = setup(10);
  inventory.reserve([
    { productId: "a", quantity: 4 },
    { productId: "a", quantity: 6 },
  ]);
  assert.equal(products.require("a").stock, 0);
});

test("在庫: 同じ商品の明細は合計して引く", () => {
  const { products, inventory } = setup(10);
  inventory.reserve([
    { productId: "a", quantity: 3 },
    { productId: "a", quantity: 4 },
  ]);
  assert.equal(products.require("a").stock, 3);
});

test("在庫: 1つでも足りなければどれも引かない", () => {
  const { products, inventory } = setup(10);
  assert.throws(() =>
    inventory.reserve([
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 11 },
    ]),
  );
  assert.equal(products.require("a").stock, 10);
  assert.equal(products.require("b").stock, 10);
});

test("在庫: 戻すときも合計して足す", () => {
  const { products, inventory } = setup(10);
  inventory.reserve([
    { productId: "a", quantity: 2 },
    { productId: "a", quantity: 3 },
  ]);
  inventory.release([
    { productId: "a", quantity: 1 },
    { productId: "a", quantity: 4 },
  ]);
  assert.equal(products.require("a").stock, 10);
});

test("在庫: 更新するとキャッシュの値も変わる", () => {
  const { inventory } = setup(10);
  assert.equal(inventory.available("a"), 10);
  inventory.updateStock("a", 4);
  assert.equal(inventory.available("a"), 4);
  inventory.reserve([{ productId: "a", quantity: 4 }]);
  assert.equal(inventory.available("a"), 0);
});

test("在庫: キャッシュのキーは商品ごとに分かれる", () => {
  assert.equal(inventoryKey("a"), "inventory:a");
  const products = new ProductRepository([product("a", 10), product("ab", 7)]);
  const inventory = new InventoryService({
    products,
    cache: new MemoryCache(),
  });
  inventory.available("a");
  inventory.updateStock("ab", 3);
  assert.equal(inventory.available("a"), 10);
  assert.equal(inventory.available("ab"), 3);
});

test("在庫: 0 の在庫をキャッシュから読める", () => {
  const { inventory } = setup(0);
  assert.equal(inventory.available("a"), 0);
  assert.throws(
    () => inventory.reserve([{ productId: "a", quantity: 1 }]),
    InsufficientStockError,
  );
});

test("在庫: 数量が0以下ならエラー", () => {
  const { inventory } = setup(10);
  assert.throws(() =>
    inventory.reserve([{ productId: "a", quantity: 0 }]),
  );
  assert.throws(() =>
    inventory.reserve([{ productId: "a", quantity: -1 }]),
  );
});

test("金額: 割引なしの税と合計", () => {
  const totals = calculateTotals([
    { unitPrice: 1000, quantity: 2, taxCategory: "standard" },
  ]);
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.discount, 0);
  assert.equal(totals.tax, 200);
  assert.equal(totals.total, 2200);
});

test("金額: 割引は税抜きに掛け、税は割引後に掛ける", () => {
  const line = priceLine(
    { unitPrice: 1050, quantity: 1, taxCategory: "reduced" },
    0.15,
  );
  assert.deepEqual(
    {
      subtotal: line.subtotal,
      discount: line.discount,
      taxable: line.taxable,
      tax: line.tax,
      total: line.total,
    },
    { subtotal: 1050, discount: 158, taxable: 892, tax: 71, total: 963 },
  );
});

test("金額: 割引後の税額を四捨五入する", () => {
  const line = priceLine(
    { unitPrice: 999, quantity: 1, taxCategory: "standard" },
    0.1,
  );
  assert.equal(line.discount, 100);
  assert.equal(line.taxable, 899);
  assert.equal(line.tax, 90);
  assert.equal(line.total, 989);
});

test("金額: 税率は区分ごとに決まる", () => {
  const totals = calculateTotals([
    { unitPrice: 1000, quantity: 1, taxCategory: "standard" },
    { unitPrice: 1000, quantity: 1, taxCategory: "reduced" },
    { unitPrice: 1000, quantity: 1, taxCategory: "exempt" },
  ]);
  assert.equal(totals.tax, 180);
  assert.equal(totals.total, 3180);
});

test("金額: 明細の合計を足し合わせる", () => {
  const totals = calculateTotals([
    { unitPrice: 500, quantity: 2, taxCategory: "reduced" },
    { unitPrice: 1000, quantity: 1, taxCategory: "standard" },
    { unitPrice: 300, quantity: 3, taxCategory: "exempt" },
  ]);
  assert.equal(totals.subtotal, 2900);
  assert.equal(totals.tax, 180);
  assert.equal(totals.total, 3080);
  assert.equal(totals.quantity, 6);
});

test("金額: 割引100%なら税も合計も0", () => {
  const totals = calculateTotals(
    [{ unitPrice: 1500, quantity: 2, taxCategory: "standard" }],
    { discountRate: 1 },
  );
  assert.equal(totals.discount, 3000);
  assert.equal(totals.tax, 0);
  assert.equal(totals.total, 0);
});

test("金額: 0%の区分には税を足さない", () => {
  const totals = calculateTotals([
    { unitPrice: 1200, quantity: 1, taxCategory: "exempt" },
  ]);
  assert.equal(totals.tax, 0);
  assert.equal(totals.total, 1200);
});

test("金額: 割引率が範囲外ならエラー", () => {
  assert.throws(() =>
    calculateTotals(
      [{ unitPrice: 100, quantity: 1, taxCategory: "standard" }],
      { discountRate: 1.5 },
    ),
  );
});

test("送料: 0kg と 4.9kg は 500 円", () => {
  assert.equal(shippingFee(0), 500);
  assert.equal(shippingFee(4.9), 500);
});

test("送料: ちょうど 5kg は 500 円", () => {
  assert.equal(shippingFee(5), 500);
});

test("送料: 5kg を超えると 800 円", () => {
  assert.equal(shippingFee(5.001), 800);
  assert.equal(shippingFee(9), 800);
});

test("送料: ちょうど 10kg は 800 円", () => {
  assert.equal(shippingFee(10), 800);
  assert.equal(shippingFee(10.001), 1200);
});

test("送料: ちょうど 20kg は 1200 円", () => {
  assert.equal(shippingFee(20), 1200);
});

test("送料: 20kg を超えた分は 5kg ごとに 100 円", () => {
  assert.equal(shippingFee(20.001), 1300);
  assert.equal(shippingFee(25), 1300);
  assert.equal(shippingFee(25.001), 1400);
});

test("送料: 重さが負ならエラー", () => {
  assert.throws(() => shippingFee(-0.1), RangeError);
});

test("ページ: 23件は3ページになる", () => {
  const items = Array.from({ length: 23 }, (_, index) => index);
  assert.equal(paginate(items, { page: 1, pageSize: 10 }).totalPages, 3);
});

test("ページ: 最後のページに端数の3件が入る", () => {
  const items = Array.from({ length: 23 }, (_, index) => index);
  const result = paginate(items, { page: 3, pageSize: 10 });
  assert.deepEqual(result.items, [20, 21, 22]);
  assert.equal(result.hasNext, false);
  assert.equal(result.hasPrevious, true);
});

test("ページ: 割り切れる件数でも最後のページを落とさない", () => {
  const items = Array.from({ length: 20 }, (_, index) => index);
  const result = paginate(items, { page: 2, pageSize: 10 });
  assert.deepEqual(result.items, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal(result.totalPages, 2);
  assert.equal(result.hasNext, false);
});

test("ページ: 1件でも1ページになる", () => {
  const result = paginate([42], { page: 1, pageSize: 10 });
  assert.equal(result.totalPages, 1);
  assert.deepEqual(result.items, [42]);
});

test("ページ: 0件なら0ページで空", () => {
  const result = paginate([], { page: 1, pageSize: 10 });
  assert.equal(result.totalPages, 0);
  assert.deepEqual(result.items, []);
});

test("ページ: 範囲の外は空で、エラーにしない", () => {
  const result = paginate([1, 2, 3], { page: 4, pageSize: 10 });
  assert.deepEqual(result.items, []);
  assert.equal(result.hasNext, false);
});

test("ページ: すべてのページを取ると最後まで入る", () => {
  assert.deepEqual(allPages([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("日付: JST の 1日は UTC の前日 15 時から", () => {
  assert.equal(jstDateKey("2024-01-01T14:59:59Z"), "2024-01-01");
  assert.equal(jstDateKey("2024-01-01T15:00:00Z"), "2024-01-02");
});

test("日付: 深夜の注文を JST の日付でまとめる", () => {
  const rows = dailySales([
    { placedAt: "2024-01-01T14:00:00Z", total: 1000, status: "paid" },
    { placedAt: "2024-01-01T15:30:00Z", total: 2000, status: "paid" },
    { placedAt: "2024-01-02T02:00:00Z", total: 500, status: "paid" },
  ]);
  assert.deepEqual(rows, [
    { date: "2024-01-01", orders: 1, revenue: 1000 },
    { date: "2024-01-02", orders: 2, revenue: 2500 },
  ]);
});

test("日付: 取り消した注文は数えない", () => {
  const rows = dailySales([
    { placedAt: "2024-01-02T01:00:00Z", total: 1000, status: "paid" },
    { placedAt: "2024-01-02T02:00:00Z", total: 500, status: "cancelled" },
  ]);
  assert.deepEqual(rows, [{ date: "2024-01-02", orders: 1, revenue: 1000 }]);
});

test("日付: grandTotal を売上に使う", () => {
  const rows = dailySales([
    { placedAt: "2024-01-02T01:00:00Z", grandTotal: 700, status: "paid" },
  ]);
  assert.equal(rows[0].revenue, 700);
});

test("日付: 日別は古い順に並ぶ", () => {
  const rows = dailySales([
    { placedAt: "2024-01-03T01:00:00Z", total: 300, status: "paid" },
    { placedAt: "2024-01-01T01:00:00Z", total: 100, status: "paid" },
  ]);
  assert.deepEqual(rows.map((row) => row.date), [
    "2024-01-01",
    "2024-01-03",
  ]);
});

test("日付: 月別も JST でまとめる", () => {
  const rows = monthlySales([
    { placedAt: "2024-01-31T14:59:59Z", total: 100, status: "paid" },
    { placedAt: "2024-01-31T15:00:00Z", total: 200, status: "paid" },
  ]);
  assert.deepEqual(rows, [
    { month: "2024-01", orders: 1, revenue: 100 },
    { month: "2024-02", orders: 1, revenue: 200 },
  ]);
});

test("日付: 取り消しを含める指定もできる", () => {
  const rows = dailySales(
    [
      { placedAt: "2024-01-02T01:00:00Z", total: 1000, status: "paid" },
      { placedAt: "2024-01-02T02:00:00Z", total: 500, status: "cancelled" },
    ],
    { includeCancelled: true },
  );
  assert.equal(rows[0].orders, 2);
  assert.equal(rows[0].revenue, 1500);
});
