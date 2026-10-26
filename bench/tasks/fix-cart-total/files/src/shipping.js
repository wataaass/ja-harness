/**
 * 送料の計算。
 *
 * 商品金額は税抜・割引前の値を受け取り、割引額も別に受け取る。
 * 送料無料の判定は「割引後の商品金額」で行う。これは画面の
 * 「あと少しで送料無料」の表示と、実際の請求額を一致させるため。
 */

export const FREE_SHIPPING_THRESHOLD = 5000;
export const BASE_SHIPPING_FEE = 500;

export const REGIONS = {
  hokkaido: { label: "北海道", surcharge: 500 },
  tohoku: { label: "東北", surcharge: 200 },
  kanto: { label: "関東", surcharge: 0 },
  chubu: { label: "中部", surcharge: 0 },
  kinki: { label: "近畿", surcharge: 0 },
  chugoku: { label: "中国", surcharge: 200 },
  shikoku: { label: "四国", surcharge: 200 },
  kyushu: { label: "九州", surcharge: 300 },
  okinawa: { label: "沖縄", surcharge: 1000 },
};

export const PREFECTURE_REGION = {
  北海道: "hokkaido",
  青森県: "tohoku",
  岩手県: "tohoku",
  宮城県: "tohoku",
  秋田県: "tohoku",
  山形県: "tohoku",
  福島県: "tohoku",
  茨城県: "kanto",
  栃木県: "kanto",
  群馬県: "kanto",
  埼玉県: "kanto",
  千葉県: "kanto",
  東京都: "kanto",
  神奈川県: "kanto",
  新潟県: "chubu",
  富山県: "chubu",
  石川県: "chubu",
  福井県: "chubu",
  山梨県: "chubu",
  長野県: "chubu",
  岐阜県: "chubu",
  静岡県: "chubu",
  愛知県: "chubu",
  三重県: "kinki",
  滋賀県: "kinki",
  京都府: "kinki",
  大阪府: "kinki",
  兵庫県: "kinki",
  奈良県: "kinki",
  和歌山県: "kinki",
  鳥取県: "chugoku",
  島根県: "chugoku",
  岡山県: "chugoku",
  広島県: "chugoku",
  山口県: "chugoku",
  徳島県: "shikoku",
  香川県: "shikoku",
  愛媛県: "shikoku",
  高知県: "shikoku",
  福岡県: "kyushu",
  佐賀県: "kyushu",
  長崎県: "kyushu",
  熊本県: "kyushu",
  大分県: "kyushu",
  宮崎県: "kyushu",
  鹿児島県: "kyushu",
  沖縄県: "okinawa",
};

export const METHODS = {
  standard: { label: "通常配送", multiplier: 1, days: 3 },
  express: { label: "速達", multiplier: 2, days: 1 },
  cool: { label: "クール便", multiplier: 1.5, days: 2 },
  pickup: { label: "店頭受け取り", multiplier: 0, days: 0 },
};

/**
 * 都道府県から地域を返す。未定義なら関東として扱う。
 * @param {string} prefecture
 * @returns {string}
 */
export function regionOf(prefecture) {
  return PREFECTURE_REGION[prefecture] ?? "kanto";
}

/**
 * 地域の追加送料を返す。
 * @param {string} region
 * @returns {number}
 */
export function regionSurcharge(region) {
  return REGIONS[region]?.surcharge ?? 0;
}

/**
 * 配送方法の倍率を返す。
 * @param {string} method
 * @returns {number}
 */
export function methodMultiplier(method) {
  return METHODS[method]?.multiplier ?? 1;
}

/**
 * 配送までの日数を返す。
 * @param {string} method
 * @returns {number}
 */
export function deliveryDays(method) {
  return METHODS[method]?.days ?? 3;
}

/**
 * 送料を計算する。
 *
 * 送料無料の条件: 割引後の商品金額（merchandiseTotal - discountTotal）が
 * FREE_SHIPPING_THRESHOLD 以上。店頭受け取りは常に 0 円。
 *
 * @param {{merchandiseTotal: number, discountTotal?: number, prefecture?: string, method?: string}} options
 * @returns {number}
 */
export function shippingFee(options) {
  const merchandise = Number(options?.merchandiseTotal ?? 0);
  const discount = Number(options?.discountTotal ?? 0);
  const prefecture = options?.prefecture ?? "東京都";
  const method = options?.method ?? "standard";
  if (method === "pickup") {
    return 0;
  }
  if (merchandise >= FREE_SHIPPING_THRESHOLD) {
    return 0;
  }
  const base = BASE_SHIPPING_FEE * methodMultiplier(method);
  return Math.round(base + regionSurcharge(regionOf(prefecture)));
}

/**
 * 送料無料まであと何円かを返す。すでに無料なら 0。
 * @param {{merchandiseTotal: number, discountTotal?: number}} options
 * @returns {number}
 */
export function amountUntilFreeShipping(options) {
  const merchandise = Number(options?.merchandiseTotal ?? 0);
  const discount = Number(options?.discountTotal ?? 0);
  return Math.max(0, FREE_SHIPPING_THRESHOLD - (merchandise - discount));
}

/**
 * 送料無料かを返す。
 * @param {{merchandiseTotal: number, discountTotal?: number, method?: string}} options
 * @returns {boolean}
 */
export function isFreeShipping(options) {
  return shippingFee(options) === 0;
}

/**
 * 送料を含めた支払い額を返す。
 * @param {{merchandiseTotal: number, discountTotal?: number, prefecture?: string, method?: string}} options
 * @returns {number}
 */
export function totalWithShipping(options) {
  const merchandise = Number(options?.merchandiseTotal ?? 0);
  const discount = Number(options?.discountTotal ?? 0);
  return merchandise - discount + shippingFee(options);
}

/**
 * 配送方法の一覧を返す。
 * @returns {{id: string, label: string, days: number}[]}
 */
export function shippingMethods() {
  return Object.entries(METHODS).map(([id, definition]) => ({
    id,
    label: definition.label,
    days: definition.days,
  }));
}

/**
 * 都道府県の一覧を返す。
 * @returns {string[]}
 */
export function prefectures() {
  return Object.keys(PREFECTURE_REGION);
}

/**
 * 見積もりの内訳を返す。
 * @param {{merchandiseTotal: number, discountTotal?: number, prefecture?: string, method?: string}} options
 * @returns {{merchandise: number, discount: number, shipping: number, total: number, freeShipping: boolean}}
 */
export function shippingQuote(options) {
  const merchandise = Number(options?.merchandiseTotal ?? 0);
  const discount = Number(options?.discountTotal ?? 0);
  const shipping = shippingFee(options);
  return {
    merchandise,
    discount,
    shipping,
    total: merchandise - discount + shipping,
    freeShipping: shipping === 0,
  };
}
