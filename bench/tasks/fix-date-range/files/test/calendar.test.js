import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  addYears,
  age,
  businessDays,
  calendarMatrix,
  clampDate,
  compareDates,
  daysInMonth,
  daysInYear,
  daysRemainingInMonth,
  diffDays,
  diffMonths,
  diffYears,
  durationParts,
  eachDay,
  eachMonth,
  endOfMonth,
  endOfWeek,
  endOfYear,
  formatDate,
  formatJapanese,
  isLeapYear,
  isSameDay,
  isSameMonth,
  isWeekend,
  maxDate,
  minDate,
  monthName,
  nextWeekday,
  parseDate,
  previousWeekday,
  quarter,
  sameWeek,
  season,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toISO,
  weekdayName,
  weekNumber,
} from "../src/calendar.js";

const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const expectedLengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

for (const month of months) {
  test(`2024年${month + 1}月の日数`, () => {
    assert.equal(daysInMonth(2024, month), expectedLengths[month]);
  });
}

for (const month of months) {
  test(`${month + 1}月の末日に1日足す`, () => {
    const last = new Date(2024, month, expectedLengths[month]);
    const next = addDays(last, 1);
    assert.equal(next.getMonth(), (month + 1) % 12);
    assert.equal(next.getDate(), 1);
  });
}

for (const month of months) {
  test(`${month + 1}月の最初の週の始まり`, () => {
    const start = startOfWeek(new Date(2024, month, 10));
    assert.equal(start.getDay(), 1);
    assert.ok(start.getDate() <= 10);
  });
}

for (const month of months) {
  test(`${month + 1}月の最初の週の終わり`, () => {
    const end = endOfWeek(new Date(2024, month, 10));
    assert.equal(end.getDay(), 0);
    assert.equal(end.getHours(), 23);
    assert.equal(end.getMinutes(), 59);
  });
}

for (const month of months) {
  test(`${month + 1}月10日の整形`, () => {
    const date = new Date(2024, month, 10);
    assert.equal(formatDate(date, "YYYY/MM/DD"), `2024/${String(month + 1).padStart(2, "0")}/10`);
    assert.equal(formatDate(date, "M月D日"), `${month + 1}月10日`);
  });
}

for (const month of months) {
  test(`${month + 1}月15日の読み取り`, () => {
    const date = parseDate(`2024-${String(month + 1).padStart(2, "0")}-15`);
    assert.ok(date);
    assert.equal(date.getMonth(), month);
    assert.equal(date.getDate(), 15);
  });
}

for (const month of months) {
  test(`${month + 1}月の日付を列挙する`, () => {
    const start = new Date(2024, month, 1);
    const end = new Date(2024, month, 5);
    const days = eachDay(start, end);
    assert.equal(days.length, 5);
    assert.equal(days[0].getDate(), 1);
    assert.equal(days[4].getDate(), 5);
  });
}

for (let day = 1; day <= 28; day += 1) {
  test(`同じ月の日数差 ${day}`, () => {
    const start = new Date(2024, 0, day);
    const end = new Date(2024, 0, day + 1);
    assert.equal(diffDays(start, end), 1);
  });
}

test("月末から翌月1日までの日数", () => {
  assert.equal(diffDays(new Date(2024, 0, 31), new Date(2024, 1, 1)), 1);
});

test("うるう年の2月29日から3月1日までの日数", () => {
  assert.equal(diffDays(new Date(2024, 1, 29), new Date(2024, 2, 1)), 1);
});

test("うるう年の判定", () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2023), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
});

test("1年の日数", () => {
  assert.equal(daysInYear(2024), 366);
  assert.equal(daysInYear(2023), 365);
});

test("月末の加算で日を丸める", () => {
  assert.equal(toISO(addMonths(new Date(2024, 0, 31), 1)), "2024-02-29");
  assert.equal(toISO(addMonths(new Date(2023, 0, 31), 1)), "2023-02-28");
  assert.equal(toISO(addMonths(new Date(2024, 1, 29), 12)), "2025-02-28");
});

test("年の加算", () => {
  assert.equal(toISO(addYears(new Date(2024, 1, 29), 1)), "2025-02-28");
});

test("月初と月末", () => {
  assert.equal(toISO(startOfMonth(new Date(2024, 5, 17))), "2024-06-01");
  assert.equal(toISO(endOfMonth(new Date(2024, 5, 17))), "2024-06-30");
  assert.equal(toISO(startOfYear(new Date(2024, 5, 17))), "2024-01-01");
  assert.equal(toISO(endOfYear(new Date(2024, 5, 17))), "2024-12-31");
});

test("同じ日・同じ月の判定", () => {
  assert.equal(isSameDay(new Date(2024, 0, 1, 1), new Date(2024, 0, 1, 23)), true);
  assert.equal(isSameMonth(new Date(2024, 0, 1), new Date(2024, 0, 31)), true);
  assert.equal(isSameDay(new Date(2024, 0, 1), new Date(2024, 0, 2)), false);
});

