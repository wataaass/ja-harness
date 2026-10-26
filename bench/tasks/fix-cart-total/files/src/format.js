export function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

export function groupDigits(value) {
  const text = String(Math.abs(Number(value)));
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatYen(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "¥0";
  const rounded = Math.round(number);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}¥${groupDigits(rounded)}`;
}

export function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toFixed(decimals);
}

export function formatPercent(rate, decimals = 0) {
  return `${(Number(rate) * 100).toFixed(decimals)}%`;
}

export function formatQuantity(value) {
  return `${Number(value)}点`;
}

export function formatDiscount(amount) {
  return `-${formatYen(amount)}`;
}

export function formatTax(amount, rate) {
  return `${formatYen(amount)} (${formatPercent(rate)})`;
}

export function formatItem(item) {
  const name = item.name ?? item.sku ?? "商品";
  return `${name} x${item.quantity} ${formatYen(item.unitPrice * item.quantity)}`;
}

export function formatDiscountLine(label, amount) {
  return `${label}: ${formatDiscount(amount)}`;
}

export function formatSummary(summary) {
  return [
    `小計 ${formatYen(summary.subtotal)}`,
    `割引 ${formatDiscount(summary.discountTotal)}`,
    `税 ${formatYen(summary.tax)}`,
    `合計 ${formatYen(summary.total)}`,
  ].join("\n");
}

export function formatReceipt(summary, options = {}) {
  const lines = [];
  if (options.title) lines.push(options.title);
  for (const item of summary.items ?? []) lines.push(formatItem(item));
  if ((summary.items ?? []).length > 0) lines.push("---");
  lines.push(`小計 ${formatYen(summary.subtotal)}`);
  for (const discount of summary.applied ?? []) {
    lines.push(formatDiscountLine(discount.label, discount.amount));
  }
  lines.push(`税 ${formatYen(summary.tax)}`);
  lines.push(`合計 ${formatYen(summary.total)}`);
  return lines.join("\n");
}

export function formatCartSummary(summary) {
  return `${summary.lineCount}品 ${formatYen(summary.total)} (税 ${formatYen(summary.tax)})`;
}

export function formatTable(rows, columns) {
  const widths = columns.map((column) =>
    Math.max(
      column.label.length,
      ...rows.map((row) => String(row[column.key] ?? "").length),
    ),
  );
  const header = columns.map((column, i) => String(column.label).padEnd(widths[i])).join(" | ");
  const divider = widths.map((width) => "-".repeat(width)).join("-+-");
  const body = rows.map((row) =>
    columns.map((column, i) => String(row[column.key] ?? "").padEnd(widths[i])).join(" | "),
  );
  return [header, divider, ...body].join("\n");
}

export function truncate(text, length) {
  const value = String(text);
  if (value.length <= length) return value;
  if (length <= 1) return value.slice(0, length);
  return value.slice(0, length - 1) + "…";
}

export function alignRight(text, width) {
  return String(text).padStart(width);
}

export function alignLeft(text, width) {
  return String(text).padEnd(width);
}

export function formatDate(date) {
  const value = date instanceof Date ? date : new Date(date);
  return `${value.getFullYear()}/${pad(value.getMonth() + 1)}/${pad(value.getDate())}`;
}

export function formatDateTime(date) {
  const value = date instanceof Date ? date : new Date(date);
  return `${formatDate(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function formatAddress(address) {
  if (!address) return "";
  const parts = [address.postalCode, address.prefecture, address.city, address.street].filter(
    Boolean,
  );
  return parts.join(" ");
}

export function formatPhone(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  return String(value);
}
