import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCache } from "../src/cache.js";
import { createProduct } from "../src/models.js";
import { ProductRepository } from "../src/repository.js";
import {
  InsufficientStockError,
  InventoryService,
} from "../src/services/inventory.js";

function setup(stock = 10) {
  const products = new ProductRepository([
    createProduct({
      id: "apple",
      name: "りんご",
      unitPrice: 120,
      weightKg: 0.2,
      taxCategory: "reduced",
      stock,
    }),
    createProduct({
      id: "bread",
      name: "パン",
      unitPrice: 220,
      weightKg: 0.35,
      taxCategory: "reduced",
      stock: 4,
    }),
  ]);
  const cache = new MemoryCache();
  const inventory = new InventoryService({ products, cache });
  return { products, cache, inventory };
}

test("足りていれば明細の分だけ在庫を引く", () => {
  const { products, inventory } = setup();
  inventory.reserve([{ productId: "apple", quantity: 3 }]);
  assert.equal(products.require("apple").stock, 7);
});

test("同じ商品の複数明細は合計して判定する", () => {
  const { products, inventory } = setup();
  assert.throws(
    () =>
      inventory.reserve([
        { productId: "apple", quantity: 6 },
        { productId: "apple", quantity: 6 },
      ]),
    InsufficientStockError,
  );
  assert.equal(products.require("apple").stock, 10);
});

test("足りないときはどの商品の在庫も変えない", () => {
  const { products, inventory } = setup();
  assert.throws(
    () =>
      inventory.reserve([
        { productId: "bread", quantity: 2 },
        { productId: "apple", quantity: 99 },
      ]),
    InsufficientStockError,
  );
  assert.equal(products.require("bread").stock, 4);
  assert.equal(products.require("apple").stock, 10);
});

test("戻すと商品ごとに足される", () => {
  const { products, inventory } = setup();
  inventory.reserve([
    { productId: "apple", quantity: 2 },
    { productId: "apple", quantity: 3 },
  ]);
  inventory.release([
    { productId: "apple", quantity: 1 },
    { productId: "apple", quantity: 4 },
  ]);
  assert.equal(products.require("apple").stock, 10);
});

test("在庫を更新したらキャッシュも新しくなる", () => {
  const { products, cache, inventory } = setup();
  assert.equal(inventory.available("apple"), 10);
  inventory.updateStock("apple", 2);
  assert.equal(inventory.available("apple"), 2);
  assert.equal(products.require("apple").stock, 2);
  assert.equal(cache.size, 1);
});

test("在庫が0でもキャッシュから0を返す", () => {
  const { inventory } = setup();
  inventory.updateStock("apple", 0);
  assert.equal(inventory.available("apple"), 0);
  assert.throws(
    () => inventory.reserve([{ productId: "apple", quantity: 1 }]),
    InsufficientStockError,
  );
});
