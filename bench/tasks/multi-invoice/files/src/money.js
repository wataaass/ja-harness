export function roundYen(value) {
  return Math.floor(value);
}

export function lineAmount(item) {
  return roundYen(item.quantity * item.unitPrice);
}
