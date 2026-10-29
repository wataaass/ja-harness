# 既存のコードエージェント・ハーネスが実装しているトークン・費用の削減技術（2026-10-26 時点）

調べ方: 公式文書と、公開されているソースコード（2026-10-23〜26 の HEAD を shallow clone して定数を grep）を一次資料にした。ソースの行は「ファイル名と定数名」で示し、コードは写していない。第三者の記事は二次資料と明記した。

調べたバージョン（clone の日付）:
- OpenCode: v2.1.4（CHANGELOG 2026-10-23）。リポジトリは `sst/opencode` から `anomalyco/opencode` に移った（CHANGELOG のリンク先）
- Codex CLI: `openai/codex` HEAD 2026-10-23（Cargo の version は 0.0.0 のため、リリース番号は分からない）
- Goose: 1.56.0（HEAD 2026-10-26）
- Cline: 4.1.26（HEAD 2026-10-25）
- Roo Code: 3.53.0（最後のコミットは 2026-05-15。それ以降の更新はない）
- aider: 0.86.3.dev（最後のコミットは 2026-05-22）
- SWE-agent: HEAD 2026-07-16
- Claude Code: 公式文書に v2.1.3xx までの記述がある（2026-10 時点）

## 1. 文脈管理（auto-compaction の発動条件と閾値、ツール結果の消去、ファイル読み取りの重複除去、メモリファイル、サブエージェント、todo）

### Takeaway
どのハーネスも「文脈の X% で LLM 要約」を持つ。閾値は 80〜95% に集まり、Codex は 90%、Cline は 90%、Goose は 80%、Amp Neo は 90% にしている。それより早い段階で古いツール出力を消すのは OpenCode 系（v1 の prune、Kilo の既定オン）、SWE-agent（直近5件）、OpenHands（イベント数で要約）、Cursor・Claude Code（大きな出力をファイルに逃がす）だけ。OpenCode 2.x は prune の設定を外し、要約を前もって作る方式と「要約のときに古い出力から順に削る」方式に移った。

### 比較表（全問の要約）

| ハーネス | 自動要約の発動 | 早めの削減（masking・prune） | ツール出力の上限 | キャッシュ | 安いモデルへの振り分け |
|---|---|---|---|---|---|
| Claude Code | 1M 窓のモデルで約967K、ほかは200K 境界。`/autocompact` で 100K〜1M に変更可 | 古いツール結果の消去あり（キャッシュの「expected rebuild」として数える）。閾値は非公開 | 大きい出力はファイルへ（二次資料）。要約後は最近のファイル5件まで、1件5,000トークンまで読み直す | 層の順（system＋tools → CLAUDE.md → 会話）。TTL は API 利用で5分、サブスクで1時間。`/usage` にヒット率 | サブエージェントに `model: haiku`、`opusplan`、背景の要約・タイトル |
| Codex CLI | 窓の90%（`model_auto_compact_token_limit` を指定するとその小さいほう）。使える窓は95% | なし（要約のときにツール出力を落とす。二次資料） | 既定 10,000 バイト（model info の既定）。`tool_output_token_limit`、ツールごとの上限（v0.152） | `prompt_cache_key` をセッションから作る | `review_model`、サブエージェントの reasoning effort |
| OpenCode 2.1 | 窓の15%（最低16,000）を残して発動。直近 `keep` 15,000 トークンを原文で残す。85% で裏で要約を先に作る（実験的） | v1 の `compaction.prune` は 2.x で設定を外した（設定すると「unsupported」） | 2,000 行または 50 KiB。超えた分はファイルに保存し、7日保持 | Anthropic 形式で breakpoint 最大4つ。OpenAI は `prompt_cache_key`・TTL | `small_model`（タイトルなど） |
| Kilo Code | `threshold_percent`（既定は未設定）か、予備の残り（min(20,000, 最大出力)）の早いほう | prune 既定オン。直近 40,000 トークンより古いツール出力を置き換える。`tail_turns` 2 | 文書に記載なし | 文書に記載なし | `agent.compaction.model` で要約用モデルを分けられる |
| Cline 4.1 | 入力上限の90%で発動し、70%まで縮める。直近20,000トークンを残す | 要約の入力では、ツール結果とファイル内容を各2,000文字に切る | 上記 | 要約は会話のキャッシュに乗るので「ツール呼び出し1回分ほど」（公式文書） | 文書に記載なし |
| Roo Code 3.53 | `autoCondenseContextPercent` 既定100（5〜100で、プロファイルごとに変えられる）。予備として窓の10% | 要約に失敗したら sliding window で切る | 確認できず | 確認できず | 要約用 API プロファイルを選べる |
| Goose 1.56 | 窓の80%。ただし225,000トークンを超えないよう閾値を下げる | `GOOSE_TOOL_PAIR_SUMMARIZATION`（既定オフ）で古いツール呼び出し10組ずつを要約する | シェル 2,000 行または 50,000 バイト。超えたら50行のプレビュー | 確認できず | lead/worker（強いモデルで始めて安いモデルに渡す） |
| aider | 履歴が `max_chat_history_tokens`（入力上限の1/16、1,024〜8,192）を超えたら weak model で要約 | なし（ファイルを明示して入れる設計） | ―（repo map は既定1,024トークン） | system → 例 → repo map → 読み取り専用ファイル → 編集ファイルの順に cache_control。keepalive の ping | weak model（要約・コミットメッセージ）、architect/editor |
| SWE-agent | なし（窓に頼る） | `last_n_observations`（論文の設定は n=5）。`polling` でキャッシュとの両立を図る | 観測1件 100,000 文字まで | `cache_control` 処理器が直近2件に印を付ける | ― |
| OpenHands | LLMSummarizingCondenser（120イベントで発動、最初の4件を残し、60件まで縮める） | condenser の pipeline を組める | 確認できず | 確認できず | 要約に安い LLM を渡せる |
| Cursor | 窓が埋まったら要約する。履歴をファイルとして渡し、検索させる | 長い出力・端末の出力をファイルに逃がす | ファイルに保存 | 確認できず | 確認できず |
| Amp | 2025-10 に compaction を外して Handoff に替え、2026-05 の Neo で90%の自動要約を戻した | Handoff（新しいスレッドに要点とファイルだけを渡す）、`read_thread` は別モデルで抜き出す | @ で指定したファイルは500行・1行2KB まで | 確認できず | `read_thread`・Handoff で別のモデルを使う |
| Continue | 信頼できる資料が見つからなかった | ― | ― | ― | ― |

