export const COUPONS = {
  SAVE10: { type: "percentage", rate: 0.1, label: "10%オフ" },
  SAVE20: { type: "percentage", rate: 0.2, label: "20%オフ" },
  MINUS500: { type: "fixed", amount: 500, label: "500円引き" },
  FREESHIP: { type: "shipping", label: "送料無料" },
};

export function roundYen(value) {
  return Math.round(Number(value));
}

export function normalizeRate(rate) {
  if (typeof rate !== "number" || Number.isNaN(rate)) {
    throw new TypeError("rate must be a number");
  }
  if (rate < 0 || rate > 1) {
    throw new RangeError("rate must be between 0 and 1");
  }
  return rate;
}

export function describeDiscount(discount) {
  if (!discount || typeof discount !== "object") return "";
  if (discount.label) return discount.label;
  if (discount.type === "percentage") return `${Math.round(discount.rate * 100)}%オフ`;
  if (discount.type === "fixed") return `${roundYen(discount.amount)}円引き`;
  if (discount.type === "threshold") {
    return `${roundYen(discount.threshold)}円以上で${roundYen(discount.amount)}円引き`;
  }
  if (discount.type === "coupon") return COUPONS[discount.code]?.label ?? discount.code;
  if (discount.type === "shipping") return "送料無料";
  return "";
}

export function validateDiscount(discount) {
  if (!discount || typeof discount !== "object") {
    throw new TypeError("discount must be an object");
  }
  if (discount.type === "percentage") {
    normalizeRate(discount.rate);
    return true;
  }
  if (discount.type === "fixed") {
    if (!(discount.amount >= 0)) throw new RangeError("amount must be positive");
    return true;
  }
  if (discount.type === "threshold") {
    if (!(discount.threshold >= 0)) throw new RangeError("threshold must be positive");
    if (!(discount.amount >= 0)) throw new RangeError("amount must be positive");
    return true;
  }
  if (discount.type === "coupon") {
    if (!COUPONS[discount.code]) throw new RangeError(`unknown coupon: ${discount.code}`);
    return true;
  }
  if (discount.type === "shipping") return true;
  throw new RangeError(`unknown discount type: ${discount.type}`);
}

export function resolveCoupon(discount) {
  if (discount.type !== "coupon") return discount;
  const coupon = COUPONS[discount.code];
  if (!coupon) throw new RangeError(`unknown coupon: ${discount.code}`);
  return { ...coupon, code: discount.code };
}

export function discountAmount(base, discount) {
  const amountBase = Math.max(0, Number(base));
  if (!discount) return 0;
  const resolved = resolveCoupon(discount);
  if (resolved.type === "percentage") {
    return Math.min(amountBase, roundYen(amountBase * normalizeRate(resolved.rate)));
  }
  if (resolved.type === "fixed") {
    return Math.min(amountBase, roundYen(resolved.amount));
  }
  if (resolved.type === "threshold") {
    if (amountBase < resolved.threshold) return 0;
    return Math.min(amountBase, roundYen(resolved.amount));
  }
  if (resolved.type === "shipping") return 0;
  return 0;
}

export function applyDiscounts(subtotal, discounts = []) {
  let remaining = Math.max(0, Number(subtotal));
  let discountTotal = 0;
  const applied = [];
  for (const discount of discounts) {
    if (!discount) continue;
    const amount = discountAmount(remaining, discount);
    if (amount <= 0) continue;
    remaining -= amount;
    discountTotal += amount;
    applied.push({
      ...resolveCoupon(discount),
      amount,
      label: describeDiscount(discount),
    });
  }
  return {
    subtotal: Math.max(0, Number(subtotal)),
    discountTotal,
    discountedSubtotal: remaining,
    applied,
  };
}

export function bestSingleDiscount(subtotal, discounts = []) {
  return discounts.reduce(
    (best, discount) => {
      const amount = discountAmount(subtotal, discount);
      if (amount > best.amount) {
        return { discount, amount, label: describeDiscount(discount) };
      }
      return best;
    },
    { discount: null, amount: 0, label: "" },
  );
}

export function totalDiscountAmount(subtotal, discounts = []) {
  return applyDiscounts(subtotal, discounts).discountTotal;
}

export function couponFromCode(code) {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (!COUPONS[normalized]) return null;
  return { type: "coupon", code: normalized };
}

export function filterUsableDiscounts(subtotal, discounts = []) {
  return discounts.filter((discount) => discountAmount(subtotal, discount) > 0);
}

export function combineDiscounts(...groups) {
  return groups.flat().filter(Boolean);
}

export function percentage(rate, label) {
  return { type: "percentage", rate: normalizeRate(rate), label };
}

export function fixed(amount, label) {
  return { type: "fixed", amount: roundYen(amount), label };
}

export function threshold(thresholdAmount, amount, label) {
  return {
    type: "threshold",
    threshold: roundYen(thresholdAmount),
    amount: roundYen(amount),
    label,
  };
}

export function coupon(code) {
  const discount = couponFromCode(code);
  if (!discount) throw new RangeError(`unknown coupon: ${code}`);
  return discount;
}
