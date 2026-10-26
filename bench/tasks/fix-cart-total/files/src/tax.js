export const DEFAULT_TAX_RATE = 0.1;

export const TAX_RATES = {
  standard: 0.1,
  reduced: 0.08,
  exempt: 0,
};

export function validateRate(rate) {
  if (typeof rate !== "number" || Number.isNaN(rate)) {
    throw new TypeError("tax rate must be a number");
  }
  if (rate < 0 || rate >= 1) {
    throw new RangeError("tax rate must be between 0 and 1");
  }
  return rate;
}

export function calculateTax(amount, rate = DEFAULT_TAX_RATE) {
  const base = Math.max(0, Number(amount));
  return Math.round(base * validateRate(rate));
}

export function totalWithTax(amount, rate = DEFAULT_TAX_RATE) {
  const base = Math.max(0, Number(amount));
  return base + calculateTax(base, rate);
}

export function taxIncluded(amount, rate = DEFAULT_TAX_RATE) {
  const gross = Math.max(0, Number(amount));
  validateRate(rate);
  const tax = Math.floor(gross - gross / (1 + rate));
  return {
    gross,
    net: gross - tax,
    tax,
    rate,
  };
}

export function taxRateForCategory(category) {
  if (category === "food" || category === "newspaper") return TAX_RATES.reduced;
  if (category === "exempt") return TAX_RATES.exempt;
  return TAX_RATES.standard;
}

export function splitTaxByCategory(lines, rateFor = taxRateForCategory) {
  const groups = new Map();
  for (const line of lines) {
    const rate = rateFor(line.category);
    if (!groups.has(rate)) groups.set(rate, { rate, subtotal: 0, tax: 0 });
    const group = groups.get(rate);
    group.subtotal += line.amount;
    group.tax = calculateTax(group.subtotal, rate);
  }
  return [...groups.values()];
}

export function effectiveRate(amount, tax) {
  if (amount <= 0) return 0;
  return tax / amount;
}

export function formatRate(rate) {
  validateRate(rate);
  return `${Math.round(rate * 100)}%`;
}

export function roundTax(amount, rate = DEFAULT_TAX_RATE) {
  return calculateTax(amount, rate);
}
