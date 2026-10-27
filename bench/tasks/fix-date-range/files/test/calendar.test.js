import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS,
  atMidnight,
  cloneDate,
  dateParts,
  daysInMonth,
  formatDate,
  fromISO,
  isLeapYear,
  isSameDay,
  isValidDate,
  makeDate,
  mondayIndex,
  parseDate,
  toDateOnly,
  toISO,
} from "../src/dates.js";
import {
  addBusinessDays,
  businessDays,
  clampDate,
  compareDates,
  dayOfYear,
  daysInYear,
  diffDays,
  diffDaysInclusive,
  eachDay,
  elapsedDays,
  isAfter,
  isBefore,
  isWeekendDate,
  maxDate,
  minDate,
  monthBounds,
  nextBusinessDay,
  overlaps,
  sortDates,
  uniqueDates,
} from "../src/diff.js";
import {
  addMonths,
  addYears,
  daysAcrossMonths,
  daysOfMonth,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  isEndOfMonth,
  isStartOfMonth,
  monthOf,
  monthsBetween,
  monthsFrom,
  nextMonth,
  previousMonth,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  yearOf,
} from "../src/months.js";
import {
  calendarMatrix,
  dateOfWeek,
  dayOfWeek,
  endOfWeek,
  isSameWeek,
  startOfWeek,
  toISOWeek,
  toISODay,
  weekEndISO,
  weekNumber,
  weekRange,
  weekStartISO,
  weekYear,
  weekdayIndex,
  weeksInMonth,
} from "../src/weeks.js";
import {
  firstDayOfWeek,
  getLocale,
  isWeekend,
  localeDateOrder,
  localeDateFormat,
  localeIds,
  localeOptions,
  localeWeekdayName,
  meridiemOf,
  monthName,
  uses24HourClock,
  validateAllLocales,
  weekendDays,
} from "../src/locales.js";

for (let index = 0; index < 80; index += 1) {
  test(`月の日数 ${2000 + index}`, () => {
    for (let month = 0; month < 12; month += 1) {
      const days = daysInMonth(2000 + index, month);
      assert.ok(days === 28 || days === 29 || days === 30 || days === 31);
    }
  });
}

for (let index = 0; index < 30; index += 1) {
  test(`うるう年 ${1900 + index * 4}`, () => {
    const year = 1900 + index * 4;
    const expected = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    assert.equal(isLeapYear(year), expected);
  });
}

