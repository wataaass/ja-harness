# 出力トークン（reasoning を含む）を減らす技術

調査日: 2026-10-26。出典の日付は各項目に書く。数値は出典の値をそのまま載せ、二次情報や業者の自己申告はその旨を書く。

## 1. 編集形式（edit format）の出力トークンと成功率

### Takeaway
出力トークンを最も減らしつつ成功率を保つのは search/replace 系（aider の `diff`、Claude の `str_replace`）で、安いモデルでも形式の正答率は 9 割以上ある。whole-file は出力が最大で、fast-apply（Cursor・Morph）や Predicted Outputs は「速さ」のための技術であり、課金される出力トークンは減らない（むしろ別モデル分が増える）。

### Cited Findings
- aider の形式の定義: `whole` はファイル全体を返す（最も簡単だが遅く高い）、`diff` は search/replace ブロック（変更部分だけ返すので効率的）、`diff-fenced` はパスを fence の内側に置く版（主に Gemini 用）、`udiff` は簡略化した unified diff（主に GPT-4 Turbo 用、"lazy coding" を減らした）。architect モードでは計画するモデルと適用する editor モデルを分ける。ページ自体はトークン数や精度の数値を載せていない — [aider: Edit formats](https://aider.chat/docs/more/edit-formats.html)
- aider の laziness benchmark（GPT-4 Turbo `gpt-4-1106-preview`）: SEARCH/REPLACE 20%（12課題で「…残りは同じ…」の手抜きコメント）、udiff 61%（手抜き4課題）。`gpt-4-0613` は SEARCH/REPLACE 26%、udiff 59%。udiff の原則は「訓練で見慣れた形式」「エスケープ・JSON・行番号を使わない」「関数単位で書き直す」「緩く適用する」で、緩い適用を外すと編集エラーが 9 倍になった（記事の日付の記載なし。GPT-4 Turbo 期の 2023 年末〜2024 年初めの記事） — [aider: Unified diffs make GPT-4 Turbo 3X less lazy](https://aider.chat/docs/unified-diffs.html)
- aider polyglot leaderboard（形式 = 実際に使われた形式、「正しい形式」= 編集が正しく書けた割合、費用 = 全 225 課題の総額）:
  - DeepSeek-V3.2-Exp (Reasoner) 74.2%、$1.3、diff、形式正答 97.3%（2025-10-03）
  - DeepSeek-V3.2-Exp (Chat) 70.2%、$0.88、diff、98.2%（2025-10-03）
  - DeepSeek R1 (0528) 71.4%、$4.8、diff、94.6%（2025-06-06）
  - DeepSeek V3 (0324) 55.1%、$1.12、diff、99.6%
  - claude-3-5-haiku 28.0%、$6.06、diff、91.1%
  - claude-sonnet-4 (32k thinking) 61.3%、$26.58 / no thinking 56.4%、$15.82（2025-05-24）
  - claude-3-7-sonnet (32k thinking) 64.9%、$36.83 / no thinking 60.4%、$17.72（2025-02-24）
  - gpt-5 high 88.0%、$29.08 / medium 86.7%、$17.69 / low 81.3%、$10.37（2025-08）
  - gpt-4.1-nano・gpt-4o-mini は `whole` を使い、それぞれ 8.9%・3.6%
  — [aider LLM leaderboards](https://aider.chat/docs/leaderboards/)
- Diff-XYZ（JetBrains Research、arXiv 2510.12487、2025-10）: CommitPackFT の実コード編集 1,000 件で apply・anti-apply・diff 生成を評価し、udiff・udiff-h・udiff-l・search-replace を比較。v2 の要旨では「大きなモデルではほとんどの課題で search-replace が最良、udiff 系が僅差」、v1 では「apply/anti-apply は udiff 系、生成は search-replace が最良」。小さなモデルは形式による差が小さい — [arXiv 2510.12487](https://arxiv.org/abs/2510.12487v2)
- Claude の text editor tool（`str_replace_based_edit_tool`、版 `text_editor_20250728`）: コマンドは view・str_replace・create・insert。`str_replace` は old_str が空白・インデントまで完全一致する必要がある。`max_characters` で view の切り詰めを指定できる（20250728 版以降） — [Anthropic: Text editor tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool)
- Codex CLI の `apply_patch` は V4A 形式（`*** Begin Patch` の包みと `@@` の文脈見出し）で、文脈行の照合を段階的に緩め、複数ファイル・改名を1つのパッチで扱える（二次情報のブログ、2026-03-31） — [The V4A Diff Format](https://codex.danielvaughan.com/2026/03/31/codex-cli-apply-patch-v4a-diff-format/)
- Cursor の fast-apply（"Editing Files at 1000 Tokens per Second"、Aman Sanger）: 70B モデル（Llama-3-70B を fine-tune）で約 1,000 tok/s（約 3,500 文字/s）。speculative edits（元のファイルを draft にする speculative decoding）で通常推論の約 13 倍、以前の GPT-4 speculative edits の約 9 倍。モデルは diff ではなくファイル全体を書き直す — [Cursor blog: Instant apply](https://cursor.com/ja/blog/instant-apply); [Fireworks blog](https://fireworks.ai/blog/cursor)
- Morph fast apply（業者の自己申告）: V3 Fast 約 10,500 tok/s・精度 96%（OpenRouter）、Morph のサイトでは 10,500+ tok/s・98%・「search-and-replace の 2 倍速い」。V3 Large 約 4,500 tok/s・98%。OpenRouter の価格は V3 Fast $0.80/$1.20 per 1M、V3 Large $0.90/$1.90。2025 年半ばの Launch HN では 4,500+ tok/s と 2,500+ tok/s で、版で数値が違う — [OpenRouter: morph-v3-fast](https://openrouter.ai/ko-KR/morph/morph-v3-fast); [Morph](https://www.morphllm.com); [Launch HN](https://hn.svelte.dev/item/44490863)

### Inferences
- ja-harness の `str_replace` 方針は、出力トークンと成功率の両面で現状の最良に近い。DeepSeek 系は aider で diff 形式を 97〜99% 正しく書けており、形式の失敗による再試行（＝出力の再生成）は少ないと見込める。
- 「緩い適用」（空白の正規化・インデントの相対化）を入れると失敗による再生成が減る。aider で 9 倍の差が出ている。完全一致に失敗したときの fallback を用意する価値がある。
- fast-apply は「主モデルが省略記法（`// ... existing code ...`）で短く書き、安い apply モデルが全体を復元する」構成。主モデルの出力は search/replace と同程度に短くなるが、apply モデルはファイル全体を出力するので、合計の課金トークンは増える。安さが目的の ja-harness では v0.1 に不要。
- 大きなファイルの小さな変更では whole-file と search/replace の出力差がファイルの長さ分あり、最大の削減要因になる。小さいモデルには whole が勧められる例（gpt-4.1-nano）もあるが、成績は低い。

### Gaps
- 同じモデル・同じ課題で、形式ごとの出力トークン数を並べた一次の測定は見つからなかった（aider は費用と正答率のみ、形式は固定）。
- Claude `str_replace` と Codex `apply_patch` のツール定義の入力トークン数の比較は見つからなかった。
- DeepSeek V4 系・Claude Haiku 5.5 の aider の結果は確認できなかった。

## 2. 推論（thinking）量の制御

### Takeaway
各社とも「effort」で推論量を段階的に変える方式に揃ってきた。Anthropic の effort は thinking だけでなく本文とツール呼び出しも短くし、DeepSeek は thinking のオン・オフと low/high/max を持つ。研究では、推論を絞ると多くの課題でトークンが大きく減り精度は数ポイントの低下にとどまり、エージェント課題では考えすぎ（overthinking）がむしろ成績を下げる。

### Cited Findings
- Anthropic の effort（`output_config.effort`、GA）: 段階は low / medium / high / xhigh / max。Opus 5.5 と Haiku 5.5 の既定は medium、他は high。effort は thinking・本文・ツール呼び出しの引数を含む「すべての出力トークン」に効き、低いほど「ツール呼び出しをまとめる・減らす」「前置きなしで動く」「完了報告が短い」。effort は厳密な予算ではなく行動の合図 — [Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)
- Haiku 5.5 の推奨: agentic coding を含めまず medium。low は chat・短いツール課題向けで、長いエージェントの prompt では「検索を飛ばす・早く止める・確認を飛ばす」が起きやすい。high 以下では `thinking: {"type": "disabled"}` も可。thinking は `max_tokens` に含まれる — 同上
- 会話の途中で effort を変える方法: per-message effort（beta、ヘッダー `mid-conversation-output-config-2026-07-01`）は prompt cache を保つ。top-level の effort を要求ごとに変えるとキャッシュが作り直しになる — 同上
- Opus 5 では「effort は thinking の量を変えるが、見える応答の長さは確実には短くならない。長さは prompt で指示する」と明記 — 同上
- Anthropic は agentic loop 全体に対する助言的なトークン予算（Task budgets）も用意している（ページへのリンクのみ確認、詳細未読） — 同上
- DeepSeek API の thinking mode: 既定でオン。OpenAI 形式では `{"thinking": {"type": "enabled"/"disabled"}}`（SDK では `extra_body`）、Anthropic 形式では `{"reasoning": {"effort": "none"}}` で無効化。`reasoning_effort` は low/high/max（minimal・low→low、medium・high・xhigh→high、max・ultra→max に丸める）、既定は high。thinking mode では temperature 等は効かない。tools を使う会話では過去の `reasoning_content` をすべて送り返す必要があり、省くと 400 エラー。tools なしでは過去の reasoning は無視される。ページに載る現行モデル名は `deepseek-flash` と `deepseek-v4-pro`。reasoning トークンの課金や予算の記載はない — [DeepSeek API: Thinking mode](https://api-docs.deepseek.com/guides/thinking_mode)
- aider で thinking を使うと費用はほぼ 2 倍、正答率の上積みは数ポイント: claude-sonnet-4 は 56.4%→61.3%（$15.82→$26.58）、claude-3-7-sonnet は 60.4%→64.9%（$17.72→$36.83）。gpt-5 は low 81.3%（$10.37）・medium 86.7%（$17.69）・high 88.0%（$29.08） — [aider LLM leaderboards](https://aider.chat/docs/leaderboards/)
- The Danger of Overthinking（Cuadron ほか、arXiv 2502.08235、2025-02）: SWE-bench Verified の 4,018 軌跡を分析し、analysis paralysis・rogue actions・premature disengagement の3型を特定。overthinking の点数が高いほど成績が悪く、reasoning モデルで顕著。overthinking の点数が低い解を選ぶだけで性能が約 30% 上がり、計算コストが 43% 減った — [arXiv 2502.08235](https://arxiv.org/abs/2502.08235)
- Token-Budget-Aware LLM Reasoning（TALE、Han ほか、arXiv 2412.18547）: 問題ごとにトークン予算を見積もって prompt に入れる。TALE-EP はトークンを平均約 67% 減らし精度低下は 3% 未満、学習で入れる TALE-PT は通常の CoT 比で約 50% 減。v1 では平均 68.64% 減・精度低下 5% 未満 — [arXiv 2412.18547](https://arxiv.org/pdf/2412.18547)
- s1（arXiv 2501.19393、2025-01）の budget forcing: 推論を途中で打ち切る、または終わろうとしたとき "Wait" を足して延ばす。延ばす方向で AIME24 が 50%→57%。打ち切りは上限を強制する手段として使える — [arXiv 2501.19393](https://arxiv.org/abs/2501.19393)
- ThoughtTerminator（Pu ほか、2025-04）: reasoning モデルは使うトークン量の見積もりが下手で、特に易しい問題で無駄が多い。学習不要の decoding 法で減らす（要旨と二次情報のみ確認） — [hyper.ai: 2504.13367](https://hyper.ai/en/papers/2504.13367)

### Inferences
- ja-harness の「モードごとの thinking 量」は、DeepSeek では `thinking` の on/off と `reasoning_effort`（low/high/max の3段のみ）、Anthropic では effort に対応づけられる。例: 計画モード=high、実行・確認=low か medium、ツール結果を読むだけの往復=thinking off（DeepSeek）。
- DeepSeek で tools を使うと過去の `reasoning_content` を送り返す必要があるため、reasoning の量は次の往復の入力トークンにも積み上がる。出力の reasoning を減らすことは、入力側の削減にも効く（ただし入力はキャッシュ価格になりうる）。
- Anthropic で effort を会話の途中で変えるなら per-message effort を使わないとキャッシュが壊れる。ja-harness の append-only・KV-cache 方針と合わせて、モード切替時は per-message 方式を使うべき。
- SWE-bench での overthinking の結果から、安いモデルほど「考えすぎを抑える」ことが費用と質の両方に効く可能性が高い。

### Gaps
- DeepSeek V4.1 Flash の low/high/max ごとの reasoning トークン数と coding の正答率の公式な数値は見つからなかった（自前の測定が要る）。
- DeepSeek の reasoning トークンの課金単価（出力と同じか）を公式ページで確認できなかった。
- OpenAI の reasoning effort（minimal/none など）の現行仕様は今回は確認していない。
- TALE・s1 は数学中心で、コーディングエージェントでの効果の測定は見つからなかった。

## 3. 簡潔な出力の指示（brevity prompting）

### Takeaway
Chain of Draft のような「短く書け」の指示は、few-shot の例があり大きなモデルなら、トークンを 8〜20% 程度に減らしつつ精度を CoT 近くに保つ。ただし zero-shot や小さなモデルでは精度が大きく落ちる。reasoning モデルの内部の thinking には、効くとは限らない（Anthropic は「effort は見える応答の長さを確実には短くしない」と書いている）。

### Cited Findings
- Chain of Draft（Xu ほか、Zoom、arXiv 2502.18600、2025-02-25、v2 2025-03-03）: 各段の推論を数語の下書きにする。「CoT と同等以上の精度で、トークンは最小 7.6%」 — [arXiv 2502.18600](https://arxiv.org/abs/2502.18600v1)
- few-shot の結果（精度 / 出力トークン）:
  - GSM8K: GPT-4o は CoT 95.4% / 205.1 → CoD 91.1% / 43.9、Claude 3.5 Sonnet は 95.8% / 190.0 → 91.4% / 39.8
  - Date: GPT-4o 90.2% / 75.7 → 88.1% / 30.2、Sonnet 87.0% / 172.5 → 89.7% / 31.3
  - Sports: GPT-4o 95.9% / 28.7 → 98.3% / 15.0、Sonnet 93.2% / 189.4 → 97.3% / 14.3
  - Coin flip: 両モデル 100% のまま、52.4→16.8（GPT-4o）、135.3→18.9（Sonnet）
  — [arXiv 2502.18600v2 (HTML)](https://arxiv.org/html/2502.18600v2)
- 限界: zero-shot の GSM8K では GPT-4o が CoT 94.8% → CoD 84.4%、Claude 3.5 Sonnet が 90.4% → 65.5% に落ちる。小さなモデル（Qwen2.5-3B: CoT 59.1% → CoD 43.1%、Llama3.2-3B: 70.7% → 52.5%）でも差が大きい。著者は CoD 形式のデータが訓練にないためと推測 — 同上
- 著者は CoD を CoT の置き換えとは考えておらず、用途ごとに CoD と CoT を選ぶ router を勧める — [Hugging Face papers: 2502.18600](https://huggingface.co/papers/2502.18600)
- 後続の Draft-Thinking（arXiv 2603.00578、2026-02）は、下書き式の考えを long CoT の reasoning モデルに広げる（要旨の二次情報のみ） — [arXiv 2603.00578](https://arxiv.org/pdf/2603.00578)
- Anthropic: 低い effort では「前置きなしで動く」「完了報告が短い」「コードのコメントが少ない」。Opus 5 では長さは prompt で指示するよう勧める — [Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)

### Inferences
- ja-harness の system prompt では、「説明を繰り返さない」「完了報告は1〜2文」「変更したコードを本文に貼らない」のように、出力の種類ごとに具体的に指示し、短い良い例を1つ添える（CoD の結果では few-shot の有無で差が大きい）。
- 推論そのものを短くする指示は、安いモデル・zero-shot では精度を落としやすい。thinking の量は API の effort / thinking toggle で制御し、prompt では「見える本文」を短くする、と役割を分けるのが安全。

### Gaps
- コーディングエージェント（SWE-bench 等）で brevity 指示の効果を測った一次の研究は見つからなかった。
- 日本語の出力で CoD を測った結果は見つからなかった。

## 4. 構造化出力（structured outputs）の出力トークンの負担

### Takeaway
JSON などで出力形式を強く縛ると推論課題の精度が下がるという報告がある。トークンの負担を直接測った一次資料は見つからなかった。コード編集を JSON の文字列に入れるとエスケープが増える点は、aider が udiff の原則（JSON とエスケープを避ける）として挙げている。

### Cited Findings
- Let Me Speak Freely?（Tam ほか、arXiv 2408.02442、EMNLP 2024 Industry Track）: 形式の制限で推論能力が大きく落ち、制限が厳しいほど落ちる。constrained decoding（JSON mode）、形式を指示する prompt、「自然文で答えてから形式に変換する」2段の方式を比較。分類課題では JSON mode が同等以上のこともある — [arXiv 2408.02442](https://arxiv.org/html/2408.02442v1)
- 二次情報（未検証）: GSM8K で GPT-3.5-Turbo が自由形式 76.6% → JSON mode 49.3%、Claude-3-Haiku が 86.5% → 23.4% と紹介されている。一次資料では確認していない — [tianpan.co blog (2026-04-19)](https://tianpan.co/blog/2026-04-19-structured-outputs-json-mode-quality-tax)
- aider は udiff の設計で「エスケープ・JSON・行番号を避ける」を原則にしている — [aider: Unified diffs](https://aider.chat/docs/unified-diffs.html)

### Inferences
- ツール呼び出しの引数は JSON になるため、`str_replace` の old/new の文字列は改行・引用符のエスケープ分だけ出力トークンが増える。編集ツールの引数は最小限（path・old・new）にし、余計なフィールド（理由・説明）を引数に持たせない。
- 答え（引数）の前に理由のフィールドを置くかどうかは、精度と出力量のトレードオフになる。thinking があるモデルでは、引数に理由を書かせる必要はない。

### Gaps
- 構造化出力・ツール呼び出しの形式による出力トークンの増分を測った一次資料は見つからなかった。
- tianpan.co が引用する数値と「NeurIPS 2024 で 10〜15% 低下」の主張は、元の論文を特定できなかった。

## 5. Speculative decoding / Predicted Outputs は課金トークンを減らすか

### Takeaway
減らさない。目的は待ち時間の短縮で、OpenAI の Predicted Outputs では採用されなかった予測トークンも出力料金で課金されるため、費用は増えうる。Cursor・Morph の speculative edits も速度の技術。

### Cited Findings
- OpenAI Predicted Outputs: 「却下されたトークンも他の出力トークンと同様に課金される」ので費用が増えうる。却下数は `usage` の `rejected_prediction_tokens` で分かる。小さな編集でファイルを書き直すときに速くなり、streaming で効果が大きい。対応は `gpt-4o`・`gpt-4o-mini`・`gpt-4.1`・`gpt-4.1-mini`・`gpt-4.1-nano` のみで、`tools`（function calling）・`n>1`・`logprobs`・`max_completion_tokens` などと併用できない — [OpenAI: Predicted Outputs](https://developers.openai.com/api/docs/guides/predicted-outputs)
- Cursor の speculative edits は、元のコードを draft にして検証することで約 13 倍速くした。出力するのはファイル全体 — [Cursor blog: Instant apply](https://cursor.com/ja/blog/instant-apply)

### Inferences
- Predicted Outputs は tools と併用できず、対象も古い GPT-4o/4.1 系だけなので、ja-harness（DeepSeek・Claude、tool 呼び出し中心）では使えない。
- speculative 系は「ファイル全体を出力する」前提を速くする技術で、出力トークンの削減とは逆方向。費用を下げるなら search/replace で出力自体を短くする方が効く。

### Gaps
- DeepSeek・Anthropic の API に Predicted Outputs 相当の機能があるかは確認していない（今回の資料には記載がなかった）。
