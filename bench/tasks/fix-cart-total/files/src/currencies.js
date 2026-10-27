/**
 * 通貨の定義と、通貨単位の小さな計算をまとめたファイル。
 *
 * 金額はすべて「最小単位の整数」で扱う。たとえば JPY は 1 円、
 * USD は 1 セント（0.01 ドル）が最小単位になる。浮動小数の誤差を
 * 合計計算に持ち込まないための決まりで、表示の直前にだけ割る。
 */

export const CURRENCIES = {
  AED: {
    code: "AED",
    name: "UAE dirham",
    symbol: "د.إ",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 41,
  },
  ARS: {
    code: "ARS",
    name: "Argentine peso",
    symbol: "$",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: true,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 0.16,
  },
  AUD: {
    code: "AUD",
    name: "Australian dollar",
    symbol: "A$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 97.5,
  },
  BRL: {
    code: "BRL",
    name: "Brazilian real",
    symbol: "R$",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: true,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 28,
  },
  CAD: {
    code: "CAD",
    name: "Canadian dollar",
    symbol: "C$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 107,
  },
  CHF: {
    code: "CHF",
    name: "Swiss franc",
    symbol: "CHF",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: "'",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.05,
    referenceRate: 168,
  },
  CLP: {
    code: "CLP",
    name: "Chilean peso",
    symbol: "$",
    minorUnit: 0,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: true,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 0.16,
  },
  CNY: {
    code: "CNY",
    name: "Chinese yuan",
    symbol: "¥",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 21,
  },
  COP: {
    code: "COP",
    name: "Colombian peso",
    symbol: "$",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: true,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 0.038,
  },
  CZK: {
    code: "CZK",
    name: "Czech koruna",
    symbol: "Kč",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 6.6,
  },
  DKK: {
    code: "DKK",
    name: "Danish krone",
    symbol: "kr",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 21.5,
  },
  EGP: {
    code: "EGP",
    name: "Egyptian pound",
    symbol: "E£",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 3.2,
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 162,
  },
  GBP: {
    code: "GBP",
    name: "Pound sterling",
    symbol: "£",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 190,
  },
  HKD: {
    code: "HKD",
    name: "Hong Kong dollar",
    symbol: "HK$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 19.3,
  },
  HUF: {
    code: "HUF",
    name: "Hungarian forint",
    symbol: "Ft",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 5,
    referenceRate: 0.42,
  },
  IDR: {
    code: "IDR",
    name: "Indonesian rupiah",
    symbol: "Rp",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: true,
    spaceBetween: true,
    cashRounding: 100,
    referenceRate: 0.0097,
  },
  ILS: {
    code: "ILS",
    name: "Israeli new shekel",
    symbol: "₪",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 40,
  },
  INR: {
    code: "INR",
    name: "Indian rupee",
    symbol: "₹",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 1.8,
  },
  ISK: {
    code: "ISK",
    name: "Icelandic krona",
    symbol: "kr",
    minorUnit: 0,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 1.1,
  },
  JPY: {
    code: "JPY",
    name: "Japanese yen",
    symbol: "¥",
    minorUnit: 0,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 1,
  },
  KRW: {
    code: "KRW",
    name: "South Korean won",
    symbol: "₩",
    minorUnit: 0,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 0.11,
  },
  MXN: {
    code: "MXN",
    name: "Mexican peso",
    symbol: "MX$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 8.8,
  },
  MYR: {
    code: "MYR",
    name: "Malaysian ringgit",
    symbol: "RM",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 33,
  },
  NOK: {
    code: "NOK",
    name: "Norwegian krone",
    symbol: "kr",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 14,
  },
  NZD: {
    code: "NZD",
    name: "New Zealand dollar",
    symbol: "NZ$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.1,
    referenceRate: 89,
  },
  PEN: {
    code: "PEN",
    name: "Peruvian sol",
    symbol: "S/",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.1,
    referenceRate: 39,
  },
  PHP: {
    code: "PHP",
    name: "Philippine peso",
    symbol: "₱",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.25,
    referenceRate: 2.6,
  },
  PKR: {
    code: "PKR",
    name: "Pakistani rupee",
    symbol: "₨",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 0.54,
  },
  PLN: {
    code: "PLN",
    name: "Polish zloty",
    symbol: "zł",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 37,
  },
  RON: {
    code: "RON",
    name: "Romanian leu",
    symbol: "lei",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 32.5,
  },
  RUB: {
    code: "RUB",
    name: "Russian ruble",
    symbol: "₽",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 1.6,
  },
  SAR: {
    code: "SAR",
    name: "Saudi riyal",
    symbol: "﷼",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 40,
  },
  SEK: {
    code: "SEK",
    name: "Swedish krona",
    symbol: "kr",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 14.2,
  },
  SGD: {
    code: "SGD",
    name: "Singapore dollar",
    symbol: "S$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 111,
  },
  THB: {
    code: "THB",
    name: "Thai baht",
    symbol: "฿",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.25,
    referenceRate: 4.2,
  },
  TRY: {
    code: "TRY",
    name: "Turkish lira",
    symbol: "₺",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 4.4,
  },
  TWD: {
    code: "TWD",
    name: "New Taiwan dollar",
    symbol: "NT$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.5,
    referenceRate: 4.6,
  },
  UAH: {
    code: "UAH",
    name: "Ukrainian hryvnia",
    symbol: "₴",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 3.6,
  },
  USD: {
    code: "USD",
    name: "United States dollar",
    symbol: "$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 145,
  },
  VND: {
    code: "VND",
    name: "Vietnamese dong",
    symbol: "₫",
    minorUnit: 0,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 100,
    referenceRate: 0.0057,
  },
  ZAR: {
    code: "ZAR",
    name: "South African rand",
    symbol: "R",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: " ",
    symbolBefore: true,
    spaceBetween: true,
    cashRounding: 0.1,
    referenceRate: 8,
  },
  BGN: {
    code: "BGN",
    name: "Bulgarian lev",
    symbol: "лв",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 83,
  },
  HRK: {
    code: "HRK",
    name: "Croatian kuna",
    symbol: "kn",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 21.5,
  },
  MAD: {
    code: "MAD",
    name: "Moroccan dirham",
    symbol: "DH",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 14,
  },
  NGN: {
    code: "NGN",
    name: "Nigerian naira",
    symbol: "₦",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 0.092,
  },
  KES: {
    code: "KES",
    name: "Kenyan shilling",
    symbol: "KSh",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.5,
    referenceRate: 1.1,
  },
  QAR: {
    code: "QAR",
    name: "Qatari riyal",
    symbol: "ر.ق",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 40,
  },
  KWD: {
    code: "KWD",
    name: "Kuwaiti dinar",
    symbol: "د.ك",
    minorUnit: 3,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.005,
    referenceRate: 470,
  },
  BHD: {
    code: "BHD",
    name: "Bahraini dinar",
    symbol: ".د.ب",
    minorUnit: 3,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.005,
    referenceRate: 385,
  },
  OMR: {
    code: "OMR",
    name: "Omani rial",
    symbol: "ر.ع.",
    minorUnit: 3,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.005,
    referenceRate: 377,
  },
  JOD: {
    code: "JOD",
    name: "Jordanian dinar",
    symbol: "د.ا",
    minorUnit: 3,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.005,
    referenceRate: 204,
  },
  TND: {
    code: "TND",
    name: "Tunisian dinar",
    symbol: "د.ت",
    minorUnit: 3,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.001,
    referenceRate: 46,
  },
  DZD: {
    code: "DZD",
    name: "Algerian dinar",
    symbol: "دج",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 1.1,
  },
  BDT: {
    code: "BDT",
    name: "Bangladeshi taka",
    symbol: "৳",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 1.2,
  },
  LKR: {
    code: "LKR",
    name: "Sri Lankan rupee",
    symbol: "Rs",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 0.48,
  },
  NPR: {
    code: "NPR",
    name: "Nepalese rupee",
    symbol: "रू",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 1.1,
  },
  MMK: {
    code: "MMK",
    name: "Myanmar kyat",
    symbol: "K",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 0.069,
  },
  KHR: {
    code: "KHR",
    name: "Cambodian riel",
    symbol: "៛",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 100,
    referenceRate: 0.036,
  },
  LAK: {
    code: "LAK",
    name: "Lao kip",
    symbol: "₭",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 100,
    referenceRate: 0.0068,
  },
  MNT: {
    code: "MNT",
    name: "Mongolian tugrik",
    symbol: "₮",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 10,
    referenceRate: 0.042,
  },
  AFN: {
    code: "AFN",
    name: "Afghan afghani",
    symbol: "؋",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 2,
  },
  ALL: {
    code: "ALL",
    name: "Albanian lek",
    symbol: "L",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 1.55,
  },
  AMD: {
    code: "AMD",
    name: "Armenian dram",
    symbol: "֏",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 10,
    referenceRate: 0.37,
  },
  AOA: {
    code: "AOA",
    name: "Angolan kwanza",
    symbol: "Kz",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 0.16,
  },
  AZN: {
    code: "AZN",
    name: "Azerbaijani manat",
    symbol: "₼",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 85,
  },
  BAM: {
    code: "BAM",
    name: "Bosnia convertible mark",
    symbol: "KM",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 83,
  },
  BBD: {
    code: "BBD",
    name: "Barbadian dollar",
    symbol: "Bds$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 72,
  },
  BIF: {
    code: "BIF",
    name: "Burundian franc",
    symbol: "FBu",
    minorUnit: 0,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 0.05,
  },
  BMD: {
    code: "BMD",
    name: "Bermudian dollar",
    symbol: "BD$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.01,
    referenceRate: 145,
  },
  BND: {
    code: "BND",
    name: "Brunei dollar",
    symbol: "B$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 111,
  },
  BOB: {
    code: "BOB",
    name: "Bolivian boliviano",
    symbol: "Bs.",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.1,
    referenceRate: 21,
  },
  BSD: {
    code: "BSD",
    name: "Bahamian dollar",
    symbol: "B$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 145,
  },
  BTN: {
    code: "BTN",
    name: "Bhutanese ngultrum",
    symbol: "Nu.",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 1,
    referenceRate: 1.8,
  },
  BWP: {
    code: "BWP",
    name: "Botswana pula",
    symbol: "P",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.1,
    referenceRate: 10.7,
  },
  BYN: {
    code: "BYN",
    name: "Belarusian ruble",
    symbol: "Br",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: " ",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 0.01,
    referenceRate: 44,
  },
  BZD: {
    code: "BZD",
    name: "Belize dollar",
    symbol: "BZ$",
    minorUnit: 2,
    decimalSeparator: ".",
    groupSeparator: ",",
    symbolBefore: true,
    spaceBetween: false,
    cashRounding: 0.05,
    referenceRate: 72,
  },
  CDF: {
    code: "CDF",
    name: "Congolese franc",
    symbol: "FC",
    minorUnit: 2,
    decimalSeparator: ",",
    groupSeparator: ".",
    symbolBefore: false,
    spaceBetween: true,
    cashRounding: 1,
    referenceRate: 0.05,
  },
};

