const MONTHS = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const LINE_PATTERN =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3}|-)\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"$/;

function extractIp(line) {
  const match = line.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s/);
  return match ? match[1] : null;
}

export function parseTimestamp(value) {
  const match = String(value).match(
    /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2})(\d{2})$/,
  );
  if (!match) return null;
  const [, day, monthName, year, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const month = MONTHS[monthName];
  if (month === undefined) return null;
  const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === "-" ? -1 : 1);
  const utc = Date.UTC(
    Number(year),
    month,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return new Date(utc - offset * 60 * 1000);
}

export function parseLine(line) {
  if (typeof line !== "string") return null;
  const trimmed = line.trim();
  if (trimmed === "") return null;
  const ip = extractIp(trimmed);
  if (!ip) return null;
  const match = trimmed.match(LINE_PATTERN);
  if (!match) return null;
  const [, , user, , timestamp, request, status, bytes, referer, userAgent] = match;
  const parts = request.split(" ");
  const method = parts.length > 0 && parts[0] !== "" ? parts[0] : "";
  const path = parts.length > 1 ? parts[1] : "";
  const protocol = parts.length > 2 ? parts.slice(2).join(" ") : "";
  return {
    ip,
    user: user === "-" ? null : user,
    timestamp: parseTimestamp(timestamp),
    rawTimestamp: timestamp,
    request,
    method,
    path,
    protocol,
    status: status === "-" ? null : Number(status),
    bytes: bytes === "-" ? 0 : Number(bytes),
    referer: referer === "-" ? null : referer,
    userAgent,
  };
}

export function parseLog(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .filter((entry) => entry !== null);
}

export function isClientError(entry) {
  return entry.status !== null && entry.status >= 400 && entry.status < 500;
}

export function isServerError(entry) {
  return entry.status !== null && entry.status >= 500;
}

export function isError(entry) {
  return isClientError(entry) || isServerError(entry);
}

export function statusClass(status) {
  if (status === null) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

export function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = typeof keyFn === "function" ? keyFn(item) : item[keyFn];
    if (key === null || key === undefined) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function sortCounts(counts, options = {}) {
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const direction = options.direction ?? "desc";
  const factor = direction === "asc" ? 1 : -1;
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (left.count !== right.count) return (left.count - right.count) * factor;
      return left.key.localeCompare(right.key);
    })
    .slice(0, limit);
}

export function countByStatus(entries) {
  return countBy(entries, (entry) => entry.status);
}

export function countByStatusClass(entries) {
  return countBy(entries, (entry) => statusClass(entry.status));
}

export function countByMethod(entries) {
  return countBy(entries, (entry) => entry.method || null);
}

export function countByPath(entries) {
  return countBy(entries, (entry) => entry.path || null);
}

export function countByIp(entries) {
  return countBy(entries, (entry) => entry.ip);
}

export function countByDay(entries) {
  return countBy(entries, (entry) => {
    if (!entry.timestamp) return null;
    return entry.timestamp.toISOString().slice(0, 10);
  });
}

export function countByHour(entries) {
  return countBy(entries, (entry) => {
    if (!entry.timestamp) return null;
    return String(entry.timestamp.getUTCHours()).padStart(2, "0");
  });
}

export function topPaths(entries, limit = 5) {
  return sortCounts(countByPath(entries), { limit });
}

export function topIps(entries, limit = 5) {
  return sortCounts(countByIp(entries), { limit });
}

export function errorCount(entries) {
  return entries.filter(isError).length;
}

export function errorRate(entries) {
  if (entries.length === 0) return 0;
  return errorCount(entries) / entries.length;
}

export function totalBytes(entries) {
  return entries.reduce((total, entry) => total + (Number.isFinite(entry.bytes) ? entry.bytes : 0), 0);
}

export function averageBytes(entries) {
  if (entries.length === 0) return 0;
  return totalBytes(entries) / entries.length;
}

export function filterByStatus(entries, status) {
  return entries.filter((entry) => entry.status === status);
}

export function filterByStatusRange(entries, min, max) {
  return entries.filter(
    (entry) => entry.status !== null && entry.status >= min && entry.status <= max,
  );
}

export function filterByMethod(entries, method) {
  const upper = method.toUpperCase();
  return entries.filter((entry) => entry.method === upper);
}

export function filterByPath(entries, path) {
  return entries.filter((entry) => entry.path === path);
}

export function filterByIp(entries, ip) {
  return entries.filter((entry) => entry.ip === ip);
}

export function uniqueIps(entries) {
  return [...new Set(entries.map((entry) => entry.ip))];
}

export function uniquePaths(entries) {
  return [...new Set(entries.map((entry) => entry.path))];
}

export function sumBytesByStatus(entries) {
  const totals = {};
  for (const entry of entries) {
    if (entry.status === null) continue;
    totals[entry.status] = (totals[entry.status] ?? 0) + entry.bytes;
  }
  return totals;
}

export function percent(part, total, decimals = 1) {
  if (total === 0) return "0.0%";
  return `${((part / total) * 100).toFixed(decimals)}%`;
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(entries) {
  return {
    total: entries.length,
    statuses: countByStatus(entries),
    classes: countByStatusClass(entries),
    methods: countByMethod(entries),
    errors: errorCount(entries),
    errorRate: errorRate(entries),
    bytes: totalBytes(entries),
    uniqueIps: uniqueIps(entries).length,
    topPaths: topPaths(entries, 3),
  };
}

export function formatSummary(summary) {
  const lines = [
    `リクエスト: ${summary.total}`,
    `エラー: ${summary.errors} (${percent(summary.errors, summary.total)})`,
    `転送量: ${summary.bytes} bytes`,
    `IP: ${summary.uniqueIps}`,
  ];
  const statuses = Object.entries(summary.statuses).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [status, count] of statuses) {
    lines.push(`${status}: ${count}`);
  }
  return lines.join("\n");
}

export function groupBy(entries, keyFn) {
  const groups = new Map();
  for (const entry of entries) {
    const key = typeof keyFn === "function" ? keyFn(entry) : entry[keyFn];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}

export function slowestByBytes(entries, limit = 5) {
  return [...entries]
    .filter((entry) => Number.isFinite(entry.bytes))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);
}

export function pathsWithErrors(entries) {
  return uniquePaths(entries.filter(isError));
}

export function requestsPerSecond(entries, windowSeconds) {
  if (windowSeconds <= 0) return 0;
  return entries.length / windowSeconds;
}

export function parseLogSafe(text) {
  let parsed = 0;
  let skipped = 0;
  const entries = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const entry = parseLine(line);
    if (entry) {
      entries.push(entry);
      parsed += 1;
    } else {
      skipped += 1;
    }
  }
  return { entries, parsed, skipped };
}

export function compareStatusCounts(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const differences = [];
  for (const key of keys) {
    const a = left[key] ?? 0;
    const b = right[key] ?? 0;
    if (a !== b) differences.push({ status: key, left: a, right: b });
  }
  return differences;
}
