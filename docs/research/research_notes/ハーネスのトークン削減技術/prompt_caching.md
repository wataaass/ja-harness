# Prompt caching（KV-cache の再利用）でハーネスの費用を下げる

調査日: 2026-10-26。各社の値は頻繁に変わる。特に OpenAI（GPT-5.6 で仕組みが変わった）、Gemini 4、DeepSeek（2026-09 に値下げ）、OpenCode Go のモデル一覧と価格は数か月で古くなりうる。使う前に公式の頁を見直すこと。

## 1. 提供元ごとの違い（2026 年時点）

### Takeaway
どの提供元も「先頭から完全一致した prefix」だけを安く読む。違いは、(a) 明示の breakpoint が要るか、(b) 書き込みに割増があるか、(c) 保持時間、(d) 読みの割引率。DeepSeek V4.1 Flash は書き込みの割増がなく、hit は miss の 2%（50 分の 1）と極端に安いので、ja-harness の主対象では「hit 率を保つこと」がほぼすべてになる。

### Cited Findings

**OpenAI（自動。GPT-5.6 から仕組みが変わった）**
- 既定で有効。GPT-5.6 以降は最小 1,024 visible tokens（隠れた system tokens は数えない）。それ以前のモデルの最小値は tools・画像・出力 schema・reasoning effort などで変わる — [OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- 読みは通常入力の 0.1 倍（GPT-5.6 以降の多く）、GPT-6.1 Sol は 0.05 倍。「最大 95% 引き」。GPT-5.6 以降は書き込みが 1.25 倍（TTL 30m、既定）または 2.5 倍（12h） — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- breakpoint: GPT-5.6 以降の implicit mode では最新の対象 message の末尾に置かれる。explicit mode では `prompt_cache_breakpoint` で指定し、1 リクエストで最大 4 件書き込む。GPT-5.5 は 2,048 tokens ごとの固定間隔 — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- 保持: GPT-5.6 以降は `prompt_cache_options.ttl` を `"30m"` か `"12h"` にする。それ以前は `in_memory`（無操作で約 5〜10 分、最大 1 時間）か `24h` — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- 経路: cache は個々のマシンに載る。経路は「先頭 tokens（tool 定義を含む）の hash」と `prompt_cache_key` で決まる。1 key あたり毎分 15 リクエストを超えると別のマシンに溢れる。手動で cache を消す手段はない。cached tokens も TPM の上限に数える — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- prefix を変える設定: `model`、`tools`、`parallel_tool_calls`、`text.format`、`reasoning.effort`、`text.verbosity`、`context_management`（compaction）。tool を外す代わりに `tool_choice: "none"` や `allowed_tools` を使う。GPT-6 では `configuration_update` item で prefix を書き換えずに effort を変えられる。`prompt_cache_options.prewarm` で起動時に温められる — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- 使用量の欄: `usage.input_tokens_details.cached_tokens`、`cache_write_tokens`（`ttl_30m_tokens` / `ttl_12h_tokens`）。古いモデルでは 128 単位に切り捨てて報告する — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)