/**
 * 通貨コードから定義を取り出す。
 * @param {string} code
 * @returns {{code: string, name: string, symbol: string, minorUnit: number, decimalSeparator: string, groupSeparator: string, symbolBefore: boolean, spaceBetween: boolean, cashRounding: number, referenceRate: number}}
 */
export function getCurrency(code) {
  const key = String(code).toUpperCase();
  const currency = CURRENCIES[key];
  if (!currency) {
    throw new RangeError(`unknown currency: ${code}`);
  }
  return currency;
}

/**
 * 定義済みの通貨コードを並べたものを返す。
 * @returns {string[]}
 */
export function listCurrencyCodes() {
  return Object.keys(CURRENCIES).sort();
}

/**
 * 通貨コードが定義済みかを返す。
 * @param {string} code
 * @returns {boolean}
 */
export function isCurrency(code) {
  return Object.hasOwn(CURRENCIES, String(code).toUpperCase());
}

/**
 * 最小単位の桁数を返す。JPY は 0、USD は 2、KWD は 3。
 * @param {string} code
 * @returns {number}
 */
export function minorUnitOf(code) {
  return getCurrency(code).minorUnit;
}

/**
 * 通貨記号を返す。
 * @param {string} code
 * @returns {string}
 */
export function currencySymbol(code) {
  return getCurrency(code).symbol;
}

