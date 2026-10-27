/**
 * アクセスログの集計。
 *
 * 日付のキーは `YYYY-MM-DD`（月と日は 0 詰め）で返す。タイムゾーンは
 * タイムスタンプを UTC に直したあとの日付を使う。
 */

/**
 * ステータスコードがエラー（400 以上）かを返す。
 * @param {number|null} status
 * @returns {boolean}
 */
export function isErrorStatus(status) {
  return typeof status === "number" && status >= 400;
}

/**
 * クライアントエラー（4xx）かを返す。
 * @param {number|null} status
 * @returns {boolean}
 */
export function isClientError(status) {
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * サーバーエラー（5xx）かを返す。
 * @param {number|null} status
 * @returns {boolean}
 */
export function isServerError(status) {
  return typeof status === "number" && status >= 500;
}

/**
 * ステータスの分類を返す。
 * @param {number|null} status
 * @returns {string}
 */
export function statusClass(status) {
  if (status === null || status === undefined) {
    return "unknown";
  }
  return `${Math.floor(Number(status) / 100)}xx`;
}

/**
 * 値を数える。
 * @param {object[]} entries
 * @param {(entry: object) => unknown} keyFn
 * @returns {Record<string, number>}
 */
export function countBy(entries, keyFn) {
  const counts = {};
  for (const entry of entries) {
    const key = keyFn(entry);
    if (key === null || key === undefined) {
      continue;
    }
    const text = String(key);
    counts[text] = (counts[text] ?? 0) + 1;
  }
  return counts;
}

/**
 * ステータス別の件数を返す。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function countByStatus(entries) {
  return countBy(entries, (entry) => entry.status);
}

/**
 * ステータス群（2xx、4xx など）別の件数を返す。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function countByStatusClass(entries) {
  return countBy(entries, (entry) => statusClass(entry.status));
}

/**
 * メソッド別の件数を返す。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function countByMethod(entries) {
  return countBy(entries, (entry) => entry.method);
}

/**
 * パス別の件数を返す。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function countByPath(entries) {
  return countBy(entries, (entry) => entry.path);
}

/**
 * IP 別の件数を返す。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function countByIp(entries) {
  return countBy(entries, (entry) => entry.ip);
}

/**
 * 日付別の件数を返す。
 *
 * キーは `YYYY-MM-DD` の形で、月と日は 2 桁に 0 詰めする。
 * 時刻は UTC に直したものを使う。
 *
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function countByDay(entries) {
  const counts = {};
  for (const entry of entries) {
    if (!(entry.timestamp instanceof Date) || Number.isNaN(entry.timestamp.getTime())) {
      continue;
    }
    const year = entry.timestamp.getUTCFullYear();
    const month = entry.timestamp.getUTCMonth();
    const day = entry.timestamp.getUTCDate();
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * 時間別の件数を返す。キーは 2 桁の時（00〜23）。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function countByHour(entries) {
  const counts = {};
  for (const entry of entries) {
    if (!(entry.timestamp instanceof Date)) {
      continue;
    }
    const key = String(entry.timestamp.getUTCHours()).padStart(2, "0");
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * 重複を除いた IP の一覧を返す。
 * @param {object[]} entries
 * @returns {string[]}
 */
export function uniqueIps(entries) {
  return [...new Set(entries.map((entry) => entry.ip).filter(Boolean))];
}

/**
 * エラーの件数を返す。
 * @param {object[]} entries
 * @returns {number}
 */
export function errorCount(entries) {
  return entries.filter((entry) => isErrorStatus(entry.status)).length;
}

/**
 * エラーの割合を返す。0〜1。
 * @param {object[]} entries
 * @returns {number}
 */
export function errorRate(entries) {
  if (entries.length === 0) {
    return 0;
  }
  return errorCount(entries) / entries.length;
}

/**
 * 割合を百分率の文字列にする。
 * @param {number} part
 * @param {number} total
 * @param {number} [decimals]
 * @returns {string}
 */
export function percent(part, total, decimals = 1) {
  if (total === 0) {
    return "0%";
  }
  return `${((part / total) * 100).toFixed(decimals)}%`;
}

/**
 * ステータスで絞り込む。
 * @param {object[]} entries
 * @param {number} status
 * @returns {object[]}
 */
export function filterByStatus(entries, status) {
  return entries.filter((entry) => entry.status === status);
}

/**
 * ステータス群で絞り込む。
 * @param {object[]} entries
 * @param {string} name
 * @returns {object[]}
 */
export function filterByStatusClass(entries, name) {
  return entries.filter((entry) => statusClass(entry.status) === name);
}

/**
 * メソッドで絞り込む。
 * @param {object[]} entries
 * @param {string} method
 * @returns {object[]}
 */
export function filterByMethod(entries, method) {
  return entries.filter((entry) => entry.method === String(method).toUpperCase());
}

/**
 * パスの前方一致で絞り込む。
 * @param {object[]} entries
 * @param {string} prefix
 * @returns {object[]}
 */
export function filterByPathPrefix(entries, prefix) {
  return entries.filter((entry) => entry.path.startsWith(prefix));
}

/**
 * 日付で絞り込む。日付は `YYYY-MM-DD`。
 * @param {object[]} entries
 * @param {string} key
 * @returns {object[]}
 */
export function filterByDay(entries, key) {
  return entries.filter((entry) => {
    if (!(entry.timestamp instanceof Date)) {
      return false;
    }
    const year = entry.timestamp.getUTCFullYear();
    const month = String(entry.timestamp.getUTCMonth() + 1).padStart(2, "0");
    const day = String(entry.timestamp.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}` === key;
  });
}

/**
 * 件数の多い順に並べる。
 * @param {Record<string, number>} counts
 * @param {number} [limit]
 * @returns {{key: string, count: number}[]}
 */
export function topCounts(counts, limit = 10) {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.key.localeCompare(right.key);
    })
    .slice(0, limit);
}

/**
 * 集計のまとめを返す。
 * @param {object[]} entries
 * @returns {object}
 */
export function summarize(entries) {
  return {
    total: entries.length,
    uniqueIps: uniqueIps(entries).length,
    errors: errorCount(entries),
    errorRate: errorRate(entries),
    statuses: countByStatus(entries),
    methods: countByMethod(entries),
    days: countByDay(entries),
  };
}

/**
 * 日別のエラー数を返す。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function errorsByDay(entries) {
  return countByDay(entries.filter((entry) => isErrorStatus(entry.status)));
}

/**
 * 時間帯ごとのエラー率を返す。
 * @param {object[]} entries
 * @returns {Record<string, number>}
 */
export function hourlyErrorRate(entries) {
  const totals = countByHour(entries);
  const errors = countByHour(entries.filter((entry) => isErrorStatus(entry.status)));
  const result = {};
  for (const [hour, total] of Object.entries(totals)) {
    result[hour] = (errors[hour] ?? 0) / total;
  }
  return result;
}
