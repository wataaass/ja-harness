function formatNumber(value) {
  return Math.round(Number(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function summarize(records) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  const monthMap = new Map();
  const productMap = new Map();
  let total = 0;

  for (const record of records) {
    const quantity = Number(record.quantity);
    const unitPrice = Number(record.unitPrice);
    const amount = quantity * unitPrice;
    total += amount;

    const month = String(record.date).slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { month, total: 0, quantity: 0, count: 0 });
    }
    const monthEntry = monthMap.get(month);
    monthEntry.total += amount;
    monthEntry.quantity += quantity;
    monthEntry.count += 1;

    const product = String(record.product);
    if (!productMap.has(product)) {
      productMap.set(product, { product, total: 0, quantity: 0, count: 0 });
    }
    const productEntry = productMap.get(product);
    productEntry.total += amount;
    productEntry.quantity += quantity;
    productEntry.count += 1;
  }

  const byMonth = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const byProduct = [...productMap.values()].sort(
    (a, b) => b.total - a.total || a.product.localeCompare(b.product, "ja"),
  );

  return {
    byMonth,
    byProduct,
    topProducts: byProduct.slice(0, 3),
    total,
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
  lines.push("上位3件");
  summary.topProducts.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.product} | ${formatNumber(item.total)}`);
  });
  lines.push(`合計 | ${formatNumber(summary.total)}`);
  return lines.join("\n");
}
