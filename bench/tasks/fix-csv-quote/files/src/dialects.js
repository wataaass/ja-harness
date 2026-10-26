/**
 * CSV の方言（区切り文字・引用符・日付や数値の書式）の定義。
 *
 * 画面から「日本語」「English (US)」などを選んだときに、読み書きの
 * 既定値をまとめて切り替えるための表。個別の処理は csv.js と
 * writer.js が受け取った方言を見て行う。
 */

export const DIALECTS = {
  "ja": {
    id: "ja",
    label: "Japanese (Japan)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY/MM/DD",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "en-US": {
    id: "en-US",
    label: "English (United States)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "MM/DD/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "en-GB": {
    id: "en-GB",
    label: "English (United Kingdom)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "de-DE": {
    id: "de-DE",
    label: "German (Germany)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "fr-FR": {
    id: "fr-FR",
    label: "French (France)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "es-ES": {
    id: "es-ES",
    label: "Spanish (Spain)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "it-IT": {
    id: "it-IT",
    label: "Italian (Italy)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "pt-BR": {
    id: "pt-BR",
    label: "Portuguese (Brazil)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "nl-NL": {
    id: "nl-NL",
    label: "Dutch (Netherlands)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD-MM-YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "sv-SE": {
    id: "sv-SE",
    label: "Swedish (Sweden)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY-MM-DD",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "no-NO": {
    id: "no-NO",
    label: "Norwegian (Norway)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "da-DK": {
    id: "da-DK",
    label: "Danish (Denmark)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD-MM-YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "fi-FI": {
    id: "fi-FI",
    label: "Finnish (Finland)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "D.M.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "pl-PL": {
    id: "pl-PL",
    label: "Polish (Poland)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "cs-CZ": {
    id: "cs-CZ",
    label: "Czech (Czechia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "D.M.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "sk-SK": {
    id: "sk-SK",
    label: "Slovak (Slovakia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "D.M.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "hu-HU": {
    id: "hu-HU",
    label: "Hungarian (Hungary)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY.MM.DD",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ro-RO": {
    id: "ro-RO",
    label: "Romanian (Romania)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "bg-BG": {
    id: "bg-BG",
    label: "Bulgarian (Bulgaria)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "el-GR": {
    id: "el-GR",
    label: "Greek (Greece)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "tr-TR": {
    id: "tr-TR",
    label: "Turkish (Turkey)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ru-RU": {
    id: "ru-RU",
    label: "Russian (Russia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "uk-UA": {
    id: "uk-UA",
    label: "Ukrainian (Ukraine)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "he-IL": {
    id: "he-IL",
    label: "Hebrew (Israel)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ar-EG": {
    id: "ar-EG",
    label: "Arabic (Egypt)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "fa-IR": {
    id: "fa-IR",
    label: "Persian (Iran)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY/MM/DD",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "hi-IN": {
    id: "hi-IN",
    label: "Hindi (India)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "bn-BD": {
    id: "bn-BD",
    label: "Bengali (Bangladesh)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "th-TH": {
    id: "th-TH",
    label: "Thai (Thailand)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "vi-VN": {
    id: "vi-VN",
    label: "Vietnamese (Vietnam)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "id-ID": {
    id: "id-ID",
    label: "Indonesian (Indonesia)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ms-MY": {
    id: "ms-MY",
    label: "Malay (Malaysia)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "zh-CN": {
    id: "zh-CN",
    label: "Chinese (China)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY-MM-DD",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "zh-TW": {
    id: "zh-TW",
    label: "Chinese (Taiwan)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY/MM/DD",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ko-KR": {
    id: "ko-KR",
    label: "Korean (Korea)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY.MM.DD",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "lt-LT": {
    id: "lt-LT",
    label: "Lithuanian (Lithuania)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY-MM-DD",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "lv-LV": {
    id: "lv-LV",
    label: "Latvian (Latvia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "et-EE": {
    id: "et-EE",
    label: "Estonian (Estonia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "sr-RS": {
    id: "sr-RS",
    label: "Serbian (Serbia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "hr-HR": {
    id: "hr-HR",
    label: "Croatian (Croatia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "sl-SI": {
    id: "sl-SI",
    label: "Slovenian (Slovenia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "sq-AL": {
    id: "sq-AL",
    label: "Albanian (Albania)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "mk-MK": {
    id: "mk-MK",
    label: "Macedonian (North Macedonia)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "is-IS": {
    id: "is-IS",
    label: "Icelandic (Iceland)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ga-IE": {
    id: "ga-IE",
    label: "Irish (Ireland)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "cy-GB": {
    id: "cy-GB",
    label: "Welsh (United Kingdom)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ca-ES": {
    id: "ca-ES",
    label: "Catalan (Spain)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "eu-ES": {
    id: "eu-ES",
    label: "Basque (Spain)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY/MM/DD",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "gl-ES": {
    id: "gl-ES",
    label: "Galician (Spain)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ",",
      group: ".",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "af-ZA": {
    id: "af-ZA",
    label: "Afrikaans (South Africa)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "YYYY/MM/DD",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "sw-KE": {
    id: "sw-KE",
    label: "Swahili (Kenya)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "am-ET": {
    id: "am-ET",
    label: "Amharic (Ethiopia)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD/MM/YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "uz-UZ": {
    id: "uz-UZ",
    label: "Uzbek (Uzbekistan)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "kk-KZ": {
    id: "kk-KZ",
    label: "Kazakh (Kazakhstan)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "az-AZ": {
    id: "az-AZ",
    label: "Azerbaijani (Azerbaijan)",
    delimiter: ";",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ",",
      group: " ",
      minus: "minus",
      parenthesesNegative: true,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "hy-AM": {
    id: "hy-AM",
    label: "Armenian (Armenia)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
  "ka-GE": {
    id: "ka-GE",
    label: "Georgian (Georgia)",
    delimiter: ",",
    quote: "\"",
    newline: "\n",
    dateFormat: "DD.MM.YYYY",
    numberFormat: {
      decimal: ".",
      group: ",",
      minus: "minus",
      parenthesesNegative: false,
    },
    header: true,
    trim: false,
    skipEmptyLines: false,
    booleans: {
      true: ["true", "yes", "1"],
      false: ["false", "no", "0"],
    },
    nullValues: ["", "null", "NULL"],
    encoding: "utf-8",
  },
};

/**
 * 方言 ID から定義を取り出す。
 * @param {string} id
 * @returns {object}
 */
export function getDialect(id) {
  const dialect = DIALECTS[String(id)];
  if (!dialect) {
    throw new RangeError(`unknown dialect: ${id}`);
  }
  return dialect;
}

/**
 * 方言 ID が定義済みかを返す。
 * @param {string} id
 * @returns {boolean}
 */
export function hasDialect(id) {
  return Object.hasOwn(DIALECTS, String(id));
}

/**
 * 定義済みの方言 ID を返す。
 * @returns {string[]}
 */
export function dialectIds() {
  return Object.keys(DIALECTS).sort();
}

/**
 * 方言の一覧を、画面用の {id, label} の配列で返す。
 * @returns {{id: string, label: string}[]}
 */
export function dialectOptions() {
  return dialectIds().map((id) => ({ id, label: DIALECTS[id].label }));
}

/**
 * 方言の区切り文字を返す。
 * @param {string} id
 * @returns {string}
 */
export function delimiterOf(id) {
  return getDialect(id).delimiter;
}

/**
 * 方言の引用符を返す。
 * @param {string} id
 * @returns {string}
 */
export function quoteOf(id) {
  return getDialect(id).quote;
}

/**
 * 方言の改行コードを返す。
 * @param {string} id
 * @returns {string}
 */
export function newlineOf(id) {
  return getDialect(id).newline;
}

/**
 * 方言の日付書式を返す。
 * @param {string} id
 * @returns {string}
 */
export function dateFormatOf(id) {
  return getDialect(id).dateFormat;
}

/**
 * 方言の小数記号を返す。
 * @param {string} id
 * @returns {string}
 */
export function decimalSeparatorOf(id) {
  return getDialect(id).numberFormat.decimal;
}

/**
 * 方言の桁区切り記号を返す。
 * @param {string} id
 * @returns {string}
 */
export function groupSeparatorOf(id) {
  return getDialect(id).numberFormat.group;
}

/**
 * 方言の「括弧書きの負数」を使うかを返す。
 * @param {string} id
 * @returns {boolean}
 */
export function usesParenthesesNegative(id) {
  return getDialect(id).numberFormat.parenthesesNegative;
}

/**
 * 方言の真偽値の表し方を返す。
 * @param {string} id
 * @returns {{true: string[], false: string[]}}
 */
export function booleansOf(id) {
  return getDialect(id).booleans;
}

/**
 * 方言の null 表現を返す。
 * @param {string} id
 * @returns {string[]}
 */
export function nullValuesOf(id) {
  return getDialect(id).nullValues;
}

/**
 * 方言の読み込みオプションを返す。
 * @param {string} id
 * @returns {{delimiter: string, quote: string, trim: boolean, skipEmptyLines: boolean}}
 */
export function readOptionsOf(id) {
  const dialect = getDialect(id);
  return {
    delimiter: dialect.delimiter,
    quote: dialect.quote,
    trim: dialect.trim,
    skipEmptyLines: dialect.skipEmptyLines,
  };
}

/**
 * 方言の書き込みオプションを返す。
 * @param {string} id
 * @returns {{delimiter: string, quote: string, newline: string, trailingNewline: boolean}}
 */
export function writeOptionsOf(id) {
  const dialect = getDialect(id);
  return {
    delimiter: dialect.delimiter,
    quote: dialect.quote,
    newline: dialect.newline,
    trailingNewline: true,
  };
}

/**
 * 日付書式から、年月日の並び順を返す。
 * @param {string} id
 * @returns {"YMD"|"DMY"|"MDY"}
 */
export function dateOrderOf(id) {
  const format = dateFormatOf(id);
  const positions = [
    { key: "Y", index: format.indexOf("Y") },
    { key: "M", index: format.indexOf("M") },
    { key: "D", index: format.indexOf("D") },
  ].sort((left, right) => left.index - right.index);
  return positions.map((item) => item.key).join("");
}

/**
 * 数値の書式をそろえた表示用の設定を返す。
 * @param {string} id
 * @param {{decimals?: number}} [options]
 * @returns {{decimal: string, group: string, decimals: number, parenthesesNegative: boolean}}
 */
export function numberStyleOf(id, options = {}) {
  const dialect = getDialect(id);
  return {
    decimal: dialect.numberFormat.decimal,
    group: dialect.numberFormat.group,
    decimals: options.decimals ?? 2,
    parenthesesNegative: dialect.numberFormat.parenthesesNegative,
  };
}

/**
 * 2 つの方言で区切り文字が同じかを返す。
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
export function sameDelimiter(left, right) {
  return delimiterOf(left) === delimiterOf(right);
}

/**
 * 2 つの方言で日付の並び順が同じかを返す。
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
export function sameDateOrder(left, right) {
  return dateOrderOf(left) === dateOrderOf(right);
}

/**
 * 方言の定義を検証する。
 * @param {string} id
 * @returns {string[]}
 */
export function validateDialect(id) {
  const dialect = DIALECTS[String(id)];
  if (!dialect) {
    return ["not found"];
  }
  const problems = [];
  if (dialect.delimiter.length !== 1) problems.push("delimiter must be one character");
  if (dialect.quote.length !== 1) problems.push("quote must be one character");
  if (!["\n", "\r\n"].includes(dialect.newline)) problems.push("newline is unusual");
  if (!/^[YMD/.-]+$/.test(dialect.dateFormat)) problems.push("dateFormat is unusual");
  if (dialect.numberFormat.decimal === dialect.numberFormat.group) {
    problems.push("decimal and group must differ");
  }
  return problems;
}

/**
 * すべての方言を検証する。
 * @returns {{id: string, problems: string[]}[]}
 */
export function validateAllDialects() {
  return dialectIds()
    .map((id) => ({ id, problems: validateDialect(id) }))
    .filter((entry) => entry.problems.length > 0);
}

/**
 * 区切り文字ごとの方言をまとめる。
 * @returns {Record<string, string[]>}
 */
export function dialectsByDelimiter() {
  const groups = {};
  for (const id of dialectIds()) {
    const delimiter = delimiterOf(id);
    groups[delimiter] = groups[delimiter] ?? [];
    groups[delimiter].push(id);
  }
  return groups;
}

/**
 * 日付の並び順ごとの方言をまとめる。
 * @returns {Record<string, string[]>}
 */
export function dialectsByDateOrder() {
  const groups = {};
  for (const id of dialectIds()) {
    const order = dateOrderOf(id);
    groups[order] = groups[order] ?? [];
    groups[order].push(id);
  }
  return groups;
}
