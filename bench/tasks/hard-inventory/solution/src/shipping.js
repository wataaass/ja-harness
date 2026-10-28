/**
 * 送料の計算。
 *
 * 重さの区切りは「以下」で読む。ちょうど 5kg は 500 円の段に入る。
 * 20kg を超えた分は 5kg ごとに 100 円を足す。
 */

export const BASE_FEE = 500;
export const EXTRA_UNIT_KG = 5;
export const EXTRA_UNIT_FEE = 100;

export const SHIPPING_TIERS = Object.freeze([
  { maxKg: 5, fee: 500 },
  { maxKg: 10, fee: 800 },
  { maxKg: 20, fee: 1200 },
]);

/**
 * 重さを kg の数として確かめる。
 *
 * @param {number} weightKg
 * @returns {number}
 */
export function checkWeight(weightKg) {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg)) {
    throw new RangeError("重さは有限の数です");
  }
  if (weightKg < 0) {
    throw new RangeError("重さは0以上です");
  }
  return weightKg;
}

/**
 * 送料を返す。
 *
 * @param {number} weightKg
 * @returns {number}
 */
export function shippingFee(weightKg) {
  const weight = checkWeight(weightKg);
  for (const tier of SHIPPING_TIERS) {
    if (weight <= tier.maxKg) {
      return tier.fee;
    }
  }
  const over = weight - 20;
  return 1200 + Math.ceil(over / EXTRA_UNIT_KG) * EXTRA_UNIT_FEE;
}

/**
 * 送料の内訳を返す。表示用。
 *
 * @param {number} weightKg
 * @returns {{weightKg: number, fee: number, tier: string, extra: number}}
 */
export function shippingBreakdown(weightKg) {
  const weight = checkWeight(weightKg);
  let tier = "20kg超";
  let extra = 0;
  for (const candidate of SHIPPING_TIERS) {
    if (weight <= candidate.maxKg) {
      tier = `${candidate.maxKg}kg以下`;
      return { weightKg: weight, fee: candidate.fee, tier, extra };
    }
  }
  extra = Math.ceil((weight - 20) / EXTRA_UNIT_KG) * EXTRA_UNIT_FEE;
  return { weightKg: weight, fee: shippingFee(weight), tier, extra };
}

/**
 * 送料が無料になる条件かどうか。
 *
 * @param {number} subtotal
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function isFreeShipping(subtotal, threshold = 10000) {
  if (!Number.isFinite(subtotal)) {
    throw new RangeError("小計は有限の数です");
  }
  return subtotal >= threshold;
}

/**
 * 注文の重さから送料を返す。
 *
 * @param {{lines: Array<{weightKg: number, quantity: number}>}} order
 * @returns {number}
 */
export function shippingFeeForOrder(order) {
  let weight = 0;
  for (const line of order.lines) {
    weight += line.weightKg * line.quantity;
  }
  return shippingFee(Math.round(weight * 1000) / 1000);
}