test("週末の判定", () => {
  assert.equal(isWeekend(new Date(2024, 0, 6)), true);
  assert.equal(isWeekend(new Date(2024, 0, 7)), true);
  assert.equal(isWeekend(new Date(2024, 0, 8)), false);
});

test("日付の比較と最小最大", () => {
  const a = new Date(2024, 0, 1);
  const b = new Date(2024, 0, 2);
  assert.ok(compareDates(a, b) < 0);
  assert.equal(toISO(minDate(b, a)), "2024-01-01");
  assert.equal(toISO(maxDate(b, a)), "2024-01-02");
});

test("月数の差", () => {
  assert.equal(diffMonths(new Date(2024, 0, 15), new Date(2024, 3, 15)), 3);
  assert.equal(diffMonths(new Date(2023, 10, 15), new Date(2024, 1, 15)), 3);
});

test("年数の差", () => {
  assert.equal(diffYears(new Date(2000, 0, 1), new Date(2024, 0, 1)), 24);
  assert.equal(diffYears(new Date(2000, 5, 1), new Date(2024, 4, 1)), 23);
});

test("月の列挙", () => {
  const monthsInRange = eachMonth(new Date(2023, 10, 15), new Date(2024, 1, 10));
  assert.equal(monthsInRange.length, 4);
  assert.equal(toISO(monthsInRange[0]), "2023-11-01");
  assert.equal(toISO(monthsInRange[3]), "2024-02-01");
});

test("営業日の列挙", () => {
  const days = businessDays(new Date(2024, 0, 1), new Date(2024, 0, 7));
  assert.deepEqual(days.map(toISO), ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]);
});

test("範囲内の判定", () => {
  assert.equal(new Date(2024, 0, 5) >= new Date(2024, 0, 1), true);
  const clamped = clampDate(new Date(2024, 5, 1), new Date(2024, 0, 1), new Date(2024, 1, 1));
  assert.equal(toISO(clamped), "2024-02-01");
});

test("ISO 週番号", () => {
  assert.equal(weekNumber(new Date(2024, 0, 1)), 1);
  assert.equal(weekNumber(new Date(2024, 11, 31)), 1);
  assert.equal(weekNumber(new Date(2024, 5, 17)), 25);
});

test("四半期と季節", () => {
  assert.equal(quarter(new Date(2024, 0, 1)), 1);
  assert.equal(quarter(new Date(2024, 11, 1)), 4);
  assert.equal(season(new Date(2024, 3, 1)), "spring");
  assert.equal(season(new Date(2024, 7, 1)), "summer");
  assert.equal(season(new Date(2024, 10, 1)), "autumn");
  assert.equal(season(new Date(2024, 0, 1)), "winter");
});

test("カレンダーの行列", () => {
  const matrix = calendarMatrix(2024, 0);
  assert.equal(matrix[0].filter((cell) => cell === null).length, 0);
  assert.equal(matrix[0][0].getDate(), 1);
  assert.ok(matrix.every((week) => week.length === 7));
});

test("日本語の整形と読み取り", () => {
  assert.equal(formatJapanese(new Date(2024, 0, 8)), "2024年1月8日(月)");
  assert.equal(formatJapanese(new Date(2024, 0, 8), { weekday: false }), "2024年1月8日");
  assert.equal(toISO(parseDate("2024年1月8日")), "2024-01-08");
});

test("曜日と月の名前", () => {
  assert.equal(monthName(new Date(2024, 0, 1)), "January");
  assert.equal(monthName(new Date(2024, 0, 1), "short"), "Jan");
  assert.equal(weekdayName(new Date(2024, 0, 8)), "Monday");
  assert.equal(weekdayName(new Date(2024, 0, 8), "short"), "Mon");
});

test("次の平日と前の平日", () => {
  assert.equal(toISO(nextWeekday(new Date(2024, 0, 5), 1)), "2024-01-08");
  assert.equal(toISO(previousWeekday(new Date(2024, 0, 8), 1)), "2024-01-01");
});

test("同じ週の判定", () => {
  assert.equal(sameWeek(new Date(2024, 0, 8), new Date(2024, 0, 14)), true);
  assert.equal(sameWeek(new Date(2024, 0, 8), new Date(2024, 0, 15)), false);
});

test("月の残り日数", () => {
  assert.equal(daysRemainingInMonth(new Date(2024, 1, 1)), 28);
  assert.equal(daysRemainingInMonth(new Date(2024, 1, 29)), 0);
});

test("期間の内訳", () => {
  assert.deepEqual(durationParts(new Date(2020, 0, 15), new Date(2024, 2, 20)), {
    years: 4,
    months: 2,
    days: 5,
  });
});

test("年齢", () => {
  assert.equal(age(new Date(2000, 5, 1), new Date(2024, 4, 31)), 23);
  assert.equal(age(new Date(2000, 5, 1), new Date(2024, 5, 1)), 24);
});

for (const month of months) {
  test(`${month + 1}月の ISO 文字列`, () => {
    assert.equal(toISO(new Date(2024, month, 1)), `2024-${String(month + 1).padStart(2, "0")}-01`);
  });
}

test("文字列からの日付比較", () => {
  assert.ok(compareDates("2024-01-01", "2024-01-02") < 0);
});