/**
 * 通貨名を返す。
 * @param {string} code
 * @returns {string}
 */
export function currencyName(code) {
  return getCurrency(code).name;
}

/**
 * 最小単位が 1 の通貨（JPY、KRW など）かを返す。
 * @param {string} code
 * @returns {boolean}
 */
export function isZeroDecimal(code) {
  return getCurrency(code).minorUnit === 0;
}

/**
 * 最小単位が 3 桁の通貨（KWD、BHD など）かを返す。
 * @param {string} code
 * @returns {boolean}
 */
export function isThreeDecimal(code) {
  return getCurrency(code).minorUnit === 3;
}

/**
 * 小数の金額を最小単位の整数へ変換する。
 * @param {number|string} amount
 * @param {string} code
 * @returns {number}
 */
export function toMinorUnits(amount, code) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    throw new RangeError("amount must be finite");
  }
  const factor = 10 ** minorUnitOf(code);
  return Math.round(value * factor);
}

/**
 * 最小単位の整数を小数の金額へ変換する。
 * @param {number} minor
 * @param {string} code
 * @returns {number}
 */
export function toMajorUnits(minor, code) {
  const value = Number(minor);
  if (!Number.isFinite(value)) {
    throw new RangeError("minor must be finite");
  }
  return value / 10 ** minorUnitOf(code);
}

