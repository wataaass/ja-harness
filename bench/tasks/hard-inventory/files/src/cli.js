/**
 * 端末から在庫と注文を見るための、小さな入口。
 *
 * 実運用ではデータベースにつなぐが、ここではサンプルの商品を使って
 * 画面の確認ができるようにしている。
 */

import { MemoryCache } from "./cache.js";
import { dailySales, formatDailySales } from "./report.js";
import { paginate } from "./repository.js";
import { createProduct } from "./models.js";
import { InventoryService } from "./services/inventory.js";

/**
 * 確認用の商品。
 *
 * @returns {Array<ReturnType<typeof createProduct>>}
 */
export function sampleProducts() {
  return [
    createProduct({
      id: "apple",
      name: "りんご",
      unitPrice: 120,
      weightKg: 0.2,
      taxCategory: "reduced",
      stock: 40,
    }),
    createProduct({
      id: "bread",
      name: "パン",
      unitPrice: 220,
      weightKg: 0.35,
      taxCategory: "reduced",
      stock: 15,
    }),
    createProduct({
      id: "knife",
      name: "包丁",
      unitPrice: 3200,
      weightKg: 0.5,
      taxCategory: "standard",
      stock: 6,
    }),
  ];
}

/**
 * 引数を読む。`--page` と `--size` だけを受ける。
 *
 * @param {string[]} argv
 * @returns {{command: string, page: number, size: number}}
 */
export function parseArgs(argv) {
  let command = "stock";
  let page = 1;
  let size = 2;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--page") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--page は1以上の整数です");
      }
      page = value;
      index += 1;
    } else if (arg === "--size") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--size は1以上の整数です");
      }
      size = value;
      index += 1;
    } else if (!arg.startsWith("--")) {
      command = arg;
    } else {
      throw new Error(`知らないオプションです: ${arg}`);
    }
  }
  return { command, page, size };
}

/**
 * 在庫の一覧を文字列にする。
 *
 * @param {Array<{id: string, name: string, stock: number}>} products
 * @param {number} page
 * @param {number} size
 * @returns {string}
 */
export function stockLines(products, page = 1, size = 10) {
  const result = paginate(products, { page, pageSize: size });
  const lines = [`${result.page} / ${result.totalPages} ページ`];
  for (const product of result.items) {
    lines.push(`${product.id}\t${product.name}\t${product.stock}`);
  }
  return lines.join("\n");
}

/**
 * 確認用の在庫サービスを作る。
 *
 * @returns {{inventory: InventoryService, cache: MemoryCache, products: object}}
 */
export function createSampleInventory() {
  const products = {
    items: sampleProducts(),
    all() {
      return this.items;
    },
    require(id) {
      const found = this.items.find((product) => product.id === id);
      if (found === undefined) {
        throw new Error(`商品がありません: ${id}`);
      }
      return found;
    },
  };
  const cache = new MemoryCache();
  const inventory = new InventoryService({ products, cache });
  return { inventory, cache, products };
}

/**
 * コマンドを実行する。
 *
 * @param {string[]} argv
 * @returns {string}
 */
export function run(argv) {
  const args = parseArgs(argv);
  const { inventory, products } = createSampleInventory();

  if (args.command === "stock") {
    return stockLines(products.all(), args.page, args.size);
  }
  if (args.command === "reserve") {
    const lines = [
      { productId: "apple", quantity: 3 },
      { productId: "bread", quantity: 2 },
    ];
    inventory.reserve(lines);
    return stockLines(products.all(), 1, 10);
  }
  if (args.command === "sales") {
    const now = new Date();
    const rows = dailySales([
      { placedAt: now, total: 1000, status: "paid" },
      { placedAt: now, total: 500, status: "paid" },
    ]);
    return formatDailySales(rows);
  }
  throw new Error(`知らないコマンドです: ${args.command}`);
}

/**
 * 端末から呼ばれたときだけ動く。
 *
 * @param {string[]} [argv]
 * @returns {number}
 */
export function main(argv = process.argv.slice(2)) {
  try {
    process.stdout.write(`${run(argv)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`エラー: ${message}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
