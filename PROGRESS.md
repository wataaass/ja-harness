# 進捗

最終更新: 2026-10-28

## 今の状態
- main: 最初のコミット（README・CLAUDE.md・DECISIONS.md・LICENSE）
- PR #2（claude/scaffold、下書き）: 確認の仕組みの雛形。`npm run check` が通る
- PR #3 に、道具の結果を入れる時点で短くする仕組み（`src/context/spill.ts`、全文は `.ja-harness/out/`）と価格の判断（書き込みの料金込み）を足した。テスト118件
- PR #3（claude/agent-loop、#2 の上、下書き）: API のクライアント、往復、文脈管理（要約・切り詰め・あふれの再送・くり返しの注意）、1回だけ動かす CLI。テスト96件。本物の API で確認済み
- PR #4（claude/tools、#3 の上、下書き）: 基本の道具 read・list・grep（rg があれば使い、なければ Node）・edit（str_replace、字下げを無視したゆるい一致）・write（新しいファイルだけ）・shell（プロセスグループごと止める）。CLI につなぎ、編集とシェルの前に端末で y/n を聞く（仮。差分のまとまりごとの採否は対話の画面で作る）。テスト212件。本物の API で読み取り・編集・シェル・確認中の Ctrl+C を確認済み
- PR #5（claude/bench、#4 の上、下書き）: `ja-harness bench`（課題×条件×回、隠した grade で採点、`--validate`・`--rerun-errors`・`--prepare`/`--grade`）と課題8件。テスト249件。結果は `bench/RESULTS.md`
  - 2026-10-27: DeepSeek・MiMo・Qwen の各72回で品質は落ちていない。料金は DeepSeek −17%・MiMo −15%、Qwen は +6%（読み直しが増えた）。`docs/design/context.md` の「本物の API での品質と料金」
- PR #6（claude/ui、#5 の上、下書き）: 対話の画面。`docs/design/ui.md` の項目はすべて入れた（モード・権限・計画・まとまりごとの採否・Ctrl+R・`/undo`・`/` と `@`・`/model`・セッションの保存と再開・`/context`・`/compact`・i18n・設定ファイル `.ja-harness/config.json`）。テスト477件。疑似端末と本物の API で確認済み。疑似端末で、分かれて届く UTF-8・Shift+Enter（kitty と xterm の2種類）・Ctrl+J・貼り付け・色（24ビット・256色・NO_COLOR・明るい背景）も確かめた
- PR #1（claude/design-ui、下書き）: v0.1 の設計
  - `docs/design/ui.md`: 画面（流れる形＋状態の行）、3つのモード、差分での確認、`/undo`、入力（IME の Enter）、`/` コマンド、セッションの保存、言語
  - `docs/design/context.md`: 往復、価格で決める masking、要約（64Kか上限の50%）、道具の結果の上限、キャッシュを壊さない決まりと hit 率の表示、そのほかの削減18項目、言語の設定、文字のそろえ方、設定ファイルの例
  - 2026-10-26: 料金は「1つの課題を終えるまでの総額」で比べ、最小の測定（`ja-harness bench`）を v0.1 に入れると決めた
  - 2026-10-26: DSH から4つ（要約をキャッシュに乗せる、要約の前の切り詰めとくり返しの促し、system prompt を途中で変えない、あふれたら再送）を取り入れた
  - `docs/research/reports/ハーネスのトークン削減技術.md`: 調査レポート（メモは `docs/research/research_notes/`）

- 2026-10-27（夜）: 本人が Windows（Windows Terminal・PowerShell）で起動して試した。日本語入力の Enter と色は良い、Shift+Enter は効かず Ctrl+J は効いた。これを受けて PR #6 に、`ui.enter`（`newline` で Enter 改行・空の行で Enter 送信）、短い表示と道具の印の英語化、権限名の英語化（Confirm・Auto-edit・Auto）、シェルの確認に目的を出す（`description`）、Windows では PowerShell で動かす、を足した。テスト495件
- 2026-10-27（夜、続き）: PR #6 に、/model を単価だけに、`/` の一覧をコマンド名だけに、シェルの目的の1行を英語に、決まりのファイル（AGENTS.md・CLAUDE.md・JA_HARNESS.md）、スキル（読み込み・`skill` の道具・`/skills` の切り替え・`/skills add`・`/<名前>`・標準の skill-creator）、Windows でホームのフォルダを `os.homedir()` で探す修正、を足した。テスト533件

- 2026-10-28: PR #6 に MCP 対応を足した。`src/mcp/`（設定からのサーバーの一覧・接続）、`src/tools/mcp.ts`（1つの `mcp` の道具。名前だけで引数の形、args 付きで実行。実行の前に確認）、`/mcp`（有効・無効の切り替え）、`/mcp add`、起動時の「つないでいます」。テスト575件。本物の DeepSeek と nihongo-kit で、引数の形を読む → 確認 → `count_chars` で正しい字数、を確かめた。疑似端末で `/mcp` の切り替えと保存も確かめた

- 2026-10-28: nihongo-kit のあり・なしを8問で測った（DECISIONS.md の「nihongo-kit を ja-harness に入れない」）。結果を受けて、標準の nihongo-kit を PR #6 から消した。テスト575件

## 次にやること
1. 本人が Windows で、PowerShell で動くシェル・確認のカードの目的・英語の表示・決まりのファイル・スキル・MCP（`/mcp add` でサーバーを足し、`/clear` のあと使わせる）を確かめる（Windows での実行はまだ一度も確かめていない）。起動は `cd $HOME\jh-test` のあと `node $HOME\ja-harness\dist\index.js`
2. Windows Terminal で Shift+Enter が効かない原因を調べる（Node が Windows でキーを受け取る仕組みで Shift が落ちている可能性）
3. 道具の結果の上限（2,000・8,000）を価格から決める（キャッシュの割引が小さいモデルでは、上限を上げて読み直しを減らすほうが安い可能性）。決める前に本人に確認する
4. bench の課題をもう少し難しくする（DeepSeek は3条件とも9割以上通る）
5. v0.1 の残り: subagent、リポジトリの地図など `docs/design/context.md` の「そのほかの削減」
6. v0.1 のあと: PC とスマホで使える Web の画面（DECISIONS.md 2026-10-27）。設計から

## 覚えておくこと
- 本人の PC は Windows（ユーザー名 gensh、PowerShell）。`npm` は実行ポリシーで止まるので `npm.cmd` を使う。外部のプログラムに `~` は渡らないので `$HOME` を使う。API キーは `$env:JA_HARNESS_API_KEY` に入れる（窓ごとに消える）
- 対話の画面を疑似端末で確かめるときは、pyte（`pip install pyte`）と、決まった tool call を返す小さな API のスタブ（ストリーミングの SSE）を使うと、カードの見た目まで確かめられる
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
