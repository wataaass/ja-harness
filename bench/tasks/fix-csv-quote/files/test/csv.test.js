import test from "node:test";
import assert from "node:assert/strict";
import {
  columnCount,
  columnValues,
  countRows,
  detectDelimiter,
  dialectIds,
  dropColumns,
  isRectangular,
  normalizeNewlines,
  parseCsv,
  parseCsvRecords,
  parseWithDialect,
  pickColumns,
  recordsToRows,
  removeEmptyRows,
  rowsToRecords,
  sameRows,
  stringifyCsv,
  stringifyWithDialect,
  transpose,
  trimRows,
  uniqueHeaders,
  valuesOfColumn,
} from "../src/csv.js";
import {
  dateFormatOf,
  dateOrderOf,
  decimalSeparatorOf,
  delimiterOf,
  dialectOptions,
  groupSeparatorOf,
  readOptionsOf,
  usesParenthesesNegative,
  validateAllDialects,
  writeOptionsOf,
} from "../src/dialects.js";
import {
  escapeField,
  needsQuotes,
  padRows,
  quoted,
  stringifyRecords,
  stringifyRow,
  withoutTrailingNewline,
  withTrailingNewline,
} from "../src/writer.js";
import {
  averageNumbers,
  formatNumber,
  formatSigned,
  nonZeroCount,
  normalizePercent,
  numberRange,
  parseBoolean,
  parseInteger,
  parseNumber,
  parsePercent,
  roundTo,
  sumNumbers,
} from "../src/numbers.js";
import {
  addDays,
  addMonths,
  compareDates,
  dateRange,
  daysInMonth,
  diffDays,
  endOfMonth,
  formatDate,
  isFuture,
  isLeapYear,
  isPast,
  parseDateValue,
  quarter,
  startOfMonth,
  toISODate,
  weekday,
  weekdayName,
} from "../src/dates.js";

for (let index = 0; index < 50; index += 1) {
  test(`カンマ区切りの読み込み ${index}`, () => {
    const rows = parseCsv(`a${index},b${index},c${index}\n1,2,3\n`);
    assert.deepEqual(rows, [
      [`a${index}`, `b${index}`, `c${index}`],
      ["1", "2", "3"],
    ]);
  });
}

for (let index = 0; index < 40; index += 1) {
  test(`セミコロン区切りの読み込み ${index}`, () => {
    const rows = parseCsv(`x;y\n${index};${index + 1}\n`, { delimiter: ";" });
    assert.deepEqual(rows, [["x", "y"], [String(index), String(index + 1)]]);
  });
}

for (let index = 0; index < 30; index += 1) {
  test(`引用符内のカンマ ${index}`, () => {
    const rows = parseCsv(`a,b\n"x,${index}",z\n`);
    assert.deepEqual(rows, [["a", "b"], [`x,${index}`, "z"]]);
  });
}

