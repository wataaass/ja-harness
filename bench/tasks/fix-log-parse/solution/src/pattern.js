import { isIP } from "node:net";
import { parseISOTimestamp, parseTimestamp } from "./timestamp.js";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const LINE_PATTERN =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+"([^"]*)"\s+(\S+)\s+(\S+)(?:\s+"([^"]*)"\s+"([^"]*)")?\s*$/;

/**
 * アドレスの文字列を検査する。IPv4 と IPv6 の両方を受け付ける。
 * 前後の空白は落とし、空文字や明らかにおかしい値は null。
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function parseAddress(value) {
  const text = String(value ?? "").trim();
  if (text === "") {
    return null;
  }
  if (text.includes(":")) {
    return isIP(text) === 6 ? text : null;
  }
  const match = text.match(IPV4);
  if (!match) {
    return null;
  }
  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => octet > 255)) {
    return null;
  }
  return text;
}

/**
 * リクエスト行を、メソッド・パス・プロトコルに分ける。
 * @param {string} request
 * @returns {{method: string, path: string, protocol: string}}
 */
export function splitRequest(request) {
  const text = String(request ?? "").trim();
  if (text === "") {
    return { method: "", path: "", protocol: "" };
  }
  const parts = text.split(/\s+/);
  return {
    method: parts[0] ?? "",
    path: parts[1] ?? "",
    protocol: parts.slice(2).join(" "),
  };
}

/**
 * 1 行を読み取る。読めない行は null。
 *
 * 先頭は IPv4 でも IPv6 でもよい。IPv6 は `2001:db8::1` や
 * `::1` のように圧縮された形もそのまま受け付ける。
 *
 * @param {unknown} line
 * @returns {object|null}
 */
export function parseLine(line) {
  if (typeof line !== "string") {
    return null;
  }
  const text = line.trim();
  if (text === "") {
    return null;
  }
  const match = text.match(LINE_PATTERN);
  if (!match) {
    return null;
  }
  const ip = parseAddress(match[1]);
  if (ip === null) {
    return null;
  }
  const [, , user, , time, request, status, bytes, referer, agent] = match;
  const parsedRequest = splitRequest(request);
  return {
    ip,
    user: user === "-" ? null : user,
    rawTimestamp: time,
    timestamp: parseTimestamp(time) ?? parseISOTimestamp(time),
    request,
    method: parsedRequest.method,
    path: parsedRequest.path,
    protocol: parsedRequest.protocol,
    status: status === "-" ? null : Number(status),
    bytes: bytes === "-" ? 0 : Number(bytes),
    referer: referer === undefined || referer === "-" ? null : referer,
    userAgent: agent ?? "",
    raw: text,
  };
}

/**
 * 行がログの形をしていそうかを返す。中身の検証はしない。
 * @param {unknown} line
 * @returns {boolean}
 */
export function looksLikeLogLine(line) {
  return typeof line === "string" && /^\S+\s+\S+\s+\S+\s+\[[^\]]*\]\s+"/.test(line.trim());
}

/**
 * 行の区切り文字を数える。空行は 0。
 * @param {unknown} line
 * @returns {number}
 */
export function tokenCount(line) {
  return String(line ?? "")
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "").length;
}

/**
 * 引用符で囲まれた部分を取り出す。
 * @param {string} line
 * @returns {string[]}
 */
export function quotedParts(line) {
  const parts = [];
  const pattern = /"([^"]*)"/g;
  let match = pattern.exec(String(line));
  while (match !== null) {
    parts.push(match[1]);
    match = pattern.exec(String(line));
  }
  return parts;
}

/**
 * 角括弧で囲まれた部分を取り出す。
 * @param {string} line
 * @returns {string|null}
 */
export function bracketedPart(line) {
  const match = String(line).match(/\[([^\]]*)\]/);
  return match === null ? null : match[1];
}

/**
 * 行の先頭のアドレスを返す。読めなければ null。
 * @param {string} line
 * @returns {string|null}
 */
export function addressOf(line) {
  const token = String(line ?? "").trim().split(/\s+/)[0] ?? "";
  return parseAddress(token);
}

/**
 * 行のステータスコードを返す。読めなければ null。
 * @param {string} line
 * @returns {number|null}
 */
export function statusOf(line) {
  const entry = parseLine(line);
  return entry === null ? null : entry.status;
}

/**
 * 行のバイト数を返す。読めなければ null。
 * @param {string} line
 * @returns {number|null}
 */
export function bytesOf(line) {
  const entry = parseLine(line);
  return entry === null ? null : entry.bytes;
}

/**
 * 行のパスを返す。読めなければ null。
 * @param {string} line
 * @returns {string|null}
 */
export function pathOf(line) {
  const entry = parseLine(line);
  return entry === null ? null : entry.path;
}

/**
 * 行の時刻を返す。読めなければ null。
 * @param {string} line
 * @returns {Date|null}
 */
export function timeOf(line) {
  const entry = parseLine(line);
  return entry === null ? null : entry.timestamp;
}

/**
 * 行の IP の種類を返す。読めなければ "unknown"。
 * @param {string} line
 * @returns {"ipv4"|"ipv6"|"unknown"}
 */
export function addressKindOf(line) {
  const address = addressOf(line);
  if (address === null) {
    return "unknown";
  }
  return address.includes(":") ? "ipv6" : "ipv4";
}

/**
 * 行を JSON として読む。JSON でなければ null。
 * @param {string} line
 * @returns {object|null}
 */
export function parseJsonLine(line) {
  const text = String(line ?? "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) {
    return null;
  }
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : null;
  } catch {
    return null;
  }
}

/**
 * 行を区切りの空白で分ける。引用符の中は分けない。
 * @param {string} line
 * @returns {string[]}
 */
export function splitFields(line) {
  const fields = [];
  let current = "";
  let quoted = false;
  for (const char of String(line).trim()) {
    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (/\s/.test(char) && !quoted) {
      if (current !== "") {
        fields.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current !== "") {
    fields.push(current);
  }
  return fields;
}
