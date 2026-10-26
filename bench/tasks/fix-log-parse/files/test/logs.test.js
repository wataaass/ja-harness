import test from "node:test";
import assert from "node:assert/strict";
import {
  averageBytes,
  countByDay,
  countByMethod,
  countByStatus,
  countByStatusClass,
  errorCount,
  errorRate,
  filterByMethod,
  filterByStatus,
  formatSummary,
  median,
  parseLine,
  parseLog,
  parseLogSafe,
  parseTimestamp,
  percent,
  summarize,
  topPaths,
  totalBytes,
  uniqueIps,
} from "../src/logs.js";

const ipv4Log = [
  '192.168.0.10 - - [10/Oct/2024:13:55:36 +0900] "GET /index.html HTTP/1.1" 200 2326 "-" "Mozilla/5.0"',
  '192.168.0.10 - - [10/Oct/2024:13:55:37 +0900] "GET /api/items HTTP/1.1" 200 512 "-" "Mozilla/5.0"',
  '192.168.0.11 - - [10/Oct/2024:13:56:01 +0900] "POST /api/items HTTP/1.1" 201 128 "-" "curl/8.0"',
  '192.168.0.11 - - [10/Oct/2024:13:57:12 +0900] "GET /missing HTTP/1.1" 404 64 "-" "curl/8.0"',
  '192.168.0.12 - - [10/Oct/2024:13:58:00 +0900] "GET /api/items HTTP/1.1" 500 32 "-" "python-requests/2.31"',
].join("\n");

const mixedLog = [
  ipv4Log,
  '2001:db8::1 - - [10/Oct/2024:14:00:00 +0900] "GET /api/items HTTP/1.1" 503 16 "-" "curl/8.0"',
].join("\n");

test("タイムスタンプを UTC に直す", () => {
  const date = parseTimestamp("10/Oct/2024:13:55:36 +0900");
  assert.equal(date.toISOString(), "2024-10-10T04:55:36.000Z");
  assert.equal(parseTimestamp("invalid"), null);
});

test("1行を項目に分ける", () => {
  const entry = parseLine(ipv4Log.split("\n")[0]);
  assert.equal(entry.ip, "192.168.0.10");
  assert.equal(entry.method, "GET");
  assert.equal(entry.path, "/index.html");
  assert.equal(entry.protocol, "HTTP/1.1");
  assert.equal(entry.status, 200);
  assert.equal(entry.bytes, 2326);
  assert.equal(entry.referer, null);
  assert.equal(entry.userAgent, "Mozilla/5.0");
});

test("空行と壊れた行を飛ばす", () => {
  assert.equal(parseLine(""), null);
  assert.equal(parseLine("not a log line"), null);
  assert.equal(parseLog(`${ipv4Log}\n\n`).length, 5);
});

test("ステータス別の件数", () => {
  const entries = parseLog(ipv4Log);
  assert.deepEqual(countByStatus(entries), { 200: 2, 201: 1, 404: 1, 500: 1 });
});

test("ステータス群別の件数", () => {
  const entries = parseLog(ipv4Log);
  assert.deepEqual(countByStatusClass(entries), { "2xx": 3, "4xx": 1, "5xx": 1 });
});

test("メソッド別の件数", () => {
  const entries = parseLog(ipv4Log);
  assert.deepEqual(countByMethod(entries), { GET: 4, POST: 1 });
});

test("パスの上位", () => {
  const entries = parseLog(ipv4Log);
  assert.deepEqual(topPaths(entries, 2), [
    { key: "/api/items", count: 3 },
    { key: "/index.html", count: 1 },
  ]);
});

test("ステータスとメソッドで絞る", () => {
  const entries = parseLog(ipv4Log);
  assert.equal(filterByStatus(entries, 200).length, 2);
  assert.equal(filterByMethod(entries, "post").length, 1);
});

test("エラー数と割合", () => {
  const entries = parseLog(ipv4Log);
  assert.equal(errorCount(entries), 2);
  assert.equal(errorRate(entries), 2 / 5);
});

test("転送量", () => {
  const entries = parseLog(ipv4Log);
  assert.equal(totalBytes(entries), 2326 + 512 + 128 + 64 + 32);
  assert.equal(averageBytes(entries), (2326 + 512 + 128 + 64 + 32) / 5);
});

test("日付別の件数", () => {
  assert.deepEqual(countByDay(parseLog(ipv4Log)), { "2024-10-10": 5 });
});

test("集計のまとめ", () => {
  const summary = summarize(parseLog(ipv4Log));
  assert.equal(summary.total, 5);
  assert.equal(summary.errors, 2);
  assert.equal(summary.uniqueIps, 3);
  assert.match(formatSummary(summary), /リクエスト: 5/);
});

test("IPv6 の行もステータス別の件数に入る", () => {
  const entries = parseLog(mixedLog);
  assert.deepEqual(countByStatus(entries), { 200: 2, 201: 1, 404: 1, 500: 1, 503: 1 });
});

test("IPv6 の行も IP として数える", () => {
  const entries = parseLog(mixedLog);
  assert.deepEqual(uniqueIps(entries).sort(), ["192.168.0.10", "192.168.0.11", "192.168.0.12", "2001:db8::1"]);
});

test("読み取りの内訳", () => {
  const result = parseLogSafe(mixedLog);
  assert.equal(result.parsed, 6);
  assert.equal(result.skipped, 0);
});

test("中央値と割合", () => {
  assert.equal(median([1, 3, 2, 4]), 2.5);
  assert.equal(median([5]), 5);
  assert.equal(percent(1, 4), "25.0%");
  assert.equal(percent(0, 0), "0.0%");
});
