import { readFileSync } from "node:fs";
import { formatTable, summarize } from "./report.js";

export function readSales(path) {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text);
}

export function renderSalesReport(records, options = {}) {
  return formatTable(summarize(records, options));
}

export function countLines(text) {
  return text.split("\n").length;
}
