export function normalizeWhitespace(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

export function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n");
}

export function lines(text) {
  return normalizeNewlines(text).split("\n");
}

export function isBlank(text) {
  return String(text).trim() === "";
}

export function toHalfWidth(text) {
  return String(text).replace(/[\uFF01-\uFF5E]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  ).replace(/\u3000/g, " ");
}

export function toFullWidth(text) {
  return String(text).replace(/[!-~]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0xfee0),
  ).replace(/ /g, "\u3000");
}

export function stripAccents(text) {
  return String(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function removeControlChars(text) {
  return String(text).replace(/[\u0000-\u001f\u007f]/g, "");
}

export function charLength(text) {
  return [...String(text)].length;
}

export function byteLength(text) {
  return new TextEncoder().encode(String(text)).length;
}

export function capitalize(text) {
  const value = String(text);
  if (value === "") return "";
  return value[0].toUpperCase() + value.slice(1);
}

export function decapitalize(text) {
  const value = String(text);
  if (value === "") return "";
  return value[0].toLowerCase() + value.slice(1);
}

export function titleCase(text) {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => capitalize(word.toLowerCase()))
    .join(" ");
}

export function camelCase(text) {
  const words = wordsOf(text);
  return words
    .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word.toLowerCase())))
    .join("");
}

export function pascalCase(text) {
  return wordsOf(text)
    .map((word) => capitalize(word.toLowerCase()))
    .join("");
}

export function snakeCase(text) {
  return wordsOf(text)
    .map((word) => word.toLowerCase())
    .join("_");
}

export function kebabCase(text) {
  return wordsOf(text)
    .map((word) => word.toLowerCase())
    .join("-");
}

