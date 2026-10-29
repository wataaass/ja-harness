# ja-harness（仮の名前）

日本語で使える、コードを書くためのエージェントの実行環境（ハーネス）です。安いモデルでも実用になるよう、やりとり全体のトークンを抑えることを目指しています。

## 制作情報
- 制作期間: 2026-10-26 〜 （制作中）
- 使った AI ツール: Claude Code、OpenCode（DeepSeek V4.1 Flash）
- AI の役割と自分の役割:（自分: 方針の決定と動作確認 / AI: 実装とレビュー。DeepSeek が書き、Claude がレビューする）

## 使い方
```sh
npm install && npm run build
node dist/index.js              # 対話を始める（端末で）
node dist/index.js "指示"        # 1回だけ答えて終わる
node dist/index.js --continue   # いちばん新しいセッションの続き
```

API は OpenAI 互換。既定は OpenCode Go（`JA_HARNESS_BASE_URL`・`JA_HARNESS_MODEL`・`JA_HARNESS_API_KEY` で変える）。

| キー | すること |
| --- | --- |
| Enter / Shift+Enter・Ctrl+J | 送る / 改行 |
| Shift+Tab | モードを回す（実行・計画・質問） |
| Esc | 止める。承認のカードでは却下 |
| Enter（カード） | 今回だけ許可・採用。`a` 常に許可、`e` 理由を書く |
| Ctrl+R | このやりとりの変更を見直す |
| Ctrl+O | 途中経過の見せ方を切り替える |
| ↑ / ↓ | 前の入力をたどる（作業中は待ち行列の文を呼び戻す） |
| Ctrl+D 2回 | 終了 |

`.ja-harness/config.json` に `{"ui": {"enter": "newline"}}` と書くと、Enter で改行・空の行で Enter で送信になる。

決まりのファイル: `~/.ja-harness/` と作業フォルダの `AGENTS.md`（なければ `CLAUDE.md`）と `JA_HARNESS.md` を、起動と `/clear` のときに読んで AI に渡す。

スキル: `~/.ja-harness/skills/<名前>/SKILL.md`（作業フォルダの `.ja-harness/skills/` も）に置く。AI には名前と説明だけを渡し、使うときに本文を読む。`/skills` で有効・無効を切り替え（無効にした分はトークンを使わない）、`/skills add <GitHub の URL かフォルダ>` で入れる、`/<スキル名>` で呼ぶ。「スキルを作って」と頼むと標準の `skill-creator` が使われる。

MCP: 設定の `mcp.servers` に書いた MCP サーバー（stdio）につなぐ。`/mcp add <名前> <command> [args...]` でも足せる。AI には道具の名前と1文だけを渡し、使うときに引数の形を読ませる。道具は実行の前に確認する。`/mcp` で有効・無効を切り替える（次の `/clear` か起動から効く）。標準で入れているサーバーはない。

主なコマンド: `/mode`・`/permission`・`/model`・`/undo`・`/resume`・`/clear`・`/compact`・`/context`・`/skills`・`/mcp`・`/details`・`/help`。`@` でファイルを指定できる。

品質と料金の測定は `node dist/index.js bench`（`bench/RESULTS.md`）。

## 使っている技術
- Node.js 22 以上、TypeScript
- @modelcontextprotocol/sdk（MCP）
- Biome（lint・整形）、tsc（型チェック）、Vitest（テスト）

## 設計上の判断
- **日本語で安く使えるコードのエージェント**: 会話の要約や古いツール出力を隠すなど、トークンを減らす手段はハーネスの側にあるため（[nihongo-kit の調査](https://github.com/wataaass/nihongo-kit/blob/main/docs/research/reports/%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E5%89%8A%E6%B8%9B%20%E8%AA%BF%E6%9F%BB.md)）
- **v0.1 の範囲**: API の接続、端末での日本語の対話と基本の道具、トークンを抑える文脈管理、MCP 対応（標準のサーバーは入れない）
- **TypeScript**: nihongo-kit とそろえ、評価の部品を流用するため

詳しくは [`DECISIONS.md`](DECISIONS.md) にあります。

## ライセンス
MIT