for (let index = 1; index <= 28; index += 1) {
  test(`2月の日付 ${index}日`, () => {
    assert.ok(makeDate(2024, 1, index) instanceof Date);
    assert.ok(makeDate(2023, 1, index) instanceof Date);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`日付の整形 ${index}`, () => {
    const text = `2024-03-${String(index + 1).padStart(2, "0")}`;
    assert.equal(toISO(text), text);
    assert.equal(formatDate(text, "YYYY/MM/DD"), `2024/03/${String(index + 1).padStart(2, "0")}`);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`日付の読み取り ${index}`, () => {
    const text = `2024-04-${String(index + 1).padStart(2, "0")}`;
    assert.equal(toISO(parseDate(text)), text);
    assert.equal(toISO(fromISO(text)), text);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`月の初日と末日 ${index}`, () => {
    const date = makeDate(2024, index % 12, 15);
    assert.equal(toISO(startOfMonth(date)), `2024-${String((index % 12) + 1).padStart(2, "0")}-01`);
    assert.ok(endOfMonth(date) instanceof Date);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`日付の差（0時）${index}`, () => {
    const start = new Date(Date.UTC(2024, 0, 1));
    const end = new Date(Date.UTC(2024, 0, 1 + index));
    assert.equal(diffDays(start, end), index);
    assert.equal(diffDays(end, start), index === 0 ? 0 : -index);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`両端を含む日数 ${index}`, () => {
    assert.equal(
      diffDaysInclusive("2024-01-01", new Date(Date.UTC(2024, 0, 1 + index))),
      index + 1,
    );
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`日付の並び ${index}`, () => {
    const days = eachDay("2024-01-01", new Date(Date.UTC(2024, 0, 1 + index)));
    assert.equal(days.length, index + 1);
    assert.equal(toISO(days[0]), "2024-01-01");
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`月の加算（月末以外）${index}`, () => {
    const date = makeDate(2024, 0, Math.min(index + 1, 28));
    const added = addMonths(date, 1);
    assert.ok(added instanceof Date);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月の加算（月末）${index}`, () => {
    const pairs = [
      ["2024-01-31", "2024-02-29"],
      ["2023-01-31", "2023-02-28"],
      ["2024-02-29", "2024-03-29"],
      ["2024-03-31", "2024-04-30"],
      ["2024-04-30", "2024-05-30"],
      ["2024-05-31", "2024-06-30"],
      ["2024-08-31", "2024-09-30"],
      ["2024-09-30", "2024-10-30"],
      ["2024-10-31", "2024-11-30"],
      ["2024-11-30", "2024-12-30"],
    ];
    assert.equal(toISO(addMonths(pairs[index][0], 1)), pairs[index][1]);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`年の加算 ${index}`, () => {
    const date = addYears("2024-02-29", index);
    assert.ok(date instanceof Date);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`週番号 ${index}`, () => {
    const cases = [
      ["2023-01-02", 1],
      ["2023-01-09", 2],
      ["2023-01-30", 5],
      ["2023-02-06", 6],
      ["2023-03-06", 10],
      ["2023-04-03", 14],
      ["2023-05-01", 18],
      ["2023-06-05", 23],
      ["2023-07-03", 27],
      ["2023-08-07", 32],
      ["2023-09-04", 36],
      ["2023-10-02", 40],
      ["2023-11-06", 45],
      ["2023-12-04", 49],
      ["2024-01-01", 1],
      ["2024-01-08", 2],
      ["2024-02-05", 6],
      ["2024-03-04", 10],
      ["2024-04-01", 14],
      ["2024-05-06", 19],
    ];
    assert.equal(weekNumber(cases[index][0]), cases[index][1]);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`週の始まり ${index}`, () => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    const start = startOfWeek(date, 1);
    assert.equal(start.getUTCDay(), 1);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`週の末日 ${index}`, () => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    const end = endOfWeek(date, 1);
    assert.equal(end.getUTCDay(), 0);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`曜日の位置 ${index}`, () => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    assert.equal(dayOfWeek(date, 0), date.getUTCDay());
    assert.equal(weekdayIndex(date), date.getUTCDay());
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`カレンダーの行 ${index}`, () => {
    const matrix = calendarMatrix(2024, index % 12);
    assert.ok(matrix.length >= 4);
    assert.equal(matrix[0].length, 7);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`週の表記 ${index}`, () => {
    const date = new Date(Date.UTC(2024, 0, 1 + index * 7));
    assert.match(toISOWeek(date), /^\d{4}-W\d{2}$/);
    assert.match(weekStartISO(date), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(weekEndISO(date), /^\d{4}-\d{2}-\d{2}$/);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`週の範囲 ${index}`, () => {
    const range = weekRange(new Date(Date.UTC(2024, 0, 1 + index)));
    assert.ok(range.start instanceof Date);
    assert.ok(range.end instanceof Date);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`ISO 週の年 ${index}`, () => {
    assert.equal(typeof weekYear(new Date(Date.UTC(2024, 0, 1 + index))), "number");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`同じ週 ${index}`, () => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    assert.equal(isSameWeek(date, date), true);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月の週数 ${index}`, () => {
    assert.ok(weeksInMonth(new Date(Date.UTC(2024, index % 12, 15))) >= 4);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`ISO の日付 ${index}`, () => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    assert.equal(toISODay(date), toISO(date));
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`ロケールの月名 ${index}`, () => {
    const id = localeIds()[index];
    assert.equal(typeof monthName(id, index % 12), "string");
    assert.equal(typeof monthName(id, index % 12, { short: true }), "string");
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`ロケールの曜日 ${index}`, () => {
    const id = localeIds()[index];
    assert.equal(typeof localeWeekdayName(id, index % 7), "string");
    assert.equal(typeof firstDayOfWeek(id), "number");
    assert.equal(typeof localeDateFormat(id), "string");
    assert.equal(typeof localeDateOrder(id), "string");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`ロケールの週末 ${index}`, () => {
    const id = localeIds()[index];
    assert.equal(typeof isWeekend(id, 0), "boolean");
    assert.ok(weekendDays(id).length >= 1);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`ロケールの時刻 ${index}`, () => {
    const id = localeIds()[index];
    assert.equal(typeof uses24HourClock(id), "boolean");
    assert.equal(typeof meridiemOf(id).am, "string");
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`日付の比較 ${index}`, () => {
    const a = new Date(Date.UTC(2024, 0, 1));
    const b = new Date(Date.UTC(2024, 0, 2 + index));
    assert.equal(compareDates(a, b), -1);
    assert.equal(isBefore(a, b), true);
    assert.equal(isAfter(b, a), true);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付の最小最大 ${index}`, () => {
    const a = new Date(Date.UTC(2024, 0, 1));
    const b = new Date(Date.UTC(2024, 0, 1 + index));
    assert.equal(toISO(minDate(a, b)), "2024-01-01");
    assert.equal(toISO(maxDate(a, b)), toISO(b));
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付の範囲 ${index}`, () => {
    assert.equal(
      overlaps(
        { start: "2024-01-01", end: "2024-01-10" },
        { start: "2024-01-05", end: `2024-01-${String(10 + index).padStart(2, "0")}` },
      ),
      true,
    );
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付の整理 ${index}`, () => {
    const dates = sortDates([
      new Date(Date.UTC(2024, 0, 3)),
      new Date(Date.UTC(2024, 0, 1 + index)),
      new Date(Date.UTC(2024, 0, 3)),
    ]);
    assert.equal(dates.length, 3);
    assert.ok(uniqueDates(dates).length <= 3);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`年と月 ${index}`, () => {
    const date = new Date(Date.UTC(2024, index % 12, 15));
    assert.equal(yearOf(date), 2024);
    assert.equal(monthOf(date), index % 12);
    assert.ok(daysOfMonth(date) >= 28);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月の端の判定 ${index}`, () => {
    const date = new Date(Date.UTC(2024, index % 12, 15));
    assert.equal(isStartOfMonth(date), false);
    assert.equal(isEndOfMonth(date), false);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月の一覧 ${index}`, () => {
    assert.equal(monthsFrom("2024-01-15", index + 1).length, index + 1);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月をまたぐ日数 ${index}`, () => {
    assert.equal(
      daysAcrossMonths(new Date(Date.UTC(2024, 0, 31)), new Date(Date.UTC(2024, 1, 1 + index))),
      index + 1,
    );
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`四半期 ${index}`, () => {
    const date = new Date(Date.UTC(2024, index % 12, 15));
    assert.ok(startOfQuarter(date) instanceof Date);
    assert.ok(endOfQuarter(date) instanceof Date);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`年と四半期の端 ${index}`, () => {
    assert.equal(toISO(startOfYear("2024-03-15")), "2024-01-01");
    assert.equal(toISO(endOfYear("2024-03-15")), "2024-12-31");
    assert.ok(nextMonth("2024-01-15") instanceof Date);
    assert.ok(previousMonth("2024-01-15") instanceof Date);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付の部品 ${index}`, () => {
    const parts = dateParts(new Date(Date.UTC(2024, 0, 1 + index)));
    assert.equal(parts.year, 2024);
    assert.equal(parts.month, 0);
    assert.equal(parts.day, index + 1);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付のユーティリティ ${index}`, () => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    assert.equal(isValidDate(date), true);
    assert.ok(cloneDate(date) instanceof Date);
    assert.ok(atMidnight(date) instanceof Date);
    assert.equal(isSameDay(date, date), true);
    assert.equal(mondayIndex(date), (date.getUTCDay() + 6) % 7);
    assert.equal(typeof toDateOnly(date), "number");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`営業日 ${index}`, () => {
    assert.equal(isWeekendDate(new Date(Date.UTC(2024, 0, 6))), index >= 0);
    assert.ok(businessDays("2024-01-01", "2024-01-07").length === 5);
    assert.ok(nextBusinessDay(new Date(Date.UTC(2024, 0, 5))) instanceof Date);
    assert.ok(addBusinessDays("2024-01-05", index) instanceof Date);
    assert.equal(dayOfYear("2024-01-01"), 1);
    assert.equal(daysInYear(2024), 366);
    assert.ok(clampDate("2024-01-15", "2024-01-01", "2024-01-10") instanceof Date);
    assert.ok(monthBounds("2024-02-10").start instanceof Date);
    assert.equal(elapsedDays("2024-01-01", "2024-01-02"), 1);
    assert.equal(DAY_MS, 86400000);
  });
}

test("ロケールの一覧", () => {
  assert.ok(localeOptions().length > 50);
  assert.deepEqual(validateAllLocales(), []);
  assert.equal(getLocale("ja-JP").id, "ja-JP");
});

test("時刻を含む日付でも日だけを見る", () => {
  assert.equal(diffDays(new Date(2024, 0, 31, 23, 59), new Date(2024, 1, 1, 0, 1)), 1);
  assert.equal(diffDays("2024-01-31T23:00:00", "2024-02-01T01:00:00"), 1);
  assert.equal(diffDays("2024-02-01T00:01:00", "2024-01-31T23:59:00"), -1);
});

test("月末から翌月1日は1日", () => {
  assert.equal(diffDays(new Date(Date.UTC(2024, 0, 31)), new Date(Date.UTC(2024, 1, 1))), 1);
});

test("うるう年の2月末をまたぐ", () => {
  assert.equal(diffDays(new Date(Date.UTC(2024, 1, 28)), new Date(Date.UTC(2024, 2, 1))), 2);
  assert.equal(diffDays(new Date(Date.UTC(2023, 1, 28)), new Date(Date.UTC(2023, 2, 1))), 1);
});
