import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  businessDays,
  calendarMatrix,
  daysInMonth,
  diffDays,
  eachDay,
  endOfMonth,
  formatDate,
  isLeapYear,
  parseDate,
  startOfWeek,
  toISO,
  weekNumber,
} from "../src/calendar.js";

const monthEnds = [
  [2024, 0, 31, 1],
  [2024, 1, 29, 2],
  [2024, 2, 31, 3],
  [2024, 3, 30, 4],
  [2024, 4, 31, 5],
  [2024, 5, 30, 6],
  [2024, 6, 31, 7],
  [2024, 7, 31, 8],
  [2024, 8, 30, 9],
  [2024, 9, 31, 10],
  [2024, 10, 30, 11],
  [2024, 11, 31, 0],
];

for (const [year, month, lastDay, nextMonth] of monthEnds) {
  test(`${year}-${month + 1} の末日から翌月1日は1日`, () => {
    const start = new Date(year, month, lastDay);
    const end = new Date(year, month + 1, 1);
    assert.equal(diffDays(start, end), 1);
    assert.equal(diffDays(end, start), -1);
  });
}

for (const [year, month] of monthEnds) {
  test(`${year}-${month + 1} の1日から翌月1日は月の日数`, () => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    assert.equal(diffDays(start, end), daysInMonth(year, month));
    assert.equal(diffDays(end, start), -daysInMonth(year, month));
  });
}

test("年をまたぐ日数", () => {
  assert.equal(diffDays(new Date(2023, 11, 31), new Date(2024, 0, 1)), 1);
  assert.equal(diffDays(new Date(2023, 11, 15), new Date(2024, 0, 15)), 31);
  assert.equal(diffDays(new Date(2023, 0, 1), new Date(2024, 0, 1)), 365);
  assert.equal(diffDays(new Date(2024, 0, 1), new Date(2025, 0, 1)), 366);
  assert.equal(diffDays(new Date(2020, 0, 1), new Date(2030, 0, 1)), 3653);
});

test("うるう年の2月をまたぐ日数", () => {
  assert.equal(diffDays(new Date(2024, 1, 28), new Date(2024, 2, 1)), 2);
  assert.equal(diffDays(new Date(2023, 1, 28), new Date(2023, 2, 1)), 1);
  assert.equal(diffDays(new Date(2024, 1, 29), new Date(2024, 2, 1)), 1);
  assert.equal(diffDays(new Date(2024, 1, 1), new Date(2024, 2, 1)), 29);
  assert.equal(diffDays(new Date(2023, 1, 1), new Date(2023, 2, 1)), 28);
});

test("世紀のうるう年", () => {
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(2100), false);
  assert.equal(diffDays(new Date(2100, 1, 28), new Date(2100, 2, 1)), 1);
});

test("時刻を含む日付でも日だけを見る", () => {
  assert.equal(diffDays(new Date(2024, 0, 31, 23, 59), new Date(2024, 1, 1, 0, 1)), 1);
  assert.equal(diffDays("2024-01-31T23:00:00", "2024-02-01T01:00:00"), 1);
});

test("月をまたぐ長い期間", () => {
  assert.equal(diffDays(new Date(2024, 0, 31), new Date(2024, 2, 1)), 30);
  assert.equal(diffDays(new Date(2024, 0, 1), new Date(2024, 11, 31)), 365);
  assert.equal(diffDays(new Date(2023, 11, 31), new Date(2024, 11, 31)), 366);
});

test("同じ日は0", () => {
  assert.equal(diffDays(new Date(2024, 5, 15, 10), new Date(2024, 5, 15, 20)), 0);
});

test("eachDay は両端を含む", () => {
  const days = eachDay(new Date(2024, 0, 31), new Date(2024, 1, 2));
  assert.deepEqual(days.map(toISO), ["2024-01-31", "2024-02-01", "2024-02-02"]);
  const leap = eachDay(new Date(2024, 1, 28), new Date(2024, 2, 1));
  assert.deepEqual(leap.map(toISO), ["2024-02-28", "2024-02-29", "2024-03-01"]);
});

test("addDays が月末を越える", () => {
  assert.equal(toISO(addDays(new Date(2024, 0, 31), 1)), "2024-02-01");
  assert.equal(toISO(addDays(new Date(2024, 1, 29), 1)), "2024-03-01");
  assert.equal(toISO(addDays(new Date(2023, 1, 28), 1)), "2023-03-01");
  assert.equal(toISO(addDays(new Date(2024, 11, 31), 1)), "2025-01-01");
});

test("addMonths は月末を丸める", () => {
  assert.equal(toISO(addMonths(new Date(2024, 0, 31), 1)), "2024-02-29");
  assert.equal(toISO(addMonths(new Date(2023, 0, 31), 1)), "2023-02-28");
  assert.equal(toISO(addMonths(new Date(2024, 1, 29), 12)), "2025-02-28");
  assert.equal(toISO(addMonths(new Date(2024, 0, 31), 13)), "2025-02-28");
});

test("endOfMonth と startOfWeek", () => {
  assert.equal(toISO(endOfMonth(new Date(2024, 1, 10))), "2024-02-29");
  assert.equal(toISO(endOfMonth(new Date(2023, 1, 10))), "2023-02-28");
  assert.equal(toISO(startOfWeek(new Date(2024, 0, 7))), "2024-01-01");
});

test("営業日は週末を除く", () => {
  const days = businessDays(new Date(2024, 0, 29), new Date(2024, 1, 2));
  assert.deepEqual(days.map(toISO), ["2024-01-29", "2024-01-30", "2024-01-31", "2024-02-01", "2024-02-02"]);
});

test("ISO 週番号の年またぎ", () => {
  assert.equal(weekNumber(new Date(2023, 0, 1)), 52);
  assert.equal(weekNumber(new Date(2024, 0, 1)), 1);
  assert.equal(weekNumber(new Date(2024, 11, 30)), 1);
  assert.equal(weekNumber(new Date(2021, 0, 1)), 53);
});

test("カレンダーの行列", () => {
  const matrix = calendarMatrix(2024, 1);
  assert.equal(matrix.length, 5);
  assert.equal(matrix[0][3].getDate(), 1);
  assert.equal(matrix[4][3].getDate(), 29);
  const first = calendarMatrix(2023, 9);
  assert.equal(first[0][6].getDate(), 1);
});

test("日付の読み取りの端", () => {
  assert.equal(toISO(parseDate("2024-02-29")), "2024-02-29");
  assert.equal(parseDate("2023-02-29"), null);
  assert.equal(parseDate("2024-13-01"), null);
  assert.equal(parseDate("2024-00-10"), null);
  assert.equal(parseDate("2024-04-31"), null);
  assert.equal(formatDate(parseDate("2024年2月29日"), "YYYY/MM/DD"), "2024/02/29");
});
