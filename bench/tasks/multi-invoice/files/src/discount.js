export function normalizeRate(value, label) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new RangeError(`${label} は0以上1以下の数にしてください（今: ${value}）`);
  }
  return value;
}

export function discountAmount(subtotal, rate) {
  normalizeRate(rate, "discountRate");
  return subtotal * (1 - rate);
}
