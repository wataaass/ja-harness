export function roundYen(value) {
  return Math.round(value);
}

export function lineAmount(item) {
  return roundYen(item.quantity * item.unitPrice);
}