function wordsOf(text) {
  return stripAccents(String(text))
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function truncate(text, maxLength, suffix = "…") {
  const value = String(text);
  const limit = Math.max(0, Math.floor(maxLength));
  if (charLength(value) <= limit) return value;
  if (limit <= charLength(suffix)) return [...value].slice(0, limit).join("");
  return [...value].slice(0, limit - charLength(suffix)).join("") + suffix;
}

export function truncateMiddle(text, maxLength, marker = "…") {
  const value = [...String(text)];
  const limit = Math.max(0, Math.floor(maxLength));
  if (value.length <= limit) return value.join("");
  if (limit <= marker.length) return value.slice(0, limit).join("");
  const remaining = limit - marker.length;
  const left = Math.ceil(remaining / 2);
  const right = Math.floor(remaining / 2);
  return value.slice(0, left).join("") + marker + value.slice(value.length - right).join("");
}

export function ellipsis(text, maxLength) {
  return truncate(text, maxLength, "…");
}

export function padStart(text, width, fill = " ") {
  return String(text).padStart(width, fill);
}

export function padEnd(text, width, fill = " ") {
  return String(text).padEnd(width, fill);
}

export function wrapText(text, width = 80) {
  const limit = Math.max(1, Math.floor(width));
  const result = [];
  for (const paragraph of normalizeNewlines(text).split("\n")) {
    if (paragraph === "") {
      result.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      if (current === "") {
        current = word;
      } else if ((current + " " + word).length <= limit) {
        current += " " + word;
      } else {
        result.push(current);
        current = word;
      }
    }
    if (current !== "") result.push(current);
  }
  return result.join("\n");
}

export function indent(text, spaces = 2) {
  const prefix = " ".repeat(Math.max(0, Math.floor(spaces)));
  return lines(text)
    .map((line) => (line === "" ? line : prefix + line))
    .join("\n");
}

export function dedent(text) {
  const value = normalizeNewlines(text);
  const parts = value.split("\n");
  const widths = parts
    .filter((line) => line.trim() !== "")
    .map((line) => line.match(/^ */)[0].length);
  const width = widths.length === 0 ? 0 : Math.min(...widths);
  return parts.map((line) => line.slice(width)).join("\n");
}

export function quote(text, mark = '"') {
  return `${mark}${String(text)}${mark}`;
}

export function unquote(text) {
  const value = String(text);
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unescapeHtml(text) {
  return String(text)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function stripHtml(text) {
  return String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function uniqueWords(text) {
  return [...new Set(tokenize(text))];
}

export function wordFrequency(text) {
  const counts = {};
  for (const word of tokenize(text)) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
}

export function reverse(text) {
  return [...String(text)].reverse().join("");
}

export function repeat(text, count, separator = "") {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => String(text)).join(separator);
}

export function replaceAll(text, search, replacement) {
  return String(text).split(String(search)).join(String(replacement));
}

export function startsWith(text, prefix) {
  return String(text).startsWith(String(prefix));
}

export function endsWith(text, suffix) {
  return String(text).endsWith(String(suffix));
}

export function equalsIgnoreCase(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

export function containsIgnoreCase(text, search) {
  return String(text).toLowerCase().includes(String(search).toLowerCase());
}

export function levenshtein(left, right) {
  const a = [...String(left)];
  const b = [...String(right)];
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) table[i][0] = i;
  for (let j = 0; j < cols; j += 1) table[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      table[i][j] = Math.min(
        table[i - 1][j] + 1,
        table[i][j - 1] + 1,
        table[i - 1][j - 1] + cost,
      );
    }
  }
  return table[a.length][b.length];
}

export function similarity(left, right) {
  const a = String(left);
  const b = String(right);
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

export function sanitizeFileName(text, replacement = "_") {
  return String(text)
    .replace(/[\\/:*?"<>|]/g, replacement)
    .replace(/\s+/g, replacement)
    .replace(new RegExp(`${escapeRegExp(replacement)}{2,}`, "g"), replacement)
    .replace(new RegExp(`^${escapeRegExp(replacement)}|${escapeRegExp(replacement)}$`, "g"), "");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mask(text, visible = 4, maskChar = "*") {
  const value = String(text);
  if (value.length <= visible) return maskChar.repeat(value.length);
  return maskChar.repeat(value.length - visible) + value.slice(value.length - visible);
}

export function splitByLength(text, length) {
  const size = Math.max(1, Math.floor(length));
  const chars = [...String(text)];
  const parts = [];
  for (let i = 0; i < chars.length; i += size) {
    parts.push(chars.slice(i, i + size).join(""));
  }
  return parts;
}

export function countOccurrences(text, search) {
  if (search === "") return 0;
  return String(text).split(String(search)).length - 1;
}

export function ordinal(number) {
  const value = Math.floor(Number(number));
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function pluralize(word, count) {
  if (Number(count) === 1) return String(word);
  const value = String(word);
  if (/(s|sh|ch|x|z)$/.test(value)) return value + "es";
  if (/[^aeiou]y$/.test(value)) return value.slice(0, -1) + "ies";
  return value + "s";
}

export function initials(text) {
  return String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word][0].toUpperCase())
    .join("");
}

export function sentenceCase(text) {
  const value = normalizeWhitespace(text).toLowerCase();
  if (value === "") return "";
  const match = value.match(/^[^.!?]*[.!?]/);
  if (match) return capitalize(match[0]) + value.slice(match[0].length);
  return capitalize(value);
}

export function trimEachLine(text) {
  return lines(text).map((line) => line.trim()).join("\n");
}

export function removeEmptyLines(text) {
  return lines(text)
    .filter((line) => line.trim() !== "")
    .join("\n");
}

export function columns(text, separator = "\t") {
  return lines(text).map((line) => line.split(separator));
}

export function compareNatural(left, right) {
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function excerpt(text, keyword, radius = 40) {
  const value = String(text);
  const index = value.toLowerCase().indexOf(String(keyword).toLowerCase());
  if (index === -1) return truncate(value, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(value.length, index + String(keyword).length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < value.length ? "…" : "";
  return prefix + value.slice(start, end) + suffix;
}

export function isAscii(text) {
  return /^[\x00-\x7F]*$/.test(String(text));
}

export function toAscii(text) {
  return stripAccents(String(text)).replace(/[^\x00-\x7F]/g, "");
}

export function normalizeKana(text) {
  return String(text)
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/\u30fc/g, "-");
}

export function countByType(text) {
  const value = String(text);
  return {
    letters: (value.match(/\p{L}/gu) ?? []).length,
    digits: (value.match(/\p{N}/gu) ?? []).length,
    spaces: (value.match(/\s/gu) ?? []).length,
    others: charLength(value) - (value.match(/[\p{L}\p{N}\s]/gu) ?? []).length,
  };
}

export function ensurePrefix(text, prefix) {
  const value = String(text);
  return value.startsWith(prefix) ? value : String(prefix) + value;
}

export function ensureSuffix(text, suffix) {
  const value = String(text);
  return value.endsWith(suffix) ? value : value + String(suffix);
}

export function removePrefix(text, prefix) {
  const value = String(text);
  return value.startsWith(prefix) ? value.slice(String(prefix).length) : value;
}

export function removeSuffix(text, suffix) {
  const value = String(text);
  return value.endsWith(suffix) ? value.slice(0, value.length - String(suffix).length) : value;
}

export function escapeRegExpText(text) {
  return escapeRegExp(text);
}
