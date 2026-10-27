import test from "node:test";
import assert from "node:assert/strict";
import {
  countLines,
  describeEntry,
  describeLog,
  entriesForIp,
  entriesForPath,
  errorEntries,
  firstByStatus,
  groupByDay,
  invalidLines,
  isApiRequest,
  isRedirect,
  isSuccess,
  parseFirst,
  parseLog,
  parseLogSafe,
  parseMany,
  searchLines,
  sortByTime,
  splitLines,
  totalBytes,
} from "../src/logs.js";
import {
  addressKindOf,
  addressOf,
  bracketedPart,
  bytesOf,
  looksLikeLogLine,
  parseAddress,
  parseJsonLine,
  parseLine,
  pathOf,
  quotedParts,
  splitFields,
  splitRequest,
  statusOf,
  timeOf,
  tokenCount,
} from "../src/pattern.js";
import {
  countBy,
  countByHour,
  countByIp,
  countByMethod,
  countByPath,
  countByStatus,
  countByStatusClass,
  errorCount,
  errorRate,
  filterByMethod,
  filterByPathPrefix,
  filterByStatus,
  filterByStatusClass,
  isClientError,
  isErrorStatus,
  isServerError,
  percent,
  statusClass,
  topCounts,
  uniqueIps,
} from "../src/stats.js";
import {
  epochMillis,
  formatApacheTimestamp,
  formatTimestamp,
  localDateKey,
  localParts,
  offsetMinutes,
  parseISOTimestamp,
  parseTimestamp,
} from "../src/timestamp.js";
import {
  enabledFormats,
  formatIds,
  formatOptions,
  formatsByFieldCount,
  formatsByTimeFormat,
  formatsWithField,
  getFormat,
  hasFormat,
  ipv6Formats,
  isJsonFormat,
  jsonFormats,
  supportsIPv6,
  timeFormatOf,
  validateAllFormats,
} from "../src/formats.js";

function line(ip, status = 200, method = "GET", path = "/index.html", bytes = 123) {
  return `${ip} - - [10/Oct/2024:13:55:36 +0000] "${method} ${path} HTTP/1.1" ${status} ${bytes} "-" "curl/8.0"`;
}

for (let index = 0; index < 60; index += 1) {
  test(`IPv4 の行 ${index}`, () => {
    const entry = parseLine(line(`192.168.0.${index + 1}`, 200 + (index % 4), "GET", `/p${index}`));
    assert.ok(entry);
    assert.equal(entry.ip, `192.168.0.${index + 1}`);
    assert.equal(entry.path, `/p${index}`);
    assert.equal(entry.status, 200 + (index % 4));
  });
}

for (let index = 0; index < 30; index += 1) {
  test(`IPv4 の検査 ${index}`, () => {
    assert.equal(parseAddress(`10.0.0.${index}`), `10.0.0.${index}`);
    assert.equal(parseAddress(`10.0.0.${index} `), `10.0.0.${index}`);
    assert.equal(parseAddress(`999.0.0.${index}`), null);
    assert.equal(parseAddress(""), null);
  });
}

