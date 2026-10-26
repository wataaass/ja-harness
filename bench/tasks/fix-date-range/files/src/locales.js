/**
 * 画面に出す日付の書式と、月・曜日の名前の定義。
 *
 * 日付そのものの計算は dates.js、差分は diff.js、月の加算は
 * months.js、週番号は weeks.js が受け持つ。このファイルは表示の
 * ためのデータだけを持つ。
 */

export const LOCALES = {
  "ja-JP": {
    id: "ja-JP",
    label: "日本語 (日本)",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
    monthNamesShort: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
    weekdayNames: ["日曜日","月曜日","火曜日","水曜日","木曜日","金曜日","土曜日"],
    weekdayNamesShort: ["日","月","火","水","木","金","土"],
    am: "午前",
    pm: "午後",
  },
  "en-US": {
    id: "en-US",
    label: "English (United States)",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "en-GB": {
    id: "en-GB",
    label: "English (United Kingdom)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "en-AU": {
    id: "en-AU",
    label: "English (Australia)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "en-CA": {
    id: "en-CA",
    label: "English (Canada)",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "en-IN": {
    id: "en-IN",
    label: "English (India)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "de-DE": {
    id: "de-DE",
    label: "Deutsch (Deutschland)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "fr-FR": {
    id: "fr-FR",
    label: "Français (France)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "es-ES": {
    id: "es-ES",
    label: "Español (España)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "it-IT": {
    id: "it-IT",
    label: "Italiano (Italia)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "pt-BR": {
    id: "pt-BR",
    label: "Português (Brasil)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "nl-NL": {
    id: "nl-NL",
    label: "Nederlands (Nederland)",
    dateFormat: "DD-MM-YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "sv-SE": {
    id: "sv-SE",
    label: "Svenska (Sverige)",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "no-NO": {
    id: "no-NO",
    label: "Norsk (Norge)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "da-DK": {
    id: "da-DK",
    label: "Dansk (Danmark)",
    dateFormat: "DD-MM-YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "fi-FI": {
    id: "fi-FI",
    label: "Suomi (Suomi)",
    dateFormat: "D.M.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "pl-PL": {
    id: "pl-PL",
    label: "Polski (Polska)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "cs-CZ": {
    id: "cs-CZ",
    label: "Čeština (Česko)",
    dateFormat: "D.M.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "sk-SK": {
    id: "sk-SK",
    label: "Slovenčina (Slovensko)",
    dateFormat: "D.M.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "hu-HU": {
    id: "hu-HU",
    label: "Magyar (Magyarország)",
    dateFormat: "YYYY.MM.DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ro-RO": {
    id: "ro-RO",
    label: "Română (România)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "bg-BG": {
    id: "bg-BG",
    label: "Български (България)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "el-GR": {
    id: "el-GR",
    label: "Ελληνικά (Ελλάδα)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "tr-TR": {
    id: "tr-TR",
    label: "Türkçe (Türkiye)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ru-RU": {
    id: "ru-RU",
    label: "Русский (Россия)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "uk-UA": {
    id: "uk-UA",
    label: "Українська (Україна)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "he-IL": {
    id: "he-IL",
    label: "עברית (ישראל)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [5, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ar-EG": {
    id: "ar-EG",
    label: "العربية (مصر)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 6,
    weekend: [5, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "fa-IR": {
    id: "fa-IR",
    label: "فارسی (ایران)",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 6,
    weekend: [5],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "hi-IN": {
    id: "hi-IN",
    label: "हिन्दी (भारत)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "bn-BD": {
    id: "bn-BD",
    label: "বাংলা (বাংলাদেশ)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [5, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "th-TH": {
    id: "th-TH",
    label: "ไทย (ประเทศไทย)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "vi-VN": {
    id: "vi-VN",
    label: "Tiếng Việt (Việt Nam)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "id-ID": {
    id: "id-ID",
    label: "Bahasa Indonesia (Indonesia)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ms-MY": {
    id: "ms-MY",
    label: "Bahasa Melayu (Malaysia)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "zh-CN": {
    id: "zh-CN",
    label: "中文 (中国)",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "zh-TW": {
    id: "zh-TW",
    label: "中文 (台灣)",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ko-KR": {
    id: "ko-KR",
    label: "한국어 (대한민국)",
    dateFormat: "YYYY.MM.DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "lt-LT": {
    id: "lt-LT",
    label: "Lietuvių (Lietuva)",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "lv-LV": {
    id: "lv-LV",
    label: "Latviešu (Latvija)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "et-EE": {
    id: "et-EE",
    label: "Eesti (Eesti)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "sr-RS": {
    id: "sr-RS",
    label: "Српски (Србија)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "hr-HR": {
    id: "hr-HR",
    label: "Hrvatski (Hrvatska)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "sl-SI": {
    id: "sl-SI",
    label: "Slovenščina (Slovenija)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "sq-AL": {
    id: "sq-AL",
    label: "Shqip (Shqipëri)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "mk-MK": {
    id: "mk-MK",
    label: "Македонски (Македонија)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "is-IS": {
    id: "is-IS",
    label: "Íslenska (Ísland)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ga-IE": {
    id: "ga-IE",
    label: "Gaeilge (Éire)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "cy-GB": {
    id: "cy-GB",
    label: "Cymraeg (Y Deyrnas Unedig)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ca-ES": {
    id: "ca-ES",
    label: "Català (Espanya)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "eu-ES": {
    id: "eu-ES",
    label: "Euskara (Espainia)",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "gl-ES": {
    id: "gl-ES",
    label: "Galego (España)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "af-ZA": {
    id: "af-ZA",
    label: "Afrikaans (Suid-Afrika)",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "sw-KE": {
    id: "sw-KE",
    label: "Kiswahili (Kenya)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "am-ET": {
    id: "am-ET",
    label: "አማርኛ (ኢትዮጵያ)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "uz-UZ": {
    id: "uz-UZ",
    label: "Oʻzbek (Oʻzbekiston)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "kk-KZ": {
    id: "kk-KZ",
    label: "Қазақ (Қазақстан)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "az-AZ": {
    id: "az-AZ",
    label: "Azərbaycan (Azərbaycan)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "hy-AM": {
    id: "hy-AM",
    label: "Հայերեն (Հայաստան)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ka-GE": {
    id: "ka-GE",
    label: "ქართული (საქართველო)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "mn-MN": {
    id: "mn-MN",
    label: "Монгол (Монгол)",
    dateFormat: "YYYY.MM.DD",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ne-NP": {
    id: "ne-NP",
    label: "नेपाली (नेपाल)",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "si-LK": {
    id: "si-LK",
    label: "සිංහල (ශ්‍රී ලංකා)",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "km-KH": {
    id: "km-KH",
    label: "ខ្មែរ (កម្ពុជា)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "lo-LA": {
    id: "lo-LA",
    label: "ລາວ (ລາວ)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "my-MM": {
    id: "my-MM",
    label: "မြန်မာ (မြန်မာ)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "tl-PH": {
    id: "tl-PH",
    label: "Tagalog (Pilipinas)",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "h:mm A",
    firstDayOfWeek: 0,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "mt-MT": {
    id: "mt-MT",
    label: "Malti (Malta)",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "lb-LU": {
    id: "lb-LU",
    label: "Lëtzebuergesch (Lëtzebuerg)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "bs-BA": {
    id: "bs-BA",
    label: "Bosanski (Bosna i Hercegovina)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "me-ME": {
    id: "me-ME",
    label: "Crnogorski (Crna Gora)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "be-BY": {
    id: "be-BY",
    label: "Беларуская (Беларусь)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "ky-KG": {
    id: "ky-KG",
    label: "Кыргызча (Кыргызстан)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "tg-TJ": {
    id: "tg-TJ",
    label: "Тоҷикӣ (Тоҷикистон)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
  "tk-TM": {
    id: "tk-TM",
    label: "Türkmen (Türkmenistan)",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "HH:mm",
    firstDayOfWeek: 1,
    weekend: [0, 6],
    monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    weekdayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    weekdayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    am: "AM",
    pm: "PM",
  },
};

/**
 * ロケール ID から定義を取り出す。
 * @param {string} id
 * @returns {object}
 */
export function getLocale(id) {
  const locale = LOCALES[String(id)];
  if (!locale) {
    throw new RangeError(`unknown locale: ${id}`);
  }
  return locale;
}

/**
 * 定義済みのロケール ID を返す。
 * @returns {string[]}
 */
export function localeIds() {
  return Object.keys(LOCALES).sort();
}

/**
 * 画面用のロケール一覧を返す。
 * @returns {{id: string, label: string}[]}
 */
export function localeOptions() {
  return localeIds().map((id) => ({ id, label: LOCALES[id].label }));
}

/**
 * 月の名前を返す。month は 0 始まり。
 * @param {string} id
 * @param {number} month
 * @param {{short?: boolean}} [options]
 * @returns {string}
 */
export function monthName(id, month, options = {}) {
  const locale = getLocale(id);
  const index = Number(month);
  if (!Number.isInteger(index) || index < 0 || index > 11) {
    throw new RangeError("month must be between 0 and 11");
  }
  return options.short ? locale.monthNamesShort[index] : locale.monthNames[index];
}

/**
 * 曜日の名前を返す。day は 0（日曜）〜6（土曜）。
 * @param {string} id
 * @param {number} day
 * @param {{short?: boolean}} [options]
 * @returns {string}
 */
export function localeWeekdayName(id, day, options = {}) {
  const locale = getLocale(id);
  const index = Number(day);
  if (!Number.isInteger(index) || index < 0 || index > 6) {
    throw new RangeError("day must be between 0 and 6");
  }
  return options.short ? locale.weekdayNamesShort[index] : locale.weekdayNames[index];
}

/**
 * 週の始まりの曜日を返す。0 が日曜日。
 * @param {string} id
 * @returns {number}
 */
export function firstDayOfWeek(id) {
  return getLocale(id).firstDayOfWeek;
}

/**
 * 週末の曜日を返す。
 * @param {string} id
 * @returns {number[]}
 */
export function weekendDays(id) {
  return [...getLocale(id).weekend];
}

/**
 * 指定した曜日が週末かを返す。
 * @param {string} id
 * @param {number} day
 * @returns {boolean}
 */
export function isWeekend(id, day) {
  return weekendDays(id).includes(Number(day));
}

/**
 * ロケールの日付書式を返す。
 * @param {string} id
 * @returns {string}
 */
export function localeDateFormat(id) {
  return getLocale(id).dateFormat;
}

/**
 * ロケールの時刻書式を返す。
 * @param {string} id
 * @returns {string}
 */
export function localeTimeFormat(id) {
  return getLocale(id).timeFormat;
}

/**
 * 午前・午後の表記を返す。
 * @param {string} id
 * @returns {{am: string, pm: string}}
 */
export function meridiemOf(id) {
  const locale = getLocale(id);
  return { am: locale.am, pm: locale.pm };
}

/**
 * 24 時間制かを返す。
 * @param {string} id
 * @returns {boolean}
 */
export function uses24HourClock(id) {
  return !getLocale(id).timeFormat.includes("A");
}

/**
 * 日付の書式の並び順を返す。
 * @param {string} id
 * @returns {"YMD"|"DMY"|"MDY"|"OTHER"}
 */
export function localeDateOrder(id) {
  const format = localeDateFormat(id);
  const parts = [
    { key: "Y", index: format.indexOf("Y") },
    { key: "M", index: format.indexOf("M") },
    { key: "D", index: format.indexOf("D") },
  ].sort((left, right) => left.index - right.index);
  const order = parts.map((part) => part.key).join("");
  return order === "YMD" || order === "DMY" || order === "MDY" ? order : "OTHER";
}

/**
 * 週の始まりが同じロケールをまとめる。
 * @returns {Record<string, string[]>}
 */
export function localesByFirstDay() {
  const groups = {};
  for (const id of localeIds()) {
    const key = String(firstDayOfWeek(id));
    groups[key] = groups[key] ?? [];
    groups[key].push(id);
  }
  return groups;
}

/**
 * 日付の並び順が同じロケールをまとめる。
 * @returns {Record<string, string[]>}
 */
export function localesByDateOrder() {
  const groups = {};
  for (const id of localeIds()) {
    const key = localeDateOrder(id);
    groups[key] = groups[key] ?? [];
    groups[key].push(id);
  }
  return groups;
}

/**
 * ロケール定義を検証する。
 * @param {string} id
 * @returns {string[]}
 */
export function validateLocale(id) {
  const locale = LOCALES[String(id)];
  if (!locale) {
    return ["not found"];
  }
  const problems = [];
  if (locale.monthNames.length !== 12) problems.push("monthNames must have 12 items");
  if (locale.monthNamesShort.length !== 12) problems.push("monthNamesShort must have 12 items");
  if (locale.weekdayNames.length !== 7) problems.push("weekdayNames must have 7 items");
  if (locale.weekdayNamesShort.length !== 7) problems.push("weekdayNamesShort must have 7 items");
  if (locale.firstDayOfWeek < 0 || locale.firstDayOfWeek > 6) {
    problems.push("firstDayOfWeek out of range");
  }
  if (locale.weekend.some((day) => day < 0 || day > 6)) problems.push("weekend out of range");
  return problems;
}

/**
 * すべてのロケールを検証する。
 * @returns {{id: string, problems: string[]}[]}
 */
export function validateAllLocales() {
  return localeIds()
    .map((id) => ({ id, problems: validateLocale(id) }))
    .filter((entry) => entry.problems.length > 0);
}
