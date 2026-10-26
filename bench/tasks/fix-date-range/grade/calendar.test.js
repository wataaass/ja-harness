import test from "node:test";
import assert from "node:assert/strict";
import { diffDays, eachDay, diffDaysInclusive } from "../src/diff.js";
import { addMonths, addYears, endOfMonth } from "../src/months.js";
import { toISO } from "../src/dates.js";
import { toISOWeek, weekNumber, weekYear, startOfWeek } from "../src/weeks.js";

test("時刻を含む日付でも日だけを見る", () => {
  assert.equal(diffDays(new Date(2024, 0, 31, 23, 59), new Date(2024, 1, 1, 0, 1)), 1);
  assert.equal(diffDays("2024-01-31T23:00:00", "2024-02-01T01:00:00"), 1);
  assert.equal(diffDays("2024-02-01T00:01:00", "2024-01-31T23:59:00"), -1);
});

test("同じ日なら時刻が違っても 0", () => {
  assert.equal(diffDays("2024-06-15T00:01:00", "2024-06-15T23:59:00"), 0);
  assert.equal(diffDays("2024-06-15T23:59:00", "2024-06-16T00:01:00"), 1);
});

test("時間を含む範囲の eachDay", () => {
  const days = eachDay("2024-01-31T23:00:00", "2024-02-01T01:00:00");
  assert.deepEqual(days.map(toISO), ["2024-01-31", "2024-02-01"]);
  assert.equal(diffDaysInclusive("2024-01-31T23:00:00", "2024-02-01T01:00:00"), 2);
});

test("月末から翌月1日は1日", () => {
  assert.equal(diffDays(new Date(Date.UTC(2024, 0, 31)), new Date(Date.UTC(2024, 1, 1))), 1);
});

test("月をまたぐ長い期間", () => {
  assert.equal(diffDays("2024-01-31", "2024-03-01"), 30);
  assert.equal(diffDays("2024-01-01", "2024-12-31"), 365);
  assert.equal(diffDays("2023-12-31", "2024-12-31"), 366);
});

test("うるう年の2月末をまたぐ", () => {
  assert.equal(diffDays("2024-02-28", "2024-03-01"), 2);
  assert.equal(diffDays("2023-02-28", "2023-03-01"), 1);
});

test("曜日をまたいでも時刻でずれない", () => {
  assert.equal(diffDays("2024-03-09T22:30:00", "2024-03-10T01:30:00"), 1);
  assert.equal(diffDays("2024-03-10T01:30:00", "2024-03-09T22:30:00"), -1);
});

test("1か月後は同じ日を保つ", () => {
  assert.equal(toISO(addMonths("2024-07-31", 1)), "2024-08-31");
  assert.equal(toISO(addMonths("2024-12-31", 1)), "2025-01-31");
  assert.equal(toISO(addMonths("2024-01-15", 1)), "2024-02-15");
  assert.equal(toISO(addMonths("2024-08-31", 1)), "2024-09-30");
});

test("ない日は月末に丸める", () => {
  assert.equal(toISO(addMonths("2024-01-31", 1)), "2024-02-29");
  assert.equal(toISO(addMonths("2023-01-31", 1)), "2023-02-28");
  assert.equal(toISO(addMonths("2024-02-29", 12)), "2025-02-28");
});

test("何か月でも同じ規則", () => {
  assert.equal(toISO(addMonths("2024-07-31", 2)), "2024-09-30");
  assert.equal(toISO(addMonths("2024-05-31", 2)), "2024-07-31");
  assert.equal(toISO(addMonths("2024-12-31", 2)), "2025-02-28");
  assert.equal(toISO(addMonths("2024-07-31", -1)), "2024-06-30");
  assert.equal(toISO(addMonths("2024-12-31", -1)), "2024-11-30");
});

test("年加算も月末の規則に従う", () => {
  assert.equal(toISO(addYears("2024-02-29", 1)), "2025-02-28");
  assert.equal(toISO(addYears("2024-07-31", 1)), "2025-07-31");
});

test("月末の判定は月ごとに正しい", () => {
  assert.equal(toISO(endOfMonth("2024-07-10")), "2024-07-31");
  assert.equal(toISO(endOfMonth("2024-02-10")), "2024-02-29");
  assert.equal(toISO(endOfMonth("2023-02-10")), "2023-02-28");
});

test("ISO 週番号の年またぎ", () => {
  assert.equal(weekNumber("2023-01-01"), 52);
  assert.equal(weekNumber("2024-01-01"), 1);
  assert.equal(weekNumber("2024-12-30"), 1);
  assert.equal(weekNumber("2021-01-01"), 53);
  assert.equal(weekNumber("2020-12-31"), 53);
});

test("日曜日の週番号も ISO の規則で数える", () => {
  assert.equal(weekNumber("2023-01-01"), 52);
  assert.equal(weekNumber("2024-06-02"), 22);
  assert.equal(weekNumber("2024-06-09"), 23);
  assert.equal(weekNumber("2025-01-05"), 1);
});

test("週番号の年も日曜日に惑わされない", () => {
  assert.equal(weekYear("2023-01-01"), 2022);
  assert.equal(weekYear("2024-12-30"), 2025);
  assert.equal(toISOWeek("2023-01-01"), "2022-W52");
  assert.equal(toISOWeek("2024-12-30"), "2025-W01");
});

test("週の始まりは月曜", () => {
  assert.equal(toISO(startOfWeek("2024-01-01", 1)), "2024-01-01");
  assert.equal(toISO(startOfWeek("2023-01-01", 1)), "2022-12-26");
  assert.equal(toISO(startOfWeek("2024-12-30", 1)), "2024-12-30");
});
