# 進捗

最終更新: 2026-10-26

## 今の状態
- main: 最初のコミット（README・CLAUDE.md・DECISIONS.md・LICENSE）
- PR #1（claude/design-ui、下書き）: v0.1 の設計。コードはまだない
  - `docs/design/ui.md`: 画面（流れる形＋状態の行）、3つのモード、差分での確認、`/undo`、入力（IME の Enter）、`/` コマンド、セッションの保存、言語
  - `docs/design/context.md`: 往復、価格で決める masking、要約（64Kか上限の50%）、道具の結果の上限、キャッシュを壊さない決まりと hit 率の表示、そのほかの削減18項目、言語の設定、文字のそろえ方、設定ファイルの例
  - `docs/research/reports/ハーネスのトークン削減技術.md`: 調査レポート（メモは `docs/research/research_notes/`）

## 次にやること
1. 本人と決める（クリアの直前に聞いた2点）:
   - 判断の基準を「1つの課題を終えるまでの総料金（失敗とやり直しを含む）」に変え、`/model` の主な数字を実績の「やりとり1回あたりの料金と往復の数」にし、1文字あたりの料金は参考にとどめる
   - 工夫ありとなしで総料金と成功率を比べる測定の仕組みを、最小の形で v0.1 に入れるか（今は「次の版」）
2. 決まったら DECISIONS.md と `docs/design/context.md` を直す
3. 確認の仕組みの雛形（package.json、TypeScript、Biome、Vitest、`npm run check`）を DeepSeek に作ってもらう。OpenCode Go の5時間の上限が戻ってから
4. DSH の URL を本人から受け取り、取り入れるものを設計に足す

## 覚えておくこと
- 目的は料金の最適化（トークンの数ではない）。DeepSeek V4.1 Flash は cache hit が miss の約50分の1
- 実装は DeepSeek（`opencode run -m opencode-go/deepseek-v4.1-flash --variant high`、メッセージは `-f` より前に書く）に書かせ、Claude がレビューする。無料のモデルはクラウドでは使えなかった
- OpenCode Go の利用枠は応答の allowance で減り、Haiku は表示価格の約4倍。5時間で月の20%、1週間で50%まで
- このリポジトリの文書では専門用語をそのまま使ってよい
- 他の作品からは考え方だけを借り、コードや文章は写さない