**Anthropic（`cache_control`）**
- 明示の breakpoint は最大 4 個。top-level の `cache_control` による automatic caching もあり、breakpoint は会話の伸びに合わせて最後の対象 block へ動く（4 枠のうち 1 枠を使う） — [Anthropic Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 書き込むのは breakpoint だけ。読むときは breakpoint から 1 block ずつ遡り、lookback は 20 block（連続する tool_use や tool_result の並びは 1 つに数える） — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 順序は `tools` → `system` → `messages`。ある段が変わると、その段とそれより後ろが無効になる — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- TTL: 既定 5 分（使うたびに無料で延長。数え始めはリクエストの開始時なので、長い stream はその分 TTL を使う）。`"ttl": "1h"` も選べる。書き込みは 5m が 1.25 倍、1h が 2 倍。読みは 0.1 倍（Opus 5.5・Sonnet 5.5 は 0.05 倍、Fable 5.1・Mythos 5.1 は 0.025 倍） — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 最小 tokens: 512（Opus 5.5、Sonnet 5.5、Haiku 5.5 など）、1,024（Sonnet 5、Sonnet 4.6 など）、2,048（Opus 4.7、Haiku 3.5）、4,096（Opus 4.6、Haiku 4.5）。最小に届かないと、エラーを出さずに cache なしで処理する — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 無効になるもの: tool 定義（全段）、web search・citations・speed の切り替え（system 以降）、`tool_choice`・画像の追加や削除（messages）、thinking の設定と `output_config.effort`（messages）、thinking block を落とすこと（その位置から後ろ）。Opus 4.5 以降・Sonnet 4.6 以降・Haiku 5.5 は既定で thinking block を残すので cache が保たれる — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 並行: cache は最初の応答が始まってから使えるようになる。並行リクエストで hit させたいなら、最初の応答を待つ — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 温め: `max_tokens: 0` で出力なしに書き込める（stream、extended thinking、structured outputs、`tool_choice` が tool か any の場合と Batch では使えない）。本番と同じ thinking と effort の設定にする — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 分離: organization ごと。Claude API では workspace ごとにも分かれる — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 使用量の欄: `cache_creation_input_tokens`、`cache_read_input_tokens`、`input_tokens`（最後の breakpoint より後ろ）。合計入力はこの 3 つの和 — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

**DeepSeek（自動の disk cache）**
- 全利用者で既定で有効。保存した「cache prefix unit」に完全一致したときだけ hit する（部分一致は数えない。理由は Sliding Window Attention とされる） — [DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache)
- prefix を保存する位置: リクエストの境目（user 入力の末尾、model 出力の末尾）、複数リクエストに共通する prefix を見つけたとき、長い入出力では一定の token 間隔ごと。例: 1 回目が A+B、2 回目が A+C なら 2 回目は hit しないが、A が保存されるので、3 回目の A+D は A に hit する — [DeepSeek](https://api-docs.deepseek.com/guides/kv_cache)
- 構築には数秒かかる。使われなくなった cache は「通常、数時間から数日」で消える。100% の hit は保証しない（best-effort）。unit の大きさは書かれていない — [DeepSeek](https://api-docs.deepseek.com/guides/kv_cache)
- 使用量の欄: `prompt_cache_hit_tokens`、`prompt_cache_miss_tokens` — [DeepSeek](https://api-docs.deepseek.com/guides/kv_cache)
- V4.1 Flash の価格（2026-09-10 改定、1M tokens あたり）: off-peak は hit $0.003・miss $0.15・出力 $0.60、peak は hit $0.006・miss $0.30・出力 $1.20 — [deepakness.com](https://deepakness.com/raw/deepseek-v4-1-flash-price/)。peak は月〜金の 01:00–04:00 と 06:00–10:00 UTC — 検索結果の要約による（[yottalabs](https://www.yottalabs.ai/post/deepseek-v4-1-flash-pricing-specs-v4-pro-routing-2026)、[propakistani](https://propakistani.pk/2026/09/11/deepseek-v4-1-flash-launches-with-lower-prices-and-native-vision/)）。DeepSeek の公式の価格頁からは数字を取り出せなかった
- OpenRouter の一覧では、DeepSeek の書き込みは通常入力と同額、読みは 0.1 倍 — [OpenRouter Prompt caching](https://openrouter.ai/docs/features/prompt-caching)。上の公式の価格（hit が miss の 2%）とは食い違う。OpenRouter の値は経由する provider によって違う可能性がある

**Gemini**
- Gemini 2.5 以降は implicit caching が既定で有効。最小は Gemini 4 Argon・3.8 Flash・3.6 Flash・3.1 Pro Preview で 4,096、2.5 Flash・2.5 Pro で 2,048。Gemini 4（Argon 以降）の multi-turn では、新しいリクエストが 2,050 tokens 以上増えたときだけ前のリクエスト全体を cache する。explicit caching は Interactions API と Gemini 4 Argon 以降では使えない。頁の最終更新は 2026-10-23 — [Gemini API Context caching](https://ai.google.dev/gemini-api/docs/caching)
- OpenRouter 経由: implicit は書き込み無料・読み 0.25 倍、TTL 約 3〜5 分。explicit は入力価格に 5 分の保存料を足し、TTL は 5 分固定。使われるのは最後の breakpoint だけ — [OpenRouter](https://openrouter.ai/docs/features/prompt-caching)

**OpenRouter**
- provider sticky routing: cache を使ったリクエストの provider を記録し、同じモデルの次のリクエストをそこへ送る。cache の読みが通常より安い provider だけが対象。10 分無操作で切れる。`provider.order` を指定するとこれより優先される。既定では、最初の system/developer message と最初の非 system message の hash で会話を見分ける — [OpenRouter](https://openrouter.ai/docs/features/prompt-caching)
- `session_id`（body か `x-session-id` header、256 文字まで）を送ると、最初の成功から sticky になる（ないと最初の hit の後から）。ない場合は `prompt_cache_key` を使う。応答の `cache_discount` は Anthropic の書き込みでは負になりうる — [OpenRouter](https://openrouter.ai/docs/features/prompt-caching)
- 他の provider: Grok と Moonshot は書き込み無料・読み 0.25 倍。Qwen は明示の `cache_control`（TTL 5 分）で書き込み 1.25 倍・読み 0.1 倍。Z.AI は約 0.2 倍 — [OpenRouter](https://openrouter.ai/docs/features/prompt-caching)

**OpenCode Go**
- 月額 $10（Go）と $40（Go Plus）。上限はモデルごとの月の金額（Go で $15〜$80）。5 時間で月の 20%、1 週間で 50% まで使える。応答ごとの課金額は `opencode.allowance` で返る — [OpenCode Go](https://opencode.ai/docs/go/)
- 価格（1M tokens あたり）: DeepSeek V4.1 Flash は off-peak で入力 $0.15・出力 $0.60・Cached Read $0.003（peak はすべて 2 倍）。Cached Write の欄はなし。月の上限は $80。DeepSeek V4 Pro は off-peak で入力 $0.66・Cached Read $0.022、上限 $15。Claude Haiku 5.5 は 100K tokens 以下で入力 $0.10・出力 $0.50・Read $0.01・Write $0.125、100K を超えると入力 $0.50・Read $0.05・Write $0.625 で 5 倍。上限 $15 — [OpenCode Go](https://opencode.ai/docs/go/)
- 想定のリクエスト（cache 前提）: DeepSeek V4.1 Flash は 1 リクエストあたり入力 410・cached 71,300・出力 310 tokens と見込み、月に約 173,330 回。Haiku 5.5 は入力 1,100・cached 55,000・出力 240 で約 19,230 回 — [OpenCode Go](https://opencode.ai/docs/go/)
- 会話ごとに安定した `x-opencode-session` header と独自の user agent を送るよう求めている（routing と prompt caching の最適化のため）。Claude Code、Codex、ZCode は自前の session header が認識される。DeepSeek Harness、GitHub Copilot Chat、Kimi Code、MiMo Code は「session 対応が欠けているか不完全」とされている。背後の provider 名は書かれていない — [OpenCode Go](https://opencode.ai/docs/go/)

### Inferences
- DeepSeek V4.1 Flash では hit $0.003 と miss $0.15 で 50 倍の差がある。Anthropic（10 倍、書き込み込みで 12.5 倍）や OpenAI（10 倍）より差が大きく、1 回の cache の破壊が相対的に最も高くつく。
- OpenCode Go の想定は「1 リクエストの入力の 99% 以上が cached」（71,300 / 71,710）。hit 率が落ちると、上限の回数はこの見込みより大きく減る。nihongo-kit の測定で「Haiku は枠の減り方が表示価格の約 4 倍」だった件は、cache の miss や書き込みの割増、100K 超の価格が効いた可能性がある（未検証）。
- Haiku 5.5 を Go で使うなら、文脈を 100K tokens 未満に保つことが cache より大きく効く（5 倍の価格段がある）。
- DeepSeek には書き込みの割増も TTL の指定もないので、prewarm や TTL の選択は要らない。代わりに「数秒の構築時間」と「best-effort」のため、並行に投げた直後のリクエストは hit しないと考えたほうがよい。

### Gaps
- DeepSeek の公式の価格頁から数字を取り出せなかった。peak の時間帯は二次情報のみ。cache prefix unit の大きさ（以前の版の文書では 64 tokens とされていた記憶があるが、今の頁にはない）は確認できなかった。
- OpenCode Go の背後で DeepSeek を誰が出しているか、x-opencode-session がどの provider への sticky routing になるかは公開されていない。
- Gemini の implicit caching の割引率は公式の頁に書かれていない（OpenRouter の 0.25 倍のみ）。

## 2. 履歴を書き換える（mask・要約する）かどうかの費用の模型

### Takeaway
公開された「cache-aware compaction」の研究は 2026 年に出始めた段階で、閉じた式を出した一次資料は見つからなかった。単純な模型を作ると、DeepSeek V4.1 Flash では古いツール出力を隠しても費用の元が取れるまでに約 100 往復かかる例が出る。費用だけを見れば、DeepSeek では書き換えは割に合いにくい。書き換えの根拠は、質（Context Rot）と文脈の上限に置くのが妥当。

### Cited Findings
- TokenPilot（arXiv 2606.17016、2026-06 初版、EMNLP 2026 Findings）: prompt cache の効率を agent の文脈管理の主目標に据えた。Ingestion-Aware Compaction（取り込むときに prefix を安定させ、環境のノイズを除く）と Lifecycle-Aware Eviction（区切りの残りの効用を追い、関連がなくなった区切りだけを、控えめなまとまりの往復ごとに追い出す）。費用は従来の方法に比べ 61%・56%（isolated）、61%・87%（continuous）減った — [arXiv 2606.17016](https://arxiv.org/abs/2606.17016)
- 同論文の解説記事: PinchBench continuous で $7.24 → $2.79、Claw-Eval continuous で $81.52 → $10.58。eviction のまとまりの幅は B=3 が最適。記事は、表の間の数の食い違い（miss tokens 25.02M と 5.94M）と、Claw-Eval では点数が vanilla を下回った（60.8 と 63.4）ことを挙げている — [danielvaughan.com](https://codex.danielvaughan.com/2026/07/03/tokenpilot-cache-efficient-context-management-codex-cli-prompt-cache-compaction-eviction-cost/)
- 実務の報告（二次の記事、未検証）: ある本番の compaction は、全履歴を残すより tokens が約 41% 少ないのに費用は約 2 倍だった。cached 入力が 1M あたり約 $0.55 未満なら全部残すほうが安かった。ツール出力を一定の大きさで切ると 1 往復の費用が 38% 下がった — [Towards AI「Fewer Tokens Cost Us More」](https://pub.towardsai.net/lai-139-fewer-tokens-cost-us-more-fa1e273f9b1b)（検索結果の要約のみ。本文は会員限定で読めていない）
- 同じ検索結果の例: 100K の会話を 10K の要約に縮めると、次の 1 回は縮めないより高くつく（残せば 0.1 倍で読めた履歴が全部 miss になる）。cache が温かいうちは compaction を遅らせ、質の低下が無効化の費用を上回ったときだけ縮めるという意見 — [Context Compaction Showdown](https://codex.danielvaughan.com/2026/04/10/context-compaction-showdown-coding-agents/)（検索結果の要約）
- Codex CLI: 自動の compaction は `model_auto_compact_token_limit`（既定 200,000）を超えたとき。Codex のモデルでは OpenAI の remote `compact()` を呼び、暗号化した blob が返る。記事は窓の 75〜80% で縮めること、`tool_output_token_limit` を 8,000〜12,000 にすることを勧めている — [danielvaughan.com](https://codex.danielvaughan.com/2026/07/03/tokenpilot-cache-efficient-context-management-codex-cli-prompt-cache-compaction-eviction-cost/)
- OpenAI は compaction（`context_management`）を prefix を変える設定に挙げている — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- Claude Code は compaction と古いツール結果の消去を「expected rebuild」として扱い、原因不明の miss とは分けて数える — [wmedia.es](https://wmedia.es/en/tips/claude-code-cost-what-broke-your-cache)

### Inferences（自前の模型。出典なし）
記号: h = hit 単価、m = miss 単価（Anthropic は書き込み 1.25 倍を m に含める）、P = 書き換えた位置から末尾までの今の長さ、S = 書き換えで減る tokens、T = 要約で入る tokens（mask なら跡の数十 tokens）。

- 書き換えた次の 1 回の追加の費用: C₁ ≈ (P − S + T)·m − P·h（書き換えなければ P を h で読めた）
- その後 1 往復ごとに浮く費用: ΔC ≈ (S − T)·h（減った分は本来 hit で読まれていた）
- 元が取れる往復の数: N* ≈ C₁ / ΔC。残りの会話が N* 往復より長いときだけ、費用の面で得になる

計算の例（P = 60K、S = 20K、T ≈ 0。ツール出力 2,000 tokens × 10 件をまとめて隠す ja-harness の既定の場合）:
- DeepSeek V4.1 Flash（m/h = 50）: C₁ = 40K×0.15 − 60K×0.003 = $0.0058、ΔC = 20K×0.003 = $0.00006 → N* ≈ 97 往復
- Anthropic Haiku 5.5（m = 1.25、h = 0.1。基本価格を 1 とする）: C₁ = 40K×1.25 − 60K×0.1 = 44K、ΔC = 2K → N* ≈ 22 往復
- OpenAI GPT-5.6（m = 1.25、h = 0.1）: Haiku と同じく約 22 往復
- 隠す位置が末尾に近い（P が小さい）ほど C₁ は小さい。古いものから隠すと P はほぼ全履歴になり、いちばん高くつく。まとめて隠す（batched masking）は、無効化を 10 回から 1 回に減らすので、1 件ずつ隠すより明らかに得。
- cache が切れていれば（Anthropic の 5 分超え、DeepSeek の数時間〜数日）、もともと全部 miss なので C₁ ≈ −S·m と負になり、隠すのが常に得。idle の後の最初のリクエストは、まとめて書き換える好機になる。
- 金額の桁: DeepSeek で 32K の文脈を全部 hit で読むと 1 回 $0.0001、出力 310 tokens は $0.00019。cache が保たれていれば、費用の大半は出力と新しく足した tokens になる。ja-harness の既定（32K で要約、2,000 tokens で切り詰め）は、DeepSeek では費用より質と速さのための値と説明するのが正確。
- 例外: 文脈の上限、Haiku の 100K 超の段、Context Rot による質の低下、DeepSeek の best-effort の miss（hit 率が低いと実質の h が上がり、N* は縮む）。設定で masking の頻度を変えられるという既定の方針は、この模型とも合う。模型を設定の説明（`docs/design/context.md`）に載せ、提供元の価格から N* を出して「書き換えるか」を決める仕組みにもできる。

### Gaps
- 「Don't Break the Cache」と TokenPilot の本文（費用の式や hit 率）は読めていない。abstract のみ。
- 要約の作成そのもの（別の LLM 呼び出し）の費用は模型に入れていない。
- 「Fewer Tokens Cost Us More」の $0.55 の閾値は会員限定の記事の検索要約で、出典として弱い。

## 3. prefix の設計

### Takeaway
並びは「変わらないもの → 変わるもの」。tools と system を固定し、時刻などの動くものは末尾へ。tool の出し入れはせず、使えなくするだけにする。JSON の key 順を決定的にする。並行リクエストは、最初の応答で cache ができるのを待ってから投げる。

### Cited Findings
- Don't Break the Cache（arXiv 2601.06007、2026-01）: OpenAI・Anthropic・Google で、500 以上の agent session、10,000 tokens の system prompt、DeepResearch Bench（実際に web 検索する多段の課題）。cache で API の費用が 41〜80% 減り、TTFT が 13〜31% 速くなった。提供元の最小 tokens を超えると、効果は prompt の長さに比例して伸びる。勧めは、動くものを system prompt の末尾に置く、動的な function calling を避ける、動的なツール結果を cache から外す（全部を cache するより安定して得）。素朴な全文の cache は、逆に遅くなることがある — [arXiv 2601.06007](https://arxiv.org/abs/2601.06007)
- Manus（2025-07-18、Yichao 'Peak' Ji）: 入力と出力の比は約 100:1。秒まで入った時刻を system prompt の先頭に置かない（1 token の違いでそれより後ろが無効になる）。多くの言語と JSON ライブラリは key の順を保証しないので、知らないうちに cache を壊す。append-only にし、過去の行動や観察を書き換えない。手動の breakpoint では少なくとも system prompt の末尾に置く。vLLM では prefix caching を有効にし、session ID で同じ worker へ送る。tool は定義から外さず、decoding の logits を mask して選べなくする。大きな内容はファイルに置き、パスで参照する — [Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
- OpenAI: tool を外さず `tool_choice: "none"` や `allowed_tools` を使う。共有 prefix が最小の長さに届かないなら、少し長くしたほうが安いことがある — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- Anthropic: 毎回変わるもの（時刻、リクエストごとの文脈、届いた message）に breakpoint を置くと miss になる。同じ最後の block に置く。並行リクエストは最初の応答が始まるまで cache を使えない — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- Codex CLI は system の指示、tool 定義、sandbox の設定を同じ内容・同じ順に保つ — [danielvaughan.com](https://codex.danielvaughan.com/2026/07/03/tokenpilot-cache-efficient-context-management-codex-cli-prompt-cache-compaction-eviction-cost/)
- OpenRouter は既定で、最初の system message と最初の非 system message の hash で会話を見分ける — [OpenRouter](https://openrouter.ai/docs/features/prompt-caching)

### Inferences（ja-harness への当てはめ）
- 並び: ① tool 定義（MCP の tool も名前順などで決定的に並べる） → ② 固定の system prompt → ③ 作業フォルダの規則（AGENTS.md など。session の途中では変えない） → ④ 会話。日付、git の状態、文脈の割合は ④ の最初の user message か末尾に入れる。
- serialization: tool の JSON Schema と tool 呼び出しの引数は、key を並べ替えた決定的な stringify で出す。MCP の server から届いた定義も、こちらで正規化してから送る。
- モード（計画・実行）の切り替えでは tool 定義を変えず、system の末尾か user message に「今のモード」を書き、使えない tool は呼ばれたら拒む。これは Manus の「外さず mask する」と OpenAI の `allowed_tools` の考えに合う。
- subagent: 親と同じ tools と system を先頭に持たせれば、提供元の側で prefix を共有できる（同じ organization・workspace 内）。DeepSeek は複数リクエストの共通 prefix を自動で保存するので、相性がよい。ただし subagent に別の tool の組を持たせると、tool の段から別の cache になる。
- 並行: 同じ prefix のリクエストを並べて投げるときは、1 本目を先に投げて応答が始まってから残りを投げる（Anthropic は明記、DeepSeek は構築に数秒）。
- Anthropic: breakpoint は「tools の末尾」「system の末尾」「最後の会話 block」（automatic caching）で 3 枠。20 block の lookback を超えて書き換えると遡って見つけられないので、長い会話では途中にも breakpoint を置く。

### Gaps
- 提供元の側での subagent の prefix 共有を測った一次資料は見つからなかった。

## 4. 実際のハーネスの hit 率と、cache が壊れた事例

### Takeaway
2026-04 の Requesty の集計では Claude Code 91.9%、OpenCode 89.0%。prompt の作り方しだいで 45〜92% と大きく開く。Claude Code は v2.1.251 以降、`/cost` で miss の原因を 16 種類に分けて出す。

### Cited Findings
- Requesty（2026-04、cached_tokens / input_tokens、標本の数は書かれていない）: Claude Code 91.90%（1 回の平均入力 84K）、OpenCode 89.00%（95K）、Aider 84.00%（16K）、Zed 80.10%、Roo Code 73.60%、Forge 63.90%、Cline 61.40%、Kilo Code 45.50%（62K）。差は「prefix を一定に保つ作り」によるとしているが、検証はない。Codex と Cursor は載っていない — [Requesty](https://www.requesty.ai/data/coding-agent-cache-hit-rate-apr-2026)
- Claude Code の `/cost` の「Prompt cache (main)」の行（v2.1.251 で追加、v2.1.260 で原因の表示）。原因: モデルの変更、effort の変更、fast mode、auto mode の切り替え、tool 定義の変更（MCP の追加や削除）、deferred tool loading の変更、system prompt の変更、過去の message の変更、1h や 5m の TTL 超えの idle、利用上限の状態の変化（usage credits に移ると TTL が 5 分に落ちる）、TTL や scope の変更、beta header や追加の欄の変更、サーバー側と思われるもの、不明。hit 率 95% 未満かつ 2,000 tokens 以上の miss で「miss」と数え、90% 以上で健全とみなす。記事は 2026-09-14 — [wmedia.es](https://wmedia.es/en/tips/claude-code-cost-what-broke-your-cache)
- Claude Code の不具合の報告（GitHub issue の写し）: ある利用者の hit 率が 1 つのプロジェクトで約 3.1%、別のもので約 18%、cache の作成が常に 0。feature flag（`tengu_system_prompt_global_cache`）がその機械だけ false だった。解決は確認できない — [claudeissues.com #24121](https://claudeissues.com/issue/24121-low-prompt-cache-utilization-cachecreationinputtokens-consistently-0)
- 個人の検証: Claude で約 730K tokens を超える入力では、エラーも警告もなく `cache_read_input_tokens` が 0 になった（約 488K では効いた）。一人の試験で、公式の確認はない — [mer.vin](https://mer.vin/news/claudes-prompt-cache-stops-working-somewhere-past-500k-tokens/)
- 独自の system prompt が Claude の cache を壊すという記事（2026-08） — [mer.vin](https://mer.vin/2026/08/why-your-custom-system-prompt-silently-kills-claudes-prompt-cache/)（中身は読めていない）
- OpenCode Go は DeepSeek Harness などを session 対応が欠けているとしている — [OpenCode Go](https://opencode.ai/docs/go/)

### Inferences
- ja-harness の目標の値として「hit 率 90% 以上」（Claude Code の健全の基準、OpenCode の 89%）が使える。状態の行か `/context` に hit 率を出し、Claude Code のように miss の原因（tool・system・過去の message・idle・モデル）を差分で示すと、利用者にも開発者にも役立つ。
- 原因を見分けるには、送る前に各段（tools・system・messages）の hash を記録し、前回と比べればよい。

### Gaps
- Codex と Cursor の hit 率の数字は見つからなかった。Requesty の標本の数は不明。

## 5. 落とし穴

### Takeaway
壊す原因はほぼ「先頭に近い 1 token の違い」。時刻、tool の一覧、モデルや effort の切り替え、thinking block の扱い、画像の出し入れ、JSON の key の順、TTL 切れ。

### Cited Findings
- 時刻: system prompt の先頭に秒まで入った時刻を置くと hit 率が落ちる — [Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)。動くものは末尾に — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)、[arXiv 2601.06007](https://arxiv.org/abs/2601.06007)
- tool の一覧の変更: Anthropic では tools・system・messages の全段が無効になる — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)。OpenAI でも経路の hash に tool 定義が入る — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)。Claude Code も MCP の出し入れを原因に挙げる — [wmedia.es](https://wmedia.es/en/tips/claude-code-cost-what-broke-your-cache)
- モデルの切り替え: cache はモデルごと（Anthropic は tools と system もモデル固有） — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)、[OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)。OpenCode Go の DeepSeek V4 Pro → Flash の付け替えのように、提供元の側でモデルが替わることもある（旧名 `deepseek-v4-flash` は退役し V4.1-Flash-1017 に送られる） — [DeepSeek 価格頁](https://api-docs.deepseek.com/quick_start/pricing)
- thinking: Anthropic では thinking の設定や effort を変えると messages が無効。thinking block を落とすとその位置から後ろが無効 — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)。OpenAI でも `reasoning.effort` が prefix を変える — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)
- 画像: Anthropic では画像をどこかで足したり消したりすると messages が無効 — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- JSON の key の順 — [Manus](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
- TTL: Anthropic の 5 分は長い stream の間も減る — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)。OpenRouter の sticky は 10 分で切れる — [OpenRouter](https://openrouter.ai/docs/features/prompt-caching)
- 最小の長さに届かない prompt は、何も言わずに cache されない — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- OpenAI の 1 key 毎分 15 リクエストを超えると溢れて miss になる — [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching)

### Inferences（ja-harness で気をつけること）
- DeepSeek（OpenAI 互換）の reasoning の内容を次の往復に戻すか落とすかを、毎回同じ扱いにする（戻す・落とすが混ざると、その位置から prefix が変わる）。
- ツール結果の切り詰め（2,000 tokens）は、結果を最初に入れるときに一度だけ行い、後から切り直さない。後から縮めると masking と同じく cache を壊す。
- 料金の表示で「cached」「miss」を DeepSeek・Anthropic・OpenAI で別の欄から読む必要がある（`prompt_cache_hit_tokens` / `cache_read_input_tokens` / `cached_tokens`）。Anthropic の `input_tokens` は最後の breakpoint より後ろだけなので、合計の入力は 3 つの欄の和で出す。

### Gaps
- DeepSeek での thinking の内容の扱いと cache の関係を書いた公式の記述は見つからなかった。
- 画像の入力で DeepSeek や OpenCode Go の cache がどうなるかは不明。
