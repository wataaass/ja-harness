/**
 * include で読み込む部分テンプレートの置き場所。
 *
 * 画面ごとに、名前とテンプレートの本文を渡す。ファイルを読むのは
 * 呼び出し側の仕事にして、ここでは文字列だけを扱う。
 */

import { TemplateError } from "./errors.js";

/**
 * 名前から本文を引く置き場所。
 */
export class TemplateStore {
  /**
   * @param {Record<string, string>|Map<string, string>|undefined} templates
   */
  constructor(templates) {
    this.templates = new Map();
    if (templates instanceof Map) {
      for (const [name, body] of templates) {
        this.set(name, body);
      }
    } else if (templates !== undefined) {
      for (const [name, body] of Object.entries(templates)) {
        this.set(name, body);
      }
    }
  }

  /**
   * テンプレートを入れる。
   *
   * @param {string} name
   * @param {string} body
   * @returns {TemplateStore}
   */
  set(name, body) {
    if (typeof name !== "string" || name === "") {
      throw new TypeError("テンプレートの名前は空でない文字列です");
    }
    if (typeof body !== "string") {
      throw new TypeError("テンプレートの本文は文字列です");
    }
    this.templates.set(name, body);
    return this;
  }

  /**
   * 本文を返す。
   *
   * @param {string} name
   * @returns {string|undefined}
   */
  get(name) {
    return this.templates.get(name);
  }

  /**
   * 本文を返す。なければエラー。
   *
   * @param {string} name
   * @param {number} [line]
   * @returns {string}
   */
  require(name, line) {
    const body = this.templates.get(name);
    if (body === undefined) {
      throw new TemplateError(
        `include のテンプレートがありません: ${name}`,
        line,
      );
    }
    return body;
  }

  /**
   * 名前があるか。
   *
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.templates.has(name);
  }

  /**
   * 名前の一覧。
   *
   * @returns {string[]}
   */
  names() {
    return [...this.templates.keys()];
  }

  /**
   * 件数。
   *
   * @returns {number}
   */
  get size() {
    return this.templates.size;
  }
}

/**
 * 置き場所を作る。
 *
 * @param {Record<string, string>|Map<string, string>|undefined} templates
 * @returns {TemplateStore}
 */
export function createStore(templates) {
  return new TemplateStore(templates);
}
