export function rewritePays(o: {
  rewrittenTokens: number;
  savedTokens: number;
  callsAhead: number;
  prices: { input: number; cachedInput: number; cacheWrite?: number };
  margin?: number;
  rereadCost?: number;
}): boolean {
  const cacheWrite = o.prices.cacheWrite ?? o.prices.input;
  const margin = o.margin ?? 1;
  const loss = o.rewrittenTokens * (cacheWrite - o.prices.cachedInput);
  const gain = o.savedTokens * o.prices.cachedInput * o.callsAhead;
  return gain > margin * (loss + (o.rereadCost ?? 0));
}