/**
 * 最小単位どうしの合計を返す。
 * @param {number[]} values
 * @returns {number}
 */
export function sumMinor(values) {
  return values.reduce((total, value) => total + Number(value), 0);
}

/**
 * 最小単位の値を、その通貨の現金単位に丸める。
 * たとえば AUD の現金単位は 0.05 ドルなので、5 セント刻みにする。
 * @param {number} minor
 * @param {string} code
 * @returns {number}
 */
export function roundCash(minor, code) {
  const currency = getCurrency(code);
  const step = Math.max(1, Math.round(currency.cashRounding * 10 ** currency.minorUnit));
  return Math.round(Number(minor) / step) * step;
}

/**
 * 通貨の参照レート（1 単位あたりの円）を返す。
 * 表示や見積もりのための固定値で、実際の為替ではない。
 * @param {string} code
 * @returns {number}
 */
export function referenceRate(code) {
  return getCurrency(code).referenceRate;
}

/**
 * ある通貨の金額を円の最小単位へ換算する。
 * @param {number} minor
 * @param {string} code
 * @returns {number}
 */
export function toYen(minor, code) {
  return Math.round(toMajorUnits(minor, code) * referenceRate(code));
}

/**
 * 円の金額を別の通貨の最小単位へ換算する。
 * @param {number} yen
 * @param {string} code
 * @returns {number}
 */
export function fromYen(yen, code) {
  return toMinorUnits(Number(yen) / referenceRate(code), code);
}

/**
 * 2 つの通貨の換算比率を返す。from の 1 単位が to の何単位か。
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function exchangeRatio(from, to) {
  return referenceRate(from) / referenceRate(to);
}

/**
 * 通貨をまたぐ金額の換算。最小単位を保ったまま返す。
 * @param {number} minor
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function convertMinor(minor, from, to) {
  const major = toMajorUnits(minor, from);
  return toMinorUnits(major * exchangeRatio(from, to), to);
}

/**
 * 数値を 3 桁ごとの区切り文字で整形する。
 * @param {string} digits
 * @param {string} separator
 * @param {number[]} sizes
 * @returns {string}
 */
