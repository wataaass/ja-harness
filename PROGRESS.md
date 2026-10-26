# 進捗

最終更新: 2026-10-26

## 今の状態
- main: 最初のコミット（README・CLAUDE.md・DECISIONS.md・LICENSE）
- PR #2（claude/scaffold、下書き）: 確認の仕組みの雛形。`npm run check` が通る
- PR #3（claude/agent-loop、#2 の上、下書き）: API のクライアント、往復、文脈管理（要約・切り詰め・あふれの再送・くり返しの注意）、1回だけ動かす CLI。テスト96件。本物の API で確認済み
- PR #1（claude/design-ui、下書き）: v0.1 の設計。コードはまだない
  - `docs/design/ui.md`: 画面（流れる形＋状態の行）、3つのモード、差分での確認、`/undo`、入力（IME の Enter）、`/` コマンド、セッションの保存、言語
  - `docs/design/context.md`: 往復、価格で決める masking、要約（64Kか上限の50%）、道具の結果の上限、キャッシュを壊さない決まりと hit 率の表示、そのほかの削減18項目、言語の設定、文字のそろえ方、設定ファイルの例
  - 2026-10-26: 料金は「1つの課題を終えるまでの総額」で比べ、最小の測定（`ja-harness bench`）を v0.1 に入れると決めた
  - 2026-10-26: DSH から4つ（要約をキャッシュに乗せる、要約の前の切り詰めとくり返しの促し、system prompt を途中で変えない、あふれたら再送）を取り入れた
  - `docs/research/reports/ハーネスのトークン削減技術.md`: 調査レポート（メモは `docs/research/research_notes/`）

## 次にやること
1. 道具の結果を入れる時点で短くする（全文はファイルに保存）。PR #3 の上で作る
2. 基本の道具（ファイルの読み書き、grep、シェル。部分の読み取りを基本にする）
3. 対話の画面（入力のくり返し、状態の行、モード）
4. 測定は API を呼ばない仮想の計算（前のリクエストとの共通の先頭をキャッシュとみなす）を作り、各社の値段で比べる

## 覚えておくこと
- 目的は料金の最適化（トークンの数ではない）。DeepSeek V4.1 Flash は cache hit が miss の約50分の1
- 実装は DeepSeek（`opencode run -m opencode-go/deepseek-v4.1-flash --variant high`、メッセージは `-f` より前に書く）に書かせ、Claude がレビューする。無料のモデルはクラウドでは使えなかった
- OpenCode Go の利用枠は応答の allowance で減り、Haiku は表示価格の約4倍。5時間で月の20%、1週間で50%まで
- このリポジトリの文書では専門用語をそのまま使ってよい
- 他の作品からは考え方だけを借り、コードや文章は写さない
- クラウドで Node から API を呼ぶときは `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` が要る（プロキシが認証情報を付けるため）。OpenCode Go の OpenAI 互換の URL は `https://opencode.ai/zen/go/v1` で、`x-opencode-session` が必須
- 要約が使えなかった（短くならない）ときは、次の回にまた要約を試み、そのたびに料金がかかる。道具を作って長い会話で困るようなら、失敗したあとはしばらく試さない仕組みを足す
- 測定の結果と減らす順番: DECISIONS.md の「減らす順番は…」の項と `docs/design/context.md` の「測定の結果」。測定のスクリプトは `.bench/`（コミットしない）
- 本人は、測定を OpenCode の API ではなく仮想の計算でやってほしいと言った
