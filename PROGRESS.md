# 進捗

最終更新: 2026-10-27

## 今の状態
- main: 最初のコミット（README・CLAUDE.md・DECISIONS.md・LICENSE）
- PR #2（claude/scaffold、下書き）: 確認の仕組みの雛形。`npm run check` が通る
- PR #3 に、道具の結果を入れる時点で短くする仕組み（`src/context/spill.ts`、全文は `.ja-harness/out/`）と価格の判断（書き込みの料金込み）を足した。テスト118件
- PR #3（claude/agent-loop、#2 の上、下書き）: API のクライアント、往復、文脈管理（要約・切り詰め・あふれの再送・くり返しの注意）、1回だけ動かす CLI。テスト96件。本物の API で確認済み
- PR #4（claude/tools、#3 の上、下書き）: 基本の道具 read・list・grep（rg があれば使い、なければ Node）・edit（str_replace、字下げを無視したゆるい一致）・write（新しいファイルだけ）・shell（プロセスグループごと止める）。CLI につなぎ、編集とシェルの前に端末で y/n を聞く（仮。差分のまとまりごとの採否は対話の画面で作る）。テスト212件。本物の API で読み取り・編集・シェル・確認中の Ctrl+C を確認済み
- PR #5（claude/bench、#4 の上、下書き）: `ja-harness bench`（課題×条件×回、隠した grade で採点、`--validate`・`--rerun-errors`・`--prepare`/`--grade`）と課題8件。テスト249件。結果は `bench/RESULTS.md`
  - 2026-10-27: DeepSeek・MiMo・Qwen の各72回で品質は落ちていない。料金は DeepSeek −17%・MiMo −15%、Qwen は +6%（読み直しが増えた）。`docs/design/context.md` の「本物の API での品質と料金」
- PR #6（claude/ui、#5 の上、下書き）: 対話の画面。`docs/design/ui.md` の項目はすべて入れた（モード・権限・計画・まとまりごとの採否・Ctrl+R・`/undo`・`/` と `@`・`/model`・セッションの保存と再開・`/context`・`/compact`・i18n）。テスト464件。疑似端末と本物の API で確認済み
- PR #1（claude/design-ui、下書き）: v0.1 の設計
  - `docs/design/ui.md`: 画面（流れる形＋状態の行）、3つのモード、差分での確認、`/undo`、入力（IME の Enter）、`/` コマンド、セッションの保存、言語
  - `docs/design/context.md`: 往復、価格で決める masking、要約（64Kか上限の50%）、道具の結果の上限、キャッシュを壊さない決まりと hit 率の表示、そのほかの削減18項目、言語の設定、文字のそろえ方、設定ファイルの例
  - 2026-10-26: 料金は「1つの課題を終えるまでの総額」で比べ、最小の測定（`ja-harness bench`）を v0.1 に入れると決めた
  - 2026-10-26: DSH から4つ（要約をキャッシュに乗せる、要約の前の切り詰めとくり返しの促し、system prompt を途中で変えない、あふれたら再送）を取り入れた
  - `docs/research/reports/ハーネスのトークン削減技術.md`: 調査レポート（メモは `docs/research/research_notes/`）

## 次にやること
1. 本人が対話の画面を実際の端末で触って確かめる（日本語入力の Enter、端末ごとの Shift+Enter、色）
2. 道具の結果の上限（2,000・8,000）を価格から決める（キャッシュの割引が小さいモデルでは、上限を上げて読み直しを減らすほうが安い可能性）。決める前に本人に確認する
3. bench の課題をもう少し難しくする（DeepSeek は3条件とも9割以上通る）
4. 設定ファイル（`.ja-harness/config.json`）: 既定の権限・`ui.theme`・言語。いまは環境変数だけ
5. v0.1 の残り: MCP 対応（nihongo-kit を標準で入れる）、subagent、リポジトリの地図など `docs/design/context.md` の「そのほかの削減」

## 覚えておくこと
- 目的は料金の最適化（トークンの数ではない）。DeepSeek V4.1 Flash は cache hit が miss の約50分の1
- 実装は DeepSeek（`opencode run -m opencode-go/deepseek-v4.1-flash --variant high`、メッセージは `-f` より前に書く）に書かせ、Claude がレビューする。無料のモデルはクラウドでは使えなかった
- OpenCode Go の利用枠は応答の allowance で減り、Haiku は表示価格の約4倍。5時間で月の20%、1週間で50%まで
- このリポジトリの文書では専門用語をそのまま使ってよい
- 他の作品からは考え方だけを借り、コードや文章は写さない
- クラウドで Node から API を呼ぶときは `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` が要る（プロキシが認証情報を付けるため）。OpenCode Go の OpenAI 互換の URL は `https://opencode.ai/zen/go/v1` で、`x-opencode-session` が必須
- 要約が使えなかった（短くならない）ときは、次の回にまた要約を試み、そのたびに料金がかかる。道具を作って長い会話で困るようなら、失敗したあとはしばらく試さない仕組みを足す
- 測定の結果と減らす順番: DECISIONS.md の「減らす順番は…」の項と `docs/design/context.md` の「測定の結果」。測定のスクリプトは `.bench/`（コミットしない）
- 本人は、測定を OpenCode の API ではなく仮想の計算でやってほしいと言った（2026-10-26）。そのあと品質を見るため本物の API での測定も頼まれた（2026-10-27）。Haiku での測定は不要と言われた
- 仮想の測定のスクリプト（`.bench/sim.mjs`）はコミットしておらず、コンテナの作り直しで消えた。結果は `docs/design/context.md` の「仮想の測定」に残っている
- コンテナはよく再起動する。長い測定は課題ごとに分けて回す（1課題ずつ結果が保存される）。`bench/results/` はコミットしないので、残す数字は `bench/RESULTS.md` に書く
- OpenCode の DeepSeek が、ある関数の直し（spill.ts）で3回続けて20分以上止まった。本人の指示で、Claude Code の subagent（Haiku 5.5）に頼むと約2分で終わった。DeepSeek が2回止まったら、Haiku 5.5 に切り替えるか本人に聞く
- `opencode run` は `< /dev/null` を付けて実行する（付けずにバックグラウンドで動かしたとき、25分なにも出さずに止まった）。外のフォルダを触ると自動で断られて止まるので、`~/.config/opencode/opencode.json` に `"permission":{"external_directory":"allow"}` を書いておく（コンテナを作り直したら再び要る）
- CLI を端末なしで確かめるときは `script -qec "<コマンド>" /dev/null` で疑似端末にし、`(sleep 25; printf 'y\n') |` で答えを流す
- 対話の画面を疑似端末で確かめるときは、pyte で画面を再現するスクリプト（pty でキーを送って画面を写す）を使う。コミットしていないので、要るときは作り直す（`pip install pyte`）
- 対話の画面は Node の標準の上に自作した（Ink は使わない）。画面の文は `src/ui/i18n/ja.ts`
