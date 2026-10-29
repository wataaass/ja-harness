/**
 * テンプレートの誤り。
 *
 * 利用者に見せる文は日本語で、どの行かを必ず入れる。
 */

/**
 * テンプレートの解析・描画の誤り。
 */
export class TemplateError extends Error {
  /**
   * @param {string} message
   * @param {number} [line]
   */
  constructor(message, line) {
    super(line === undefined ? message : `${message}（行 ${line}）`);
    this.name = "TemplateError";
    this.line = line;
  }
}

/**
 * 行番号を付けた誤りを作る。
 *
 * @param {string} message
 * @param {number} line
 * @returns {TemplateError}
 */
export function errorAt(message, line) {
  return new TemplateError(message, line);
}

/**
 * 例外を TemplateError にそろえる。
 *
 * @param {unknown} error
 * @param {number} [line]
 * @returns {TemplateError}
 */
export function asTemplateError(error, line) {
  if (error instanceof TemplateError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new TemplateError(message, line);
}

/**
 * 誤りの文から行番号を取り出す。確認用。
 *
 * @param {unknown} error
 * @returns {number|undefined}
 */
export function lineOf(error) {
  return error instanceof TemplateError ? error.line : undefined;
}
