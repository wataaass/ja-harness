import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countByDay,
  countByIp,
  countByMethod,
  countByStatus,
  countByStatusClass,
  errorCount,
  errorRate,
  filterByStatus,
  parseLine,
  parseLog,
  parseLogSafe,
  parseTimestamp,
  percent,
  statusClass,
  uniqueIps,
} from "../src/logs.js";

const mixedLog = [
  '192.168.0.10 - - [10/Oct/2024:13:55:36 +0900] "GET /index.html HTTP/1.1" 200 2326 "-" "Mozilla/5.0"',
  '2001:db8::1 - - [10/Oct/2024:13:55:37 +0900] "GET /api/items HTTP/1.1" 503 16 "-" "curl/8.0"',
  '2001:db8:0:1::42 - - [10/Oct/2024:13:55:38 +0900] "POST /api/items HTTP/1.1" 201 128 "-" "curl/8.0"',
  '::1 - - [10/Oct/2024:13:55:39 +0900] "GET /missing HTTP/1.1" 404 64 "-" "curl/8.0"',
  'fe80::1 - - [10/Oct/2024:13:55:40 +0900] "GET /api/items HTTP/1.1" 200 256 "-" "curl/8.0"',
  '192.168.0.11 - - [10/Oct/2024:13:55:41 +0900] "DELETE /api/items/1 HTTP/1.1" 500 32 "-" "curl/8.0"',
].join("\n");

test("IPv6 の行を読める", () => {
  const entry = parseLine(mixedLog.split("\n")[1]);
  assert.ok(entry);
  assert.equal(entry.ip, "2001:db8::1");
  assert.equal(entry.status, 503);
  assert.equal(entry.path, "/api/items");
});

test("IPv6 の短縮形とループバックを読める", () => {
  const lines = mixedLog.split("\n");
  assert.equal(parseLine(lines[2]).ip, "2001:db8:0:1::42");
  assert.equal(parseLine(lines[3]).ip, "::1");
  assert.equal(parseLine(lines[4]).ip, "fe80::1");
});

test("混在ログのステータス別件数", () => {
  assert.deepEqual(countByStatus(parseLog(mixedLog)), {
    200: 2,
    201: 1,
    404: 1,
    500: 1,
    503: 1,
  });
});

test("混在ログのステータス群", () => {
  assert.deepEqual(countByStatusClass(parseLog(mixedLog)), {
    "2xx": 3,
    "4xx": 1,
    "5xx": 2,
  });
});

test("混在ログの IP 別件数", () => {
  const counts = countByIp(parseLog(mixedLog));
  assert.equal(counts["2001:db8::1"], 1);
  assert.equal(counts["::1"], 1);
  assert.equal(counts["192.168.0.11"], 1);
  assert.equal(Object.keys(counts).length, 6);
});

test("混在ログを1行も落とさない", () => {
  const result = parseLogSafe(mixedLog);
  assert.equal(result.parsed, 6);
  assert.equal(result.skipped, 0);
  assert.equal(result.entries.length, 6);
});

test("混在ログのエラー", () => {
  const entries = parseLog(mixedLog);
  assert.equal(errorCount(entries), 3);
  assert.equal(errorRate(entries), 0.5);
  assert.equal(percent(3, 6, 0), "50%");
  assert.equal(filterByStatus(entries, 200).length, 2);
});

test("不正な行だけを飛ばす", () => {
  const text = `${mixedLog}\nbroken line\n`;
  const result = parseLogSafe(text);
  assert.equal(result.parsed, 6);
  assert.equal(result.skipped, 1);
});

test("ステータスの分類", () => {
  assert.equal(statusClass(200), "2xx");
  assert.equal(statusClass(404), "4xx");
  assert.equal(statusClass(503), "5xx");
  assert.equal(statusClass(null), "unknown");
});

test("タイムスタンプの時差", () => {
  assert.equal(parseTimestamp("10/Oct/2024:13:55:36 +0900").toISOString(), "2024-10-10T04:55:36.000Z");
  assert.equal(parseTimestamp("01/Jan/2024:00:00:00 -0500").toISOString(), "2024-01-01T05:00:00.000Z");
  assert.equal(parseTimestamp("31/Dec/2024:23:59:59 +0000").toISOString(), "2024-12-31T23:59:59.000Z");
});

const fileText = readFileSync(new URL("../data/access.log", import.meta.url), "utf8");
const fileEntries = parseLog(fileText);

test("ログファイルを全件読む", () => {
  assert.equal(fileText.split("\n").filter((line) => line.trim() !== "").length, 3000);
  assert.equal(fileEntries.length, 3000);
});

test("ログファイルのステータス別件数", () => {
  assert.deepEqual(countByStatus(fileEntries), {
    200: 1800,
    201: 300,
    304: 300,
    400: 250,
    404: 200,
    500: 100,
    503: 50,
  });
});

test("ログファイルの IP と IPv6", () => {
  assert.equal(uniqueIps(fileEntries).length, 42);
  assert.equal(fileEntries.filter((entry) => entry.ip.includes(":")).length, 600);
  assert.equal(countByIp(fileEntries)["2001:db8::1"], 60);
});

test("ログファイルのメソッドと日付", () => {
  assert.deepEqual(countByMethod(fileEntries), { GET: 1330, POST: 848, PUT: 424, DELETE: 398 });
  assert.deepEqual(countByDay(fileEntries), { "2024-10-01": 3000 });
});

test("ログファイルのエラー率", () => {
  assert.equal(errorCount(fileEntries), 600);
  assert.equal(errorRate(fileEntries), 0.2);
});
