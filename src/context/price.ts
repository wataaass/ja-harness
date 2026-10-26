export function rewritePays(o: {
  rewrittenTokens: number;
  savedTokens: number;
  callsAhead: number;
  prices: { input: number; cachedInput: number; cacheWrite?: number };
}): boolean {
  const cacheWrite = o.prices.cacheWrite ?? o.prices.input;
  const loss = o.rewrittenTokens * (cacheWrite - o.prices.cachedInput);
  const gain = o.savedTokens * o.prices.cachedInput * o.callsAhead;
  return gain > loss;
}
