export function rewritePays(o: {
  rewrittenTokens: number;
  savedTokens: number;
  callsAhead: number;
  prices: { input: number; cachedInput: number };
}): boolean {
  const loss = o.rewrittenTokens * (o.prices.input - o.prices.cachedInput);
  const gain = o.savedTokens * o.prices.cachedInput * o.callsAhead;
  return gain > loss;
}