export function groupDigits(digits, separator, sizes = [3]) {
  const chars = String(digits).split("");
  const groups = [];
  let index = chars.length;
  let sizeIndex = 0;
  while (index > 0) {
    const size = sizes[Math.min(sizeIndex, sizes.length - 1)];
    const start = Math.max(0, index - size);
    groups.unshift(chars.slice(start, index).join(""));
    index = start;
    sizeIndex += 1;
  }
  return groups.join(separator);
}

/**
 * 通貨記号を含めた表示用の文字列を作る。
 * @param {number} minor
 * @param {string} code
 * @param {{withSymbol?: boolean, withCode?: boolean, signDisplay?: "auto"|"always"|"never"}} [options]
 * @returns {string}
 */
export function formatCurrency(minor, code, options = {}) {
  const currency = getCurrency(code);
  const negative = Number(minor) < 0;
  const absolute = Math.abs(Math.trunc(Number(minor)));
  const factor = 10 ** currency.minorUnit;
  const whole = Math.trunc(absolute / factor);
  const fraction = absolute % factor;
  const wholeText = groupDigits(String(whole), currency.groupSeparator);
  let text = wholeText;
  if (currency.minorUnit > 0) {
    text += currency.decimalSeparator + String(fraction).padStart(currency.minorUnit, "0");
  }
  if (currency.symbolBefore) {
    text = currency.symbol + (currency.spaceBetween ? " " : "") + text;
  } else {
    text = text + (currency.spaceBetween ? " " : "") + currency.symbol;
  }
  if (options.withCode) {
    text = `${text} ${currency.code}`;
  }
  if (negative) {
    return `-${text}`;
  }
  if (options.signDisplay === "always") {
    return `+${text}`;
  }
  return text;
}

/**
 * 小数部を切り捨てて最小単位にそろえる。会計の内部計算用。
 * @param {number} minor
 * @returns {number}
 */
export function truncateMinor(minor) {
  return Math.trunc(Number(minor));
}

/**
 * 最小単位の値を符号つきで比較する。
 * @param {number} left
 * @param {number} right
 * @returns {number}
 */
export function compareMinor(left, right) {
  return Math.sign(Number(left) - Number(right));
}

/**
 * 最小単位の値を 0 以上に制限する。
 * @param {number} minor
 * @returns {number}
 */
export function clampNonNegative(minor) {
  return Math.max(0, Math.trunc(Number(minor)));
}

/**
 * 通貨ごとの現金単位の段数を返す。
 * @param {string} code
 * @returns {number}
 */
export function cashStep(code) {
  const currency = getCurrency(code);
  return Math.max(1, Math.round(currency.cashRounding * 10 ** currency.minorUnit));
}

/**
 * 参照レートの一覧を返す。見積もり画面の表示用。
 * @returns {{code: string, rate: number}[]}
 */
export function referenceRates() {
  return listCurrencyCodes().map((code) => ({ code, rate: referenceRate(code) }));
}

/**
 * 通貨定義の必須項目がそろっているかを確かめる。開発時の検査用。
 * @param {string} code
 * @returns {string[]} 問題の一覧。空なら正しい。
 */
export function validateCurrency(code) {
  const problems = [];
  const currency = CURRENCIES[String(code).toUpperCase()];
  if (!currency) {
    return ["not found"];
  }
  if (currency.code !== String(code).toUpperCase()) problems.push("code mismatch");
  if (currency.minorUnit < 0 || currency.minorUnit > 3) problems.push("minorUnit out of range");
  if (!Number.isFinite(currency.referenceRate) || currency.referenceRate <= 0) {
    problems.push("referenceRate must be positive");
  }
  if (!Number.isFinite(currency.cashRounding) || currency.cashRounding <= 0) {
    problems.push("cashRounding must be positive");
  }
  if (currency.spaceBetween && currency.symbol === "") problems.push("empty symbol");
  return problems;
}

/**
 * すべての通貨定義を検査する。
 * @returns {{code: string, problems: string[]}[]}
 */
export function validateAllCurrencies() {
  return listCurrencyCodes()
    .map((code) => ({ code, problems: validateCurrency(code) }))
    .filter((entry) => entry.problems.length > 0);
}