for (let index = 0; index < 25; index += 1) {
  test(`引用符内の改行 ${index}`, () => {
    const rows = parseCsv(`a,b\n"one\n${index}",x\n`);
    assert.deepEqual(rows, [["a", "b"], [`one\n${index}`, "x"]]);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`空の値 ${index}`, () => {
    assert.deepEqual(parseCsv(`a,b,c\n${index},,3\n`), [
      ["a", "b", "c"],
      [String(index), "", "3"],
    ]);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`区切り文字の自動判定 ${index}`, () => {
    const text = index % 2 === 0 ? `a,b\n1,2` : `a;b\n1;2`;
    assert.equal(detectDelimiter(text), index % 2 === 0 ? "," : ";");
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`改行の正規化 ${index}`, () => {
    assert.equal(normalizeNewlines(`a\r\nb${index}\r`), `a\nb${index}\n`);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`ヘッダー付きレコード ${index}`, () => {
    const records = parseCsvRecords(`id,name\n${index},name${index}\n`);
    assert.deepEqual(records, [{ id: String(index), name: `name${index}` }]);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`空行を飛ばす ${index}`, () => {
    assert.deepEqual(parseCsv(`a\n\n${index}\n\n`, { skipEmptyLines: true }), [
      ["a"],
      [String(index)],
    ]);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`前後の空白を落とす ${index}`, () => {
    assert.deepEqual(parseCsv(` a , b${index} \n`, { trim: true }), [["a", `b${index}`]]);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`列の取り出し ${index}`, () => {
    const rows = [["a", "b", "c"], ["1", "2", "3"]];
    assert.deepEqual(pickColumns(rows, [index % 3]), [[rows[0][index % 3]], [rows[1][index % 3]]]);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`列の削除 ${index}`, () => {
    const rows = [["a", "b", "c"], ["1", "2", "3"]];
    assert.equal(dropColumns(rows, [index % 3])[0].length, 2);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`転置 ${index}`, () => {
    const rows = [["a", "b"], ["1", "2"], [String(index), "4"]];
    assert.equal(transpose(rows).length, 2);
    assert.equal(transpose(rows)[0].length, 3);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`行数と列数 ${index}`, () => {
    const rows = [["a", "b"], [String(index), "2"]];
    assert.equal(countRows(rows), 2);
    assert.equal(columnCount(rows), 2);
    assert.equal(isRectangular(rows), true);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`重複したヘッダー ${index}`, () => {
    const headers = uniqueHeaders(["a", "a", "", `c${index}`]);
    assert.equal(headers[0], "a");
    assert.equal(headers[1], "a_2");
    assert.equal(headers[2], "column3");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`空行の除去 ${index}`, () => {
    assert.equal(removeEmptyRows([["a"], [""], [String(index)]]).length, 2);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`trim した行 ${index}`, () => {
    assert.deepEqual(trimRows([[" a ", ` b${index} `]]), [["a", `b${index}`]]);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`行の比較 ${index}`, () => {
    assert.equal(sameRows([["a", String(index)]], [["a", String(index)]]), true);
    assert.equal(sameRows([["a"]], [["b"]]), false);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`レコードへの変換 ${index}`, () => {
    const records = rowsToRecords([["id", "name"], [String(index), `n${index}`]]);
    assert.equal(records[0].id, String(index));
    assert.equal(records[0].name, `n${index}`);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`行への変換 ${index}`, () => {
    const rows = recordsToRows([{ id: String(index), name: `n${index}` }]);
    assert.equal(rows[0].length, 2);
    assert.equal(rows[1][0], String(index));
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`列の値 ${index}`, () => {
    assert.deepEqual(columnValues([["a"], [String(index)]], 0, { skipHeader: true }), [
      String(index),
    ]);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`指定した列の値 ${index}`, () => {
    assert.deepEqual(valuesOfColumn(`id,name\n${index},x\n`, "id"), [String(index)]);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`方言つきの読み書き ${index}`, () => {
    const id = dialectIds()[index * 3];
    const text = stringifyWithDialect([["a", "b"], [String(index), "x"]], id);
    assert.deepEqual(parseWithDialect(text, id), [["a", "b"], [String(index), "x"]]);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`方言の設定 ${index}`, () => {
    const id = dialectIds()[index * 2];
    assert.equal(delimiterOf(id), readOptionsOf(id).delimiter);
    assert.equal(delimiterOf(id), writeOptionsOf(id).delimiter);
    assert.equal(typeof decimalSeparatorOf(id), "string");
    assert.equal(typeof groupSeparatorOf(id), "string");
    assert.equal(typeof dateOrderOf(id), "string");
    assert.equal(typeof usesParenthesesNegative(id), "boolean");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`方言の日付形式 ${index}`, () => {
    const id = dialectIds()[index * 2];
    assert.equal(typeof dateFormatOf(id), "string");
    assert.equal(typeof readOptionsOf(id).trim, "boolean");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`数値の読み取り ${index}`, () => {
    assert.equal(parseNumber(`${index},${String(index).padStart(3, "0")}`), index * 1000 + index);
    assert.equal(parseNumber(`-${index}.5`), index === 0 ? -0.5 : -(index + 0.5));
    assert.equal(parseNumber(""), null);
    assert.equal(parseNumber("abc"), null);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`整数の読み取り ${index}`, () => {
    assert.equal(parseInteger(String(index)), index);
    assert.equal(parseInteger(`${index}.5`), null);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`数値の整形 ${index}`, () => {
    assert.equal(formatNumber(index * 1234), (index * 1234).toLocaleString("en-US"));
    assert.equal(formatNumber(index + 0.5, { decimals: 1 }), `${index}.5`);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`真偽値の読み取り ${index}`, () => {
    assert.equal(parseBoolean("true"), true);
    assert.equal(parseBoolean("no"), false);
    assert.equal(parseBoolean(String(index + 2)), null);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`百分率の読み取り ${index}`, () => {
    assert.equal(parsePercent(`${index}%`), index / 100);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`数値の集計 ${index}`, () => {
    assert.equal(sumNumbers([index, "1", "x"]), index + 1);
    assert.equal(averageNumbers([index, index]), index);
    assert.deepEqual(numberRange([index, index + 1]), { min: index, max: index + 1 });
    assert.equal(nonZeroCount([index, 0]), index === 0 ? 0 : 1);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`数値の丸め ${index}`, () => {
    assert.equal(roundTo(index + 0.25, 1), index + 0.3);
    assert.equal(normalizePercent(index * 20), Math.min(100, index * 20));
    assert.equal(formatSigned(index), String(index));
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`日付の読み取り ${index}`, () => {
    const year = 2000 + index;
    const date = parseDateValue(`${year}-02-28`);
    assert.equal(toISODate(date), `${year}-02-28`);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`日付の書式 ${index}`, () => {
    const text = formatDate("2024-02-29", index % 2 === 0 ? "YYYY/MM/DD" : "YYYY.MM.DD");
    assert.equal(text, index % 2 === 0 ? "2024/02/29" : "2024.02.29");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月の日数 ${index}`, () => {
    assert.equal(daysInMonth(2000 + index, 1), isLeapYear(2000 + index) ? 29 : 28);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付の加算 ${index}`, () => {
    const date = addDays("2024-01-01", index);
    assert.equal(toISODate(date), toISODate(new Date(Date.UTC(2024, 0, 1 + index))));
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月の加算 ${index}`, () => {
    const date = addMonths("2024-01-31", index);
    assert.ok(date instanceof Date);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付の差 ${index}`, () => {
    assert.equal(diffDays("2024-01-01", addDays("2024-01-01", index)), index);
    assert.ok(compareDates("2024-01-01", "2024-01-02") < 0);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`日付の範囲 ${index}`, () => {
    assert.equal(dateRange("2024-01-01", addDays("2024-01-01", index)).length, index + 1);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`月の端 ${index}`, () => {
    assert.equal(toISODate(startOfMonth("2024-02-15")), "2024-02-01");
    assert.equal(toISODate(endOfMonth("2024-02-15")), "2024-02-29");
    assert.equal(quarter("2024-02-15"), 1);
    assert.equal(weekday("2024-02-15"), 4);
    assert.equal(weekdayName("2024-02-15"), "木");
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`過去と未来 ${index}`, () => {
    const day = String(index + 1).padStart(2, "0");
    assert.equal(isPast(`2020-01-${day}`), true);
    assert.equal(isFuture(`2030-01-${day}`), true);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`引用符が必要な値 ${index}`, () => {
    assert.equal(needsQuotes(`a${index}`), false);
    assert.equal(needsQuotes(`a,${index}`), true);
  });
}

for (let index = 0; index < 20; index += 1) {
  test(`フィールドの書き出し ${index}`, () => {
    assert.equal(escapeField(`a,${index}`), `"a,${index}"`);
    assert.equal(escapeField(`a${index}`), `a${index}`);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`行の書き出し ${index}`, () => {
    assert.equal(stringifyRow(["a", String(index)]), `a,${index}`);
  });
}

for (let index = 0; index < 15; index += 1) {
  test(`レコードの書き出し ${index}`, () => {
    const text = stringifyRecords([{ id: String(index), name: `n${index}` }]);
    assert.equal(text, `id,name\n${index},n${index}\n`);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`行の詰め物 ${index}`, () => {
    assert.deepEqual(padRows([["a"]], index + 2), [["a", "", ...Array(index).fill("")]]);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`引用符つきの文字列 ${index}`, () => {
    assert.equal(quoted(`a${index}`), `"a${index}"`);
  });
}

for (let index = 0; index < 10; index += 1) {
  test(`末尾の改行 ${index}`, () => {
    assert.equal(withoutTrailingNewline(`a${index}\n`), `a${index}`);
    assert.equal(withTrailingNewline(`a${index}`), `a${index}\n`);
  });
}

test("方言の一覧と検証", () => {
  assert.ok(dialectOptions().length > 20);
  assert.deepEqual(validateAllDialects(), []);
});

test("引用符内の二重引用符を1つに戻す", () => {
  assert.deepEqual(parseCsv('a\n"say ""hello"""\n'), [["a"], ['say "hello"']]);
  assert.deepEqual(parseCsv('col\n"""quoted,"" yes"""\n'), [["col"], ['"quoted," yes"']]);
});

test("文字列化と読み込みを往復できる", () => {
  const rows = [
    ["id", "memo", "note"],
    ["1", "a,b", "line1"],
    ["2", "line1\nline2", ""],
    ["3", " leading", "trailing"],
  ];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});
