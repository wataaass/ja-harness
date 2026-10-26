import test from "node:test";
import assert from "node:assert/strict";
import { parseLine, parseAddress } from "../src/pattern.js";
import { parseLog, parseLogSafe } from "../src/logs.js";
import { countByStatus, countByIp, errorRate } from "../src/stats.js";
import { countByDay } from "../src/stats.js";
import { parseTimestamp } from "../src/timestamp.js";

function line(ip, status = 200, time = "10/Oct/2024:13:55:36 +0900") {
  return `${ip} - - [${time}] "GET /index.html HTTP/1.1" ${status} 123 "-" "curl/8.0"`;
}

test("IPv6 の行を読める", () => {
  const entry = parseLine(line("2001:db8::1", 503));
  assert.ok(entry);
  assert.equal(entry.ip, "2001:db8::1");
  assert.equal(entry.status, 503);
});

test("IPv6 の短縮形とループバックを読める", () => {
  assert.equal(parseLine(line("::1")).ip, "::1");
  assert.equal(parseLine(line("fe80::1")).ip, "fe80::1");
  assert.equal(parseLine(line("2001:db8:0:1::42")).ip, "2001:db8:0:1::42");
  assert.equal(parseAddress("::1"), "::1");
  assert.equal(parseAddress("2001:db8::1"), "2001:db8::1");
});

test("IPv6 と IPv4 の混在ログを1行も落とさない", () => {
  const text = [
    line("192.168.0.10", 200),
    line("2001:db8::1", 503),
    line("::1", 404),
    line("fe80::1", 200),
  ].join("\n");
  const result = parseLogSafe(text);
  assert.equal(result.parsed, 4);
  assert.equal(result.skipped, 0);
  assert.deepEqual(countByStatus(result.entries), { 200: 2, 404: 1, 503: 1 });
});

test("IPv6 の IP 別件数", () => {
  const text = [line("2001:db8::1"), line("2001:db8::1"), line("::1")].join("\n");
  assert.equal(countByIp(parseLog(text))["2001:db8::1"], 2);
  assert.equal(countByIp(parseLog(text))["::1"], 1);
});

test("IPv6 を含むエラー率", () => {
  const text = [line("2001:db8::1", 500), line("192.168.0.1", 200)].join("\n");
  assert.equal(errorRate(parseLog(text)), 0.5);
});

test("タイムスタンプの時差を引いて UTC に直す", () => {
  assert.equal(
    parseTimestamp("10/Oct/2024:13:55:36 +0900").toISOString(),
    "2024-10-10T04:55:36.000Z",
  );
  assert.equal(
    parseTimestamp("01/Jan/2024:00:00:00 -0500").toISOString(),
    "2024-01-01T05:00:00.000Z",
  );
  assert.equal(
    parseTimestamp("31/Dec/2024:23:59:59 +0000").toISOString(),
    "2024-12-31T23:59:59.000Z",
  );
});

test("時差の分も反映する", () => {
  assert.equal(
    parseTimestamp("10/Oct/2024:13:55:36 +0530").toISOString(),
    "2024-10-10T08:25:36.000Z",
  );
  assert.equal(
    parseTimestamp("10/Oct/2024:13:55:36 -0330").toISOString(),
    "2024-10-10T17:25:36.000Z",
  );
});

test("日別の集計は月と日を 0 詰めする", () => {
  const january = parseLog(line("192.168.0.1", 200, "05/Jan/2024:00:30:00 +0900"));
  assert.deepEqual(countByDay(january), { "2024-01-04": 1 });
  const october = parseLog(line("192.168.0.1", 200, "10/Oct/2024:00:30:00 +0900"));
  assert.deepEqual(countByDay(october), { "2024-10-09": 1 });
});

test("日付をまたぐ時刻も UTC の日付で数える", () => {
  const text = [
    line("192.168.0.1", 200, "01/Jan/2024:08:59:59 +0900"),
    line("192.168.0.2", 200, "01/Jan/2024:09:00:00 +0900"),
  ].join("\n");
  assert.deepEqual(countByDay(parseLog(text)), { "2023-12-31": 1, "2024-01-01": 1 });
});

test("ふつうの行の読み取りは変わらない", () => {
  const entry = parseLine(line("192.168.0.1", 201, "10/Oct/2024:13:55:36 +0000"));
  assert.equal(entry.method, "GET");
  assert.equal(entry.path, "/index.html");
  assert.equal(entry.bytes, 123);
  assert.equal(parseAddress("999.1.1.1"), null);
  assert.equal(parseAddress(""), null);
});

test("空行と壊れた行は飛ばす", () => {
  const result = parseLogSafe(`${line("192.168.0.1")}\n\nbroken line\n`);
  assert.equal(result.parsed, 1);
  assert.equal(result.skipped, 1);
});
