# ja-harness（仮の名前）

日本語で使える、コードを書くためのエージェントの実行環境（ハーネス）です。安いモデルでも実用になるよう、やりとり全体のトークンを抑えることを目指しています。

## 制作情報
- 制作期間: 2026-10-26 〜 （制作中）
- 使った AI ツール: Claude Code、OpenCode（DeepSeek V4.1 Flash）
- AI の役割と自分の役割:（自分: 方針の決定と動作確認 / AI: 実装とレビュー。DeepSeek が書き、Claude がレビューする）

## 使い方
（未定）

## 使っている技術
- Node.js 22 以上、TypeScript
- @modelcontextprotocol/sdk（MCP）
- Biome（lint・整形）、tsc（型チェック）、Vitest（テスト）

## 設計上の判断
- **日本語で安く使えるコードのエージェント**: 会話の要約や古いツール出力を隠すなど、トークンを減らす手段はハーネスの側にあるため（[nihongo-kit の調査](https://github.com/wataaass/nihongo-kit/blob/main/docs/research/reports/%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E5%89%8A%E6%B8%9B%20%E8%AA%BF%E6%9F%BB.md)）
- **v0.1 の範囲**: API の接続、端末での日本語の対話と基本の道具、トークンを抑える文脈管理、MCP 対応（nihongo-kit を標準で入れる）
- **TypeScript**: nihongo-kit とそろえ、評価の部品を流用するため

詳しくは [`DECISIONS.md`](DECISIONS.md) にあります。

## 参考にした作品
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): 要約をキャッシュに乗せる、要約の前の切り詰めなど、文脈管理の考え方を参考にした

## ライセンス
MIT