for (let index = 0; index < 30; index += 1) {
  test(`リクエストの分解 ${index}`, () => {
    const request = splitRequest(`GET /items/${index} HTTP/1.1`);
    assert.equal(request.method, "GET");
    assert.equal(request.path, `/items/${index}`);
    assert.equal(request.protocol, "HTTP/1.1");
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`行の判定 ${index}`, () => {
    assert.equal(looksLikeLogLine(line(`127.0.0.${index + 1}`)), true);
    assert.equal(looksLikeLogLine(`broken ${index}`), false);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`行の部品 ${index}`, () => {
    const text = line(`127.0.0.${index + 1}`, 201, "POST", `/api/${index}`);
    assert.equal(statusOf(text), 201);
    assert.equal(pathOf(text), `/api/${index}`);
    assert.equal(bytesOf(text), 123);
    assert.equal(addressOf(text), `127.0.0.${index + 1}`);
    assert.equal(addressKindOf(text), "ipv4");
    assert.equal(bracketedPart(text), "10/Oct/2024:13:55:36 +0000");
    assert.deepEqual(quotedParts(text).length, 3);
    assert.ok(tokenCount(text) > 5);
    assert.ok(timeOf(text) instanceof Date);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`ログの読み取り ${index}`, () => {
    const entries = parseLog(`${line(`10.0.0.${index + 1}`, 200)}\n${line(`10.0.1.${index + 1}`, 500)}`);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].status, 200);
    assert.equal(entries[1].status, 500);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`読めない行の扱い ${index}`, () => {
    const result = parseLogSafe(`${line(`10.0.0.${index + 1}`)}\nbroken ${index}\n`);
    assert.equal(result.parsed, 1);
    assert.equal(result.skipped, 1);
    assert.equal(invalidLines(`broken ${index}\n`).length, 1);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`行数の数え方 ${index}`, () => {
    assert.equal(countLines(`a\n\nb${index}\n`), 2);
    assert.equal(splitLines(`a\r\nb${index}\r\n`).length, 2);
  });
}

for (let index = 0; index < 30; index += 1) {
  test(`ステータスの集計 ${index}`, () => {
    const entries = parseLog(
      [line("10.0.0.1", 200), line("10.0.0.2", 404), line("10.0.0.3", 500)].join("\n"),
    );
    const counts = countByStatus(entries);
    assert.equal(counts[200], 1);
    assert.equal(counts[404], 1);
    assert.equal(counts[500], 1);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`ステータス群の集計 ${index}`, () => {
    const entries = parseLog(
      [line("10.0.0.1", 201), line("10.0.0.2", 301), line("10.0.0.3", 403)].join("\n"),
    );
    const classes = countByStatusClass(entries);
    assert.equal(classes["2xx"], 1);
    assert.equal(classes["3xx"], 1);
    assert.equal(classes["4xx"], 1);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`メソッドとパスの集計 ${index}`, () => {
    const entries = parseLog(
      [line("10.0.0.1", 200, "GET", `/a/${index}`), line("10.0.0.2", 200, "POST", "/b")].join("\n"),
    );
    assert.equal(countByMethod(entries).GET, 1);
    assert.equal(countByPath(entries)[`/a/${index}`], 1);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`IP の集計 ${index}`, () => {
    const entries = parseLog(
      [line(`10.0.0.${index + 1}`), line(`10.0.0.${index + 1}`), line("10.0.1.1")].join("\n"),
    );
    assert.equal(countByIp(entries)[`10.0.0.${index + 1}`], 2);
    assert.equal(uniqueIps(entries).length, 2);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`時間の集計 ${index}`, () => {
    const entries = parseLog(line("10.0.0.1", 200));
    assert.equal(countByHour(entries)["13"], 1);
    assert.equal(Object.keys(countByHour(entries)).length, 1);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`エラーの判定 ${index}`, () => {
    assert.equal(isErrorStatus(400), true);
    assert.equal(isErrorStatus(399), false);
    assert.equal(isClientError(404), true);
    assert.equal(isServerError(500), true);
    assert.equal(isServerError(404), false);
    assert.equal(statusClass(null), "unknown");
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`エラー率 ${index}`, () => {
    const entries = parseLog(
      [line("10.0.0.1", 200), line("10.0.0.2", 500), line("10.0.0.3", 404)].join("\n"),
    );
    assert.equal(errorCount(entries), 2);
    assert.equal(errorRate(entries), 2 / 3);
    assert.equal(percent(1, 4, 0), "25%");
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`絞り込み ${index}`, () => {
    const entries = parseLog(
      [line("10.0.0.1", 200, "GET", "/api/a"), line("10.0.0.2", 404, "POST", "/web/b")].join("\n"),
    );
    assert.equal(filterByStatus(entries, 200).length, 1);
    assert.equal(filterByStatusClass(entries, "4xx").length, 1);
    assert.equal(filterByMethod(entries, "get").length, 1);
    assert.equal(filterByPathPrefix(entries, "/api/").length, 1);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`件数の並べ替え ${index}`, () => {
    const top = topCounts({ a: 1, b: 3, c: 2 }, 2);
    assert.equal(top.length, 2);
    assert.equal(top[0].key, "b");
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`その他の読み取り ${index}`, () => {
    const text = `${line(`10.0.0.${index + 1}`)}\n`;
    assert.equal(parseFirst(text).ip, `10.0.0.${index + 1}`);
    assert.equal(entriesForIp(text, `10.0.0.${index + 1}`).length, 1);
    assert.equal(entriesForPath(text, "/index.html").length, 1);
    assert.equal(errorEntries(text).length, 0);
    assert.equal(totalBytes(text), 123);
    assert.equal(firstByStatus(text)["200"].path, "/index.html");
    assert.equal(groupByDay(text)["2024-10-10"].length, 1);
    assert.equal(parseMany([text, text]).length, 2);
    assert.equal(searchLines(text, "index").length, 1);
    assert.equal(sortByTime(parseLog(text)).length, 1);
    assert.match(describeEntry(parseFirst(text)), /10\.0\.0\./);
    assert.match(describeLog(text), /行数 1/);
    assert.equal(isSuccess(parseFirst(text)), true);
    assert.equal(isRedirect(parseFirst(text)), false);
    assert.equal(isApiRequest(parseFirst(text)), false);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`形式の定義 ${index}`, () => {
    const id = formatIds()[index];
    assert.equal(hasFormat(id), true);
    assert.equal(typeof getFormat(id).label, "string");
    assert.equal(typeof supportsIPv6(id), "boolean");
    assert.equal(typeof isJsonFormat(id), "boolean");
    assert.equal(typeof timeFormatOf(id), "string");
    assert.ok(getFormat(id).fields.length > 0);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`形式の一覧 ${index}`, () => {
    assert.ok(formatOptions().length > 50);
    assert.ok(enabledFormats().length > 50);
    assert.ok(ipv6Formats().length > 0);
    assert.ok(jsonFormats().length > 0);
    assert.ok(formatsWithField("ip").length > 0);
    assert.ok(Object.keys(formatsByFieldCount()).length > 0);
    assert.ok(Object.keys(formatsByTimeFormat()).length > 0);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`タイムスタンプの読み取り ${index}`, () => {
    const text = formatApacheTimestamp({
      year: 2024,
      month: index % 12 + 1,
      day: 10,
      hour: 13,
      minute: 55,
      second: 36,
      offsetMinutes: 0,
    });
    assert.equal(parseTimestamp(text).toISOString(), `2024-${String(index % 12 + 1).padStart(2, "0")}-10T13:55:36.000Z`);
    assert.equal(offsetMinutes(text), 0);
    assert.equal(typeof epochMillis(text), "number");
    assert.match(formatTimestamp(text), /^2024-/);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`ISO のタイムスタンプ ${index}`, () => {
    const text = `2024-10-${String(index + 1).padStart(2, "0")}T00:30:00+09:00`;
    assert.ok(parseISOTimestamp(text) instanceof Date);
    assert.equal(localDateKey(text), `2024-10-${String(index + 1).padStart(2, "0")}`);
    assert.equal(localParts(text).day, index + 1);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`JSON 行 ${index}`, () => {
    assert.equal(parseJsonLine(`{"a":${index}}`).a, index);
    assert.equal(parseJsonLine(`broken ${index}`), null);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`行の分割 ${index}`, () => {
    const fields = splitFields(`a b "c ${index}" d`);
    assert.equal(fields.length, 4);
  });
}

test("混在ログのステータス別件数", () => {
  const mixed = [
    line("192.168.0.10", 200),
    line("192.168.0.11", 503),
    line("192.168.0.12", 201, "POST", "/api/items"),
    line("192.168.0.13", 404, "GET", "/missing"),
    line("192.168.0.14", 200, "GET", "/api/items"),
    line("192.168.0.15", 500, "DELETE", "/api/items/1"),
  ].join("\n");
  assert.deepEqual(countByStatus(parseLog(mixed)), {
    200: 2,
    201: 1,
    404: 1,
    500: 1,
    503: 1,
  });
});

test("IPv6 の行も読める", () => {
  const mixed = [
    line("2001:db8::1", 200),
    line("::1", 200),
    line("fe80::1", 200),
  ].join("\n");
  const result = parseLogSafe(mixed);
  assert.equal(result.parsed, 3);
  assert.equal(result.skipped, 0);
  assert.equal(countByStatus(result.entries)[200], 3);
});

test("形式の検証", () => {
  assert.deepEqual(validateAllFormats(), []);
});

test("同じステータスの数え方", () => {
  const entries = parseLog([line("10.0.0.1", 200), line("10.0.0.2", 200)].join("\n"));
  assert.equal(countBy(entries, (entry) => entry.status)[200], 2);
});