### Cited Findings
**Claude Code**
- 自動要約の位置: 1M の窓をもつモデル（Fable 5.x、Sonnet 5 以降、Haiku 5.5、Opus 4.7 以降）は約967K トークン、Sonnet/Opus 4.6 の通常の窓や不明なモデル ID は200K 境界。`/autocompact`・`autoCompactWindow`・`CLAUDE_CODE_AUTO_COMPACT_WINDOW` で100K〜1M に設定できる（v2.1.288 からモデルごと） — [Claude Code: model-config](https://code.claude.com/docs/en/model-config)
- 要約後に残るもの: CLAUDE.md・auto memory・plan は disk から入れ直す。読んだか編集したファイルを、最近変更した順に最大5件読み直す。5,000トークンを超えるファイルはパスだけにする。呼び出し済みのスキル本文は1件5,000トークン、合計25,000トークンまで入れ直す — [Claude Code: context-window](https://code.claude.com/docs/en/context-window)
- 古いツール結果の消去は実装されている。`/usage` のキャッシュ統計では、compaction と「clearing old tool results」によるキャッシュの作り直しを「expected rebuild」として数える。消去の閾値は公開されていない — [Claude Code: costs](https://code.claude.com/docs/en/costs)、[prompt-caching](https://code.claude.com/docs/en/prompt-caching)
- API の context editing では、古いツール結果を時系列に消してプレースホルダに置き換えられる（`clear_tool_inputs` で入力も消せる） — [Claude Platform: context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing)
- v2.1.32 では、ツール出力が往復の間に消えずにたまるという回帰の報告がある（2026-02、第三者のミラー） — [claudeissues.com #25666](https://claudeissues.com/issue/25666-context-editing-tool-result-clearing-regression-dynamic-context-management-lost)
- ファイル読み取りの扱い: 前に読んだファイルを編集しても、履歴の読み取りは書き換えない。代わりに「ファイルが変わった」という `<system-reminder>` を末尾に足す（キャッシュを守るため） — [Claude Code: prompt-caching](https://code.claude.com/docs/en/prompt-caching)
- CLAUDE.md は200行以内を推奨している。作業ごとの指示はスキル（呼ばれたときだけ読む）に移すよう勧めている。MCP のツール定義は既定で後から読む（deferred。名前だけを入れる） — [Claude Code: costs](https://code.claude.com/docs/en/costs)
- サブエージェント: 長い出力の作業を任せ、要約だけを戻す。agent teams は plan mode で通常の約7倍のトークンを使う — [Claude Code: costs](https://code.claude.com/docs/en/costs)
- 手で要約するときは `/compact <焦点>`、一部だけ要約するときは `/rewind` の「Summarize from/up to here」。`/clear` は費用ゼロ。`/compact` 自体が大きなリクエストになる — [Claude Code: context-window](https://code.claude.com/docs/en/context-window)、[costs](https://code.claude.com/docs/en/costs)
- 1時間 TTL で放置した長い会話は自動で要約される（idle compaction。v2.1.290 から `idleCompaction` で止められる） — [Claude Code: prompt-caching](https://code.claude.com/docs/en/prompt-caching)

**Codex CLI**
- 自動要約の閾値は、窓の 9/10 と `model_auto_compact_token_limit` の小さいほう（`openai_models.rs` の `auto_compact_token_limit`）。推論に使える窓は、既定で窓の95%（`effective_context_window_percent`） — [openai/codex: protocol/src/openai_models.rs](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/openai_models.rs)、[models-manager/src/model_info.rs](https://github.com/openai/codex/blob/main/codex-rs/models-manager/src/model_info.rs)
- 設定: `model_auto_compact_token_limit`（未設定ならモデルの既定）、`model_auto_compact_token_limit_scope`（`total` か `body_after_prefix`）、`compact_prompt`、プロバイダの `remote_compaction`（`v2` なら Responses API 側で要約する） — [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- 要約では、ユーザーのメッセージを最大20,000トークン残す（`compact.rs` の `COMPACT_USER_MESSAGE_MAX_TOKENS`） — [openai/codex: core/src/compact.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/compact.rs)
- 閾値の既定について、第三者の記事は「約200,000」「窓の80%」「95%」と食い違っている。ソースの値は90%（上記） — [codex.danielvaughan.com（2026-04-16）](https://codex.danielvaughan.com/2026/04/16/codex-cli-context-compaction-tuning-long-sessions/)
- 要約でツール出力が履歴から消えるため、要約のあとにファイルを読み直すことがある（第三者） — [codex.danielvaughan.com](https://codex.danielvaughan.com/2026/04/16/codex-cli-context-compaction-tuning-long-sessions/)
- AGENTS.md は合計32 KiB まで（`DEFAULT_PROJECT_DOC_MAX_BYTES`）。上から下へ読み、超えた分は切る — [openai/codex: config/src/config_toml.rs](https://github.com/openai/codex/blob/main/codex-rs/config/src/config_toml.rs)

**OpenCode（2.1.4）**
- 自動要約の前に、窓の15%（`RESERVE_SHARE`、最低 `RESERVE_MIN` 16,000）を空けておく。ソースの注釈では、実際のセッションで1回の往復で増える量が p99 で約22,000トークンだったので、この余白を取ったとある — [anomalyco/opencode: packages/core/src/session/compaction.ts](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/session/compaction.ts)
- 既定は `auto: true`、`keep: 15_000`（直近をこのトークン数だけ原文で残す）、`precompute: false` — 同上
- 背景での要約（実験的、v2.1.4）: 閾値の85%で裏で要約を作り始め、自動要約のときに差し替える（64,000トークン未満なら作らない）。使われなかった要約もトークンを使う — 同上、[CHANGELOG v2.1.4](https://github.com/anomalyco/opencode/blob/dev/CHANGELOG.md)
- 要約リクエストがプロバイダの上限を超えたら、古いやりとりから「ツール出力を切る → 出力を外し入力を切る → ユーザーの文だけ → 省く」の順に縮める。切るときは先頭と末尾を2,000文字ずつ残す（v2.1.4、#58015） — 同上
- `compaction.prune` と `compaction.tail_turns` は 2.x の設定から外され、指定すると「unsupported」の診断を出す（`config/normalize.ts`）。一方、公式文書の config ページには `prune`（既定 false）がまだ載っている — [anomalyco/opencode: packages/core/src/config/normalize.ts](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/config/normalize.ts)、[OpenCode config docs](https://opencode.ai/docs/config/)
- v1 の prune（第三者の説明）: 新しい順にツール出力を数え、直近40,000トークン（`PRUNE_PROTECT`）より古いものを消す。消せる量が20,000トークン（`PRUNE_MINIMUM`）を超えるときだけ動く — [learnopencode.com](https://learnopencode.com/en/5-advanced/20-compaction)

**Kilo Code**（OpenCode 系）
- 発動は `threshold_percent`（1〜100、既定は未設定）か、残りが予備（`reserved` = min(20,000, 最大出力)。入力上限のないモデルは最大出力、上限32,000）に達したときの早いほう。`prune` は既定 true で、直近40,000トークンより古い完了済みツール出力を「[Old tool result content cleared]」に置き換える。`tail_turns` 2、`preserve_recent_tokens` は使える文脈の25%（2,000〜8,000に収める） — [Kilo docs: Context Condensing](https://kilo.ai/docs/customize/context/context-condensing)

**Cline（4.1.26）**
- 要約の発動は入力上限の90%（`COMPACTION_TRIGGER_RATIO`）、縮める目標は70%（`DEFAULT_TARGET_RATIO`）、直近20,000トークンを残す（`DEFAULT_PRESERVE_RECENT_TOKENS`）、要約の出力は最大8,192。要約に入れるツール結果とファイル内容は各2,000文字まで。上限が不明なら128,000とみなす — [cline/cline: sdk/packages/core/src/extensions/context/compaction-shared.ts](https://github.com/cline/cline/blob/main/sdk/packages/core/src/extensions/context/compaction-shared.ts)
- 公式文書: 要約は会話のキャッシュに乗るので「ほかのツール呼び出しとほぼ同じ費用」。対応していないモデルでは、規則で古いメッセージを切る方式に戻る。チェックポイントで要約前に戻せる — [Cline docs: Auto Compact](https://github.com/cline/cline/blob/main/docs/features/auto-compact.mdx)

**Roo Code（3.53.0）**
- `autoCondenseContextPercent` の既定は100（`Task.ts`・`ClineProvider.ts`）。設定は5〜100%で、API プロファイルごとに変えられる（`MIN/MAX_CONDENSE_THRESHOLD`）。予備として窓の10%（`TOKEN_BUFFER_PERCENTAGE`） — [RooCodeInc/Roo-Code: src/core/context-management/index.ts](https://github.com/RooCodeInc/Roo-Code/blob/main/src/core/context-management/index.ts)、[src/core/condense/index.ts](https://github.com/RooCodeInc/Roo-Code/blob/main/src/core/condense/index.ts)

**Goose（1.56.0）**
- 自動要約は窓の80%（`DEFAULT_COMPACTION_THRESHOLD`）。ただし225,000トークン（`DEFAULT_AUTO_COMPACT_TOKEN_LIMIT`）を超えないよう比率を下げる。`GOOSE_AUTO_COMPACT_THRESHOLD`・`GOOSE_AUTO_COMPACT_TOKEN_LIMIT` で変えられる — [block/goose: crates/goose-context-management/src/lib.rs](https://github.com/block/goose/blob/main/crates/goose-context-management/src/lib.rs)、[crates/goose/src/context_mgmt/mod.rs](https://github.com/block/goose/blob/main/crates/goose/src/context_mgmt/mod.rs)
- ツール呼び出しの組の要約: `GOOSE_TOOL_PAIR_SUMMARIZATION`（既定 false）。古い呼び出しと結果の組を10件ずつ（`TOOLCALL_SUMMARIZATION_BATCH_SIZE`）要約する。何件目から古いとみなすか（`GOOSE_TOOL_CALL_CUTOFF`）は、窓と閾値から計算する — 同上

**aider（0.86.3.dev）**
- 会話の履歴が `max_chat_history_tokens`（入力上限の1/16。1,024〜8,192に収める）を超えたら要約する。要約には weak model を先に使い、だめなら main model を使う — [Aider-AI/aider: aider/models.py](https://github.com/Aider-AI/aider/blob/main/aider/models.py)、[aider/coders/base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py)、[aider/history.py](https://github.com/Aider-AI/aider/blob/main/aider/history.py)

**SWE-agent**
- `last_n_observations`: 直近 n 件の観測だけを残し、古いものを「Old environment output: (n lines omitted)」に置き換える。論文（0.7）の設定は n=5。ソースの注釈は「この処理器はプロンプトのキャッシュを壊す」と書き、`polling`（n〜n+polling 件を残し、まとめて消す）で緩和するとしている。「最近のモデルは長い文脈を扱えるので、もう必須ではない」とも書いている — [SWE-agent: sweagent/agent/history_processors.py](https://github.com/SWE-agent/SWE-agent/blob/main/sweagent/agent/history_processors.py)

**OpenHands**
- 既定の LLMSummarizingCondenser: `max_size` 120イベントで発動し、最初の4件（`keep_first`）を残し、`max_size // 2`（60件）まで縮める。要約には推論用より安い LLM を渡すことが多い — [OpenHands SDK: condenser](https://docs.openhands.dev/sdk/arch/condenser)
- 測定（2025-04-09）: 1往復の API 費用が最大2分の1。SWE-bench Verified の一部で、解決率は condenser ありが54%、なしが53%。要約のための往復が増える — [OpenHands blog](https://openhands.dev/blog/openhands-context-condensensation-for-more-efficient-ai-agents)

**Cursor**
- 「dynamic context discovery」（2026-01-06、Jediah Katz）: 長いツール出力は切らずにファイルに保存し、必要な部分を読ませる（不要な要約が減った）。要約のときは履歴ファイルへの参照を渡し、要約で落ちた細部を検索させる。スキルは名前と説明だけを入れる。端末の出力をファイルに同期する — [Cursor blog](https://cursor.com/blog/dynamic-context-discovery)

**Amp**
- 2025-10 に compaction を外し、Handoff に替えた（要約を重ねると情報が落ちるため）。Handoff は、利用者が次の目的を書くと、別のモデルが要点と関係するファイルの一覧を新しいスレッドの下書きにする — [Amp: Handoff](https://ampcode.com/news/handoff)、[Amp guide: Context Management（2025-11）](https://ampcode.com/guides/context-management)
- 2026-05 の Neo（作り直した CLI）で、自動要約（90%で発動）を戻した（第三者のまとめ） — [havoptic.com: Amp 2026.05.06](https://www.havoptic.com/r/amp-neo)

### Inferences
- 発動の閾値は80〜90%に集まるが、ja-harness の決定（32K かモデルの上限の70%の小さいほう）はどの製品よりも早い。製品は窓を大きく使う前提で作られており、安いモデルで質の劣化（Context Rot）を避ける目的に合わせた既定値は見当たらない。
- 「要約の前にツール出力を消す」層を既定で持つのは Kilo（40K の window）と SWE-agent（n=5）。OpenCode は 2.x で prune の設定を外した。理由は CHANGELOG からは読み取れないが、キャッシュの再作成と、要約の中で古い出力を削る方式への移行が関係していそう（推測）。
- SWE-agent の `polling`、ja-harness の「window の外に10件たまったらまとめて隠す」、Kilo の「往復の間に少しずつ消す」は、どれも masking とキャッシュを両立させる工夫で、同じ問題への別の答えになっている。
- Claude Code の「編集したファイルは書き換えず、変わったことだけを末尾に足す」は append-only と両立する。ja-harness の「編集したファイルの古い読み取りはすぐ隠す」はプレフィックスを変えるので、キャッシュとの取引を測っておくべき。

### Gaps
- Claude Code の古いツール結果の消去の閾値と、大きな出力をディスクに逃がす閾値は、公式文書になかった（第三者の解析だけ）。
- Claude Code・Cline・Roo のファイル読み取りの重複除去が今もあるかは確かめられなかった（Cline の古い版にはあったと記憶しているが、資料で確認できていない）。
- Continue の文脈管理（compaction、ツール出力の上限）は、資料が見つからなかった。
- Todo リスト（Claude Code の TodoWrite、Codex・OpenCode の todo ツール、Cline の task list）は「要約をまたいで進み具合を保つ」とだけ書かれている（Cline 文書）。トークンへの効果を測った資料はない。
- Roo Code は2026-05 からコミットがなく、開発が続いているかは確認できなかった。

## 2. 道具の設計（編集の形式、出力の切り詰めの上限、検索、repo map、LSP）

### Takeaway
出力の上限は「2,000行か約50KB、超えたら全体をファイルに保存してプレビューを返す」に集まる（OpenCode・Goose。Cursor もファイルに逃がす）。Codex は10,000バイト（モデルごとに変えられる）。repo map は aider だけが本格的に持つ（tree-sitter と graph ranking、既定1,024トークン、ファイルがないときは8倍）。LSP は Claude Code がプラグインで提供し、grep と複数のファイルの読み取りを「定義へ移動」1回に置き換えるとしている。

### Cited Findings
- OpenCode: ツール出力は2,000行または50 KiB まで（`tool-output.ts` の `MAX_LINES`・`MAX_BYTES`）。超えた分はファイルに保存し、7日保持する（`RETENTION`）。read は2,000行、50 KiB、1行2,000文字まで（`read-filesystem.ts`）。シェルの説明文は「大きな出力は全体をファイルに保存して、切った preview を返す」「絞り込むほうが役立つとき以外は自動の切り詰めに任せる」とモデルに伝えている — [anomalyco/opencode: packages/core/src/tool-output.ts](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/tool-output.ts)、[tool/read-filesystem.ts](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/tool/read-filesystem.ts)、[tool/plugin/shell.ts](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/tool/plugin/shell.ts)
- Goose: シェルの出力は2,000行または50,000バイトまで。超えたら50行のプレビューを返す（`developer/shell.rs`） — [block/goose: crates/goose/src/agents/platform_extensions/developer/shell.rs](https://github.com/block/goose/blob/main/crates/goose/src/agents/platform_extensions/developer/shell.rs)
- Codex: モデル情報の既定の切り詰めは10,000バイト（`TruncationPolicyConfig::bytes(10_000)`）。MCP の一部の経路は1,024バイト。設定 `tool_output_token_limit` で、履歴に残すツール出力1件のトークン数を変えられる — [openai/codex: models-manager/src/model_info.rs](https://github.com/openai/codex/blob/main/codex-rs/models-manager/src/model_info.rs)、[Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- Codex v0.152.0 で、MCP のツールごとの出力上限（全体の `tool_output_token_limit` より優先）が入った（第三者） — [codex.danielvaughan.com（2026-09-01）](https://codex.danielvaughan.com/2026/09/01/codex-cli-v0152-stable-per-tool-mcp-output-limits-app-server-timeouts-compaction-fixes/)
- SWE-agent: 観測は1件100,000文字まで（`max_observation_length`）。超えたら「<response clipped>」と、短く絞るよう促す注意を付ける — [SWE-agent: sweagent/agent/agents.py](https://github.com/SWE-agent/SWE-agent/blob/main/sweagent/agent/agents.py)
- Amp: @ で指定したテキストファイルは500行、1行2KB まで。必要なら残りを読ませる — [Amp guide](https://ampcode.com/guides/context-management)
- Cursor: シェルと MCP の長い出力はファイルに書き、`tail` などで必要な部分を読ませる — [Cursor blog](https://cursor.com/blog/dynamic-context-discovery)
- aider の repo map: 主要なクラスと関数をシグネチャ付きで並べ、ファイルを節、依存を辺とする graph ranking で順位を付ける。`--map-tokens` の既定は1k — [aider docs: repomap](https://aider.chat/docs/repomap.html)。ソースでは tree-sitter（grep_ast）で抽出し、`map_tokens=1024`、チャットにファイルがないときは `map_mul_no_files=8` 倍（窓から4,096を引いた値が上限）まで広げる。`--map-refresh` は auto・always・files・manual — [Aider-AI/aider: aider/repomap.py](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py)、[aider/args.py](https://github.com/Aider-AI/aider/blob/main/aider/args.py)
- aider の編集形式: whole（既定）、diff、diff-fenced、udiff、editor-diff、architect を、モデルごとに設定する — [aider docs: advanced model settings](https://aider.chat/docs/config/adv-model-settings.html)
- 11のハーネスのソースを調べた論文（2026-07-15）: どの実行環境も汎用の agent framework を使わず、ベクトル埋め込みでコードを検索するものはない。スキルは11中9、MCP は11中8が採用 — [arXiv:2609.00006](https://arxiv.org/abs/2609.00006)
- Claude Code の LSP（code intelligence plugins）: 「定義へ移動」1回が grep と候補ファイルの読み取りの代わりになる。編集後に型エラーを自動で伝える — [Claude Code: costs](https://code.claude.com/docs/en/costs)
- Claude Code は、テストの出力を失敗だけに絞る PreToolUse フック（数万トークンを数百にする）、MCP より CLI（`gh` など）を使うことを勧めている — [Claude Code: costs](https://code.claude.com/docs/en/costs)

### Inferences
- ja-harness の「1件2,000トークンまで」は、製品の多く（50KB は約1万〜1.5万トークン）よりかなり小さい。OpenCode・Goose・Cursor と同じく、全体をファイルに保存してパスを返すと、Agents Don't Paginate の結果（大事な順に絞る）と restorable な圧縮の両方を満たせる。
- 埋め込み検索を入れているハーネスは見つからなかった。grep・glob・（任意の）LSP で足りると判断されている。

### Gaps
- 編集形式ごとのトークン量を比べた測定（aider の whole と diff など）は見つからなかった。aider の leaderboard は正答率で、トークンは比べていない。
- Claude Code の Read・Bash の行数とバイトの上限は、公式文書になかった。

## 3. キャッシュ（breakpoint の置き方、測ったヒット率や費用）

### Takeaway
共通の原則は「変わらないものを前に置き、会話は append-only」。Claude Code はこれを文書化し、何がキャッシュを壊すか（モデルの切り替え、ツール定義の変化、compaction）を一覧にして、`/usage` でヒット率と miss の原因を表示する。aider はキャッシュが切れないよう5分ごとに ping を打てる。DeepSeek は自動でキャッシュされる。

### Cited Findings
- Claude Code: リクエストを「system prompt とツール定義 → CLAUDE.md・auto memory → 会話」の順に組む。プレフィックスが完全一致しないと、それより後ろをすべて計算し直す。plan mode やスキルは会話の末尾にメッセージとして足すので、プレフィックスを壊さない — [Claude Code: prompt-caching](https://code.claude.com/docs/en/prompt-caching)
- キャッシュを壊すもの: モデルの切り替え（`opusplan` の切り替えも含む）、effort の変更（モデルによる）、fast mode、MCP サーバーの接続や切断（tool search で後から読む場合は壊さない）、ツールを丸ごと deny すること、compaction、画像が多すぎて古いものを外すこと、本体の更新 — 同上
- ツール定義を後から読む場合、最初のリクエストのツール一覧を会話の最後まで保つ。途中でつながったサーバーのツールは deferred として足す — 同上
- 要約は別のリクエストで送るが、同じプレフィックスを使うので、キャッシュが温かければ安い。冷えていると全体を計算し直す（古いセッションを再開して `/compact` すると高い）。`/rewind` はキャッシュ済みのプレフィックスに戻るので、要約より安い — 同上
- TTL: API キーやクラウドでは、メインの会話もサブエージェントも5分。サブスクの範囲内なら、メインの会話は1時間。`promptCacheTtl`・`subagentPromptCacheTtl`（v2.1.242 から）で選べる — 同上
- `/usage` の「Prompt cache (main)」行（v2.1.251 から）に、キャッシュから出た入力の割合、miss の回数、作り直したトークン数、期待どおりの作り直し（compaction やツール結果の消去）、温かいかどうかを出す。miss の原因の推定は v2.1.260 から（例: `likely cause: tool definitions changed`）。文書の例は「14 requests · 91% of input tokens from cache」 — [Claude Code: costs](https://code.claude.com/docs/en/costs)
- 費用の公開値: 企業での平均は、作業日1日に開発者1人あたり約13ドル、月に150〜250ドル。90%の利用者は1日30ドル未満。背景の処理（再開用の要約など）は1セッション0.04ドル未満 — [Claude Code: costs](https://code.claude.com/docs/en/costs)
- OpenCode: Anthropic 形式の `cache_control` breakpoint は1リクエスト最大4つ（`cacheControl` が数える）。OpenAI は `prompt_cache_retention`（24h）か `prompt_cache_options.ttl`。Anthropic・Alibaba 形式の印の付け方を `compatibility.cacheFormat` で選べる。設定 `setCacheKey` で、キャッシュのキーを必ず付ける — [anomalyco/opencode: packages/ai/src/protocols/utils/cache.ts](https://github.com/anomalyco/opencode/blob/dev/packages/ai/src/protocols/utils/cache.ts)、[CHANGELOG](https://github.com/anomalyco/opencode/blob/dev/CHANGELOG.md)、[OpenCode config docs](https://opencode.ai/docs/config/)
- OpenCode は「要約の余白を15%取り、閾値を少し超えた往復でも会話をそのまま送ってキャッシュを使い回す」と注釈している。要約のときにも画像の切り方と指示の基準を固定して、キャッシュを使い回せるようにした（#56983、#54410） — [compaction.ts](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/session/compaction.ts)、[CHANGELOG](https://github.com/anomalyco/opencode/blob/dev/CHANGELOG.md)
- Codex: `prompt_cache_key` は既定でセッションから作る（`SessionDerived`）。呼び出し側が決めることも、送らないこともできる — [openai/codex: core/src/thread_manager.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/thread_manager.rs)
- aider: system prompt、`--read` の読み取り専用ファイル、repo map、編集するファイルの順にキャッシュする（`chat_chunks.py` で各まとまりに `cache_control`）。`--cache-keepalive-pings N` で、メッセージのあと最大 N 回、5分ごとに ping を打ってキャッシュを保つ。DeepSeek は `caches_by_default` — [aider docs: Prompt caching](https://aider.chat/docs/usage/caching.html)、[aider/coders/chat_chunks.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/chat_chunks.py)
- SWE-agent: `cache_control` 処理器は直近2件のメッセージに印を付ける（`last_n_messages: 2`） — [history_processors.py](https://github.com/SWE-agent/SWE-agent/blob/main/sweagent/agent/history_processors.py)
- Cline: 要約は会話のキャッシュに乗るので、主な費用は要約の出力トークン — [Cline docs](https://github.com/cline/cline/blob/main/docs/features/auto-compact.mdx)

### Inferences
- ja-harness が使う OpenAI 互換 API（DeepSeek、OpenCode Go）では、キャッシュはプレフィックスで自動にかかる。breakpoint より、「プレフィックスを変えない」「ツール一覧を会話の途中で変えない」「隠す操作はまとめて行う」ことが効く。
- Claude Code の `/usage` のように、ヒット率と miss の原因を出すと、ja-harness の状態の行と `/context` の売りになる。

### Gaps
- 各ハーネスのキャッシュのヒット率を独立に測った数字は、Systima（キャッシュの書き込みが最大54倍）だけ。OpenAI・DeepSeek のキャッシュをハーネスごとに比べた資料はない。
- Goose・OpenHands・Cursor の breakpoint の置き方は確認できなかった。

## 4. モデルの振り分け（要約やタイトルに安いモデル、architect/editor の分担と、測った費用と正答率）

### Takeaway
「安いモデルを補助の仕事に使う」はほぼ全部が持つ（aider の weak model、OpenCode の small_model、Kilo の要約用モデル、Claude Code のサブエージェントの haiku、OpenHands の要約用 LLM、Goose の lead/worker）。費用ではなく正答率まで測って公開しているのは aider の architect/editor だけ（2024-09）。

### Cited Findings
- aider architect/editor（2024-09-26）: architect が解き方を書き、editor が編集の指示にする。o1-preview＋o1-mini または DeepSeek（whole）が85.0%（o1-preview 単独の diff は79.7%）。Sonnet 3.5＋DeepSeek は78.9%（Sonnet 単独77.4%）。gpt-4o-mini 同士は60.2%（単独55.6%）。費用の数字は載っていない — [aider blog: architect](https://aider.chat/2024/09/26/architect.html)
- aider weak model: 履歴の要約に weak model を先に使う。起動時に「Weak model: …」と表示し、モデルの設定で `weak_model_name`（例: claude-3-5-haiku、gpt-4o-mini）を指定する — [aider/coders/base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py)、[aider docs: advanced model settings](https://aider.chat/docs/config/adv-model-settings.html)
- OpenCode `small_model`: タイトルの生成などの軽い仕事に使う。未設定なら、プロバイダの安いモデルがあればそれを、なければ main を使う — [OpenCode config docs](https://opencode.ai/docs/config/)。タイトル生成には8,000文字までの文脈と、最初のメッセージの2,000文字までを渡す（`session/title.ts`） — [anomalyco/opencode: packages/core/src/session/title.ts](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/session/title.ts)
- Kilo: `agent.compaction.model` で要約だけ別のモデルにできる（例は claude-haiku-4-5）。会話のモデルは変わらない — [Kilo docs](https://kilo.ai/docs/customize/context/context-condensing)
- Claude Code: 簡単なサブエージェントは `model: haiku` を勧めている。`opusplan` は計画を Opus、実行を Sonnet にする（切り替えのたびにキャッシュが新しくなる）。effort を下げるか thinking を切ると出力トークンが減る — [Claude Code: costs](https://code.claude.com/docs/en/costs)、[prompt-caching](https://code.claude.com/docs/en/prompt-caching)
- Codex: `/review` 用の `review_model`、サブエージェントの既定の reasoning effort（`agents.default_subagent_reasoning_effort`）、`plan_mode_reasoning_effort` — [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- OpenHands: 要約用の LLM には、推論用より安いモデルを使うことが多い — [OpenHands SDK: condenser](https://docs.openhands.dev/sdk/arch/condenser)
- Amp: `read_thread` は別のモデルに、プロンプトに関係する部分だけを抜き出させる。Handoff の下書きも別のモデルが作る — [Amp guide](https://ampcode.com/guides/context-management)
- Goose: lead/worker の設定がある（強いモデルで始め、安いモデルに渡す。ソースに `lead_worker` の provider がある）。既定の往復数は確認できなかった — [block/goose](https://github.com/block/goose)

### Inferences
- ja-harness の「計画」と「実行」のモードは、aider の architect/editor や Claude Code の opusplan と同じ形にできる。ただし、モデルを切り替えるとキャッシュが新しくなる（Claude Code の文書）。安いモデル1つで回すなら、切り替えないほうが得なこともある。
- 要約とタイトルに、さらに安いモデル（DeepSeek の Flash 系など）を使うのは、どの製品にもある定石。

### Gaps
- weak model・small_model で何%安くなったかを測った資料は見つからなかった。
- 2025年以降のモデルで architect/editor を測り直した資料はない（aider の測定は2024年のモデル）。
- Goose の lead/worker の既定の往復数と、失敗したときに戻る条件は、ソースから読み取れなかった。

## 5. ハーネスどうしのトークン量を比べた公開ベンチマーク

### Takeaway
信頼できる比較はほぼ Systima（2026-07）の1件だけで、それも二次資料でしか読めなかった（一次のページは526エラー）。Claude Code はユーザーの入力の前に約33,000トークン（ツール27個）、OpenCode は約7,000（ツール10個）で、約4.7倍。ただし、多段の課題では Claude Code のほうが往復が少なく（並列のツール呼び出し）、課題全体の費用は近づく。

### Cited Findings
- Systima の比較（二次資料による）: 両方を claude-sonnet-4-5 に固定し、ログを取るプロキシで payload と usage を記録した。課題は簡単な返事、ファイルの要約、多段のコーディングの3種。最初の入力の前のトークンは Claude Code が約33,000（ツール27個）、OpenCode が約7,000（ツール10個）で、約4.7倍。Fable 5 では約3.3倍。Meridian ゲートウェイが足す6,200トークンを差し引いている（33K と 7K が差し引く前か後かは書かれていない） — [Developers Digest（2026-07-12）](https://www.developersdigest.tech/blog/claude-code-token-overhead-opencode-comparison)。元の記事は [systima.ai](https://www.systima.ai/blog/claude-code-vs-opencode-token-overhead)（取得時に HTTP 526）
- 同じ比較: Claude Code は同じ課題でキャッシュの書き込みが最大54倍。サブエージェントに任せると、合計が121,000から513,000トークン（4.2倍）になった。72KB の指示ファイルで1リクエストあたり約+20,000、MCP サーバー5つで約+5,000〜7,000。本番の Claude Code の設定では、入力の前に75,000〜85,000 — [Developers Digest](https://www.developersdigest.tech/blog/claude-code-token-overhead-opencode-comparison)、[Kunal Ganglani（二次）](https://www.kunalganglani.com/blog/opencode-vs-claude-code-token-overhead)
- 多段の課題（書く → 実行 → テスト → 直す）では、Claude Code が並列のツール呼び出しで3リクエスト、OpenCode が9リクエストで終えた（二次資料） — [DEV: Dave Kurian](https://dev.to/davekurian/claude-codes-hidden-token-tax-47x-more-before-you-start-4l4m)
- 注意点: HN では古いモデル（Sonnet 4.5）を使ったことと、記事が AI で書かれたかどうかを疑う声があった。トークンが多い分だけ質が上がるかは確かめていない — [Developers Digest](https://www.developersdigest.tech/blog/claude-code-token-overhead-opencode-comparison)
- Cursor の A/B テスト（社内）: MCP のツールを必要なときだけ読む方式で、MCP を呼んだ実行の合計トークンが46.9%減った（入れている MCP サーバーの数で変わる） — [Cursor blog（2026-01-06）](https://cursor.com/blog/dynamic-context-discovery)
- OpenHands の condenser: 1往復の費用が最大2分の1、解決率は54%対53%（2025-04） — [OpenHands blog](https://openhands.dev/blog/openhands-context-condensensation-for-more-efficient-ai-agents)
- 11のハーネスのソースを調べた論文はあるが、要旨にはトークンや費用の測定がない — [arXiv:2609.00006](https://arxiv.org/abs/2609.00006)

### Inferences
- 固定費（system prompt とツール定義）だけでは費用が決まらない。往復の回数（並列のツール呼び出し）とキャッシュの書き込みが同じくらい効く。ja-harness の測定では、最初の入力の前のトークン、往復の回数、キャッシュの読み書きを分けて記録すべき。
- OpenCode の約7,000トークン・ツール10個が、ハーネスの固定費の現実的な下限の目安になる。

### Gaps
- Systima の一次資料（表の内訳、版、課題ごとの合計）は読めなかった。
- Codex・aider・Cline・Goose を同じ条件で比べた独立のベンチマークは見つからなかった。
- DeepSeek など安いモデルでハーネスを比べた測定は見つからなかった。
