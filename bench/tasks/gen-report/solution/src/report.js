import { formatNumber } from "./utils.js";
import {
  accumulate,
  byTotalThenName,
  compareMonth,
  createBucket,
  finalizeBuckets,
  monthOf,
  normalizeOptions,
  validateRecord,
} from "./summary.js";

export function summarize(records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  const { top } = normalizeOptions(options);

  const months = new Map();
  const products = new Map();
  const categories = new Map();
  let total = 0;
  let quantity = 0;

  records.forEach((record, index) => {
    const category = validateRecord(record, index);
    const amount = record.quantity * record.unitPrice;
    const month = monthOf(record.date);

    if (!months.has(month)) months.set(month, createBucket(month, "month"));
    accumulate(months.get(month), amount, record.quantity);

    if (!products.has(record.product)) {
      products.set(record.product, createBucket(record.product, "product"));
    }
    accumulate(products.get(record.product), amount, record.quantity);

    if (!categories.has(category)) {
      categories.set(category, createBucket(category, "category"));
    }
    accumulate(categories.get(category), amount, record.quantity);

    total += amount;
    quantity += record.quantity;
  });

  const byMonth = finalizeBuckets(months, compareMonth);
  const byProduct = finalizeBuckets(products, byTotalThenName("product"));
  const byCategory = finalizeBuckets(categories, byTotalThenName("category"));
  const count = records.length;

  return {
    byMonth,
    byProduct,
    byCategory,
    topProducts: byProduct.slice(0, top),
    total,
    quantity,
    count,
    average: count === 0 ? 0 : total / count,
  };
}

export function formatTable(summary) {
  if (!summary || !Array.isArray(summary.byMonth) || summary.byMonth.length === 0) {
    return "データなし";
  }
  const lines = ["月別"];
  for (const item of summary.byMonth) {
    lines.push(`${item.month} | ${formatNumber(item.total)} | ${item.count}`);
  }
  lines.push("商品別");
  for (const item of summary.byProduct) {
    lines.push(`${item.product} | ${formatNumber(item.total)} | ${item.count}`);
  }
  lines.push("カテゴリ別");
  for (const item of summary.byCategory) {
    lines.push(`${item.category} | ${formatNumber(item.total)} | ${item.count}`);
  }
  lines.push("上位3件");
  summary.topProducts.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.product} | ${formatNumber(item.total)}`);
  });
  lines.push(`合計 | ${formatNumber(summary.total)}`);
  lines.push(`平均 | ${formatNumber(summary.average)}`);
  lines.push(`件数 | ${formatNumber(summary.count)}`);
  return lines.join("\n");
}
