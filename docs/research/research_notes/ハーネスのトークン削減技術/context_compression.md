# 文脈と履歴の圧縮の新しい手法（observation masking と LLM-Summary の先）

調査日: 2026-10-26。すでに読んだ資料（Complexity Trap、Agents Don't Paginate、ACON、Focus、Squeez、SWE-Pruner、Context Rot、Anthropic と Manus の記事）は、新しい数字が出たものだけ載せる。数字はどれも各論文の自己申告で、モデル・scaffold・課題の部分集合が違うため、論文をまたいで直接は比べられない。

## 学習済み・課題に応じた道具の出力の刈り込み（Squeez、SWE-Pruner、LLMLingua-2 ほか）

### Takeaway
道具の出力を「文脈に入れる前に1回だけ」縮める observation compression は、append-only を壊さないので KV-cache と両立し、料金が実際に下がる。逆に token 単位の汎用圧縮（LLMLingua-2）は、手順が増えて合計のトークンがかえって増える。学習なしで今すぐ使えるのは、行単位の規則による刈り込みと、元の出力を保存して「続きを読める」印を付ける方法。小さいモデルの圧縮器は効くが、どれも自前の学習（LoRA など）が前提。

### Cited Findings
- **CoACT（2026-07-03）**: 「圧縮した出力でも、元の出力と同じ次の行動を引き出すか」（next-action preservation）で圧縮の候補を選び、Qwen3.5-4B を LoRA で学習した圧縮器を使う。SWE-bench Verified（200件、mini-swe-agent、bash のみ）の3モデル平均で、合計トークン -33.0%（1.849M→1.239M）、PASS@1 +2.0pt（69.0→71.0）、手順 -9.4%。DeepSeek-v4-Pro では 1.068M→0.868M、PASS@1 76.5→75.0 — [CoACT](https://arxiv.org/abs/2607.02911)
- 同じ論文の比較（Qwen3.5-35B-A3B）: LLMLingua-2 は PASS@1 57.0→50.0、手順 +111%、合計トークン +172%。SWE-Pruner は PASS@1 59.5 だが手順 +24%、トークン +18%。LongCodeZip はトークン -17%。DeepSeek-v4-Pro でも LLMLingua-2 はトークン +66%、SWE-Pruner は +17% — [CoACT](https://arxiv.org/abs/2607.02911)
- 増えた理由として、必要な情報を消すと、取り戻すための道具の呼び出しが増えることを挙げている — [CoACT](https://arxiv.org/abs/2607.02911)
- 道具の出力は合計トークンの 45.7%（SWE-bench Verified）、Terminal-Bench では最大 67.8% を占める — [CoACT](https://arxiv.org/abs/2607.02911)
- CoACT の消去実験: 「次の行動が変わらない」条件を外すと PASS@1 60.5→50.0 に落ちる。短さだけで選ぶと危ない — [CoACT](https://arxiv.org/abs/2607.02911)
- **SWE-Pruner Pro（2026-07-20）**: エージェント本体の hidden states に小さな head を付けて、行ごとに残すか捨てるかを決める。本体は凍結し、head は約22,600件で学習する。読むだけの課題で合計トークンは -7%〜-39%。SWE-bench Verified では、MiMo-V2-Flash は解決数 326→345 だが入力トークン +7.4%、Qwen3-Coder-Next は入力 -13.5% で解決率 -1.2pt。hidden states が要るので、open-weight を自前で配信する場合に限られる。LLMLingua-2 は Oolong でトークン +164〜190% — [SWE-Pruner Pro](https://arxiv.org/html/2607.18213)
- **Squeez（2026-04-04）**: Qwen 3.5 2B を LoRA で学習し、入力トークンの 92% を取り除く。recall 0.86、F1 0.80。zero-shot の Qwen 3.5 35B A3B より recall が 11pt 高い。エージェント全体での解決率は abstract に記載がない — [Squeez](https://arxiv.org/abs/2604.04979)
- **AttnCompress（2026-09-08、ISSTA 2026）**: PPL の急な変化でブロックに分け、小さい proxy モデル（Qwen3-4B など）の attention で今の推論との関連を測り、rolling window で選び直す。SWE-bench Verified の3モデル平均で、Pass 53.17%（全文 55.17%）、入力 -42.3%（1118k→645k）、合計の料金 -20.2%。比較の Pass 平均は、ObsMask 47.17%、SlidingWindow 49.83%、LLMLingua 48.67%、LLMSummary 50.83%、AgentDiet 51.17% — [AttnCompress](https://arxiv.org/abs/2609.08318)
- 同じ論文で、料金がいちばん安いのは ObsMask（平均 $0.0443。全文は $0.1189）。ただし Pass は最も低い部類（47.17%）で、手順は 45.9→63.5 に増えた。Qwen3-235B では Pass 46.5→31.5 と大きく落ちた。5回の繰り返し（Qwen3-Coder-30B）でも、ObsMask の Pass は 40.8%（全文 44.1%）で、料金は約半分 — [AttnCompress](https://arxiv.org/abs/2609.08318)。この結果は Complexity Trap（masking は Summary と同じくらいの質）と一部食い違う（下の Inferences を参照）
- AttnCompress の proxy は 1.7B でもほぼ同じ質（Qwen3-Coder-30B で Pass 43.5%。4B は 44.5%）。失敗の主な原因は、あとで要る前のファイルのパス、補助関数、エラーの文を消したこと — [AttnCompress](https://arxiv.org/abs/2609.08318)
- **ContextSniper（2026-07-02）**: 学習なし。リポジトリとの間に置く記憶の層。長いファイルの読み取りやコマンドの出力を、指定の範囲、失敗、assertion の文に絞り、元の出力は保存して「短くした」と印を付け、続きを頼めるようにする。SWE-bench Lite（各50回）で、OpenClaw は合計トークン -51.5%（料金 -36.4%）、解決率 26→24%。Claude Code は -38.9%（料金 -27.3%、推定）、32→30% — [ContextSniper](https://arxiv.org/html/2607.01916v1)
- token 単位の刈り込みは、JSON、コードのブロック、ファイルのパスなど、1トークンが構造を担う内容を壊しうる — [Morph の解説](https://www.morphllm.com/context-compression)（ベンダーの解説で、実験ではない）
- 道具ごとの規則による圧縮（git、pytest、npm などの36個の processor）で、CLI の出力を 60〜99% 減らせると主張している。エラー、差分、stack trace は残す — [token-saver](https://github.com/ppgranger/token-saver)（自己申告）

### Inferences
- ja-harness では、「文脈に入れる時点で1回だけ縮める」層（規則による shell 出力の掃除、2,000トークンの上限、元を保存して `read_more` できる印）を主にするのがよい。CoACT と AgentDiet の結果では、すでに文脈に入った部分の書き換えは KV-cache を壊して、トークンほど料金が下がらない。
- 学習なしで CoACT の考え方を借りるなら、「縮めたあと、エージェントが同じ出力をもう一度読みにいく率」と「手順の数」を、圧縮の質の指標として記録できる。自前の評価で、再読の率が上がる圧縮規則は外す。
- 小さいモデルの圧縮器（Squeez 2B、CoACT 4B、AttnCompress 1.7〜4B）は、ローカルの GPU か安い API があれば動く。ただ、学習済みの重みを流用できるかは論文ごとに確かめる必要がある。v0.1 では入れず、規則と「印付きの切り詰め」で足りるかを先に測るのが無難。
- 大きいモデルへの prompt だけの圧縮（zero-shot）は、Squeez で recall が 11pt 低かった。それに、毎回の呼び出しの料金も乗る。

### Gaps
- Squeez を CoACT や SWE-Pruner と、同じ SWE-bench の条件で比べた結果は見つからなかった。
- 公開されている重み（Squeez、CoACT）のライセンスと配布の状態は確かめていない。
- 日本語を含む出力（日本語のエラー文やコメント）で、これらの圧縮器がどう働くかの資料はない。

## エージェントの記憶と外部の記憶（ファイル、メモ、todo の読み上げ、MemGPT/Letta、A-MEM）

### Takeaway
「ファイルに書き出して、文脈からは消す」は、Anthropic の memory tool と context editing の組み合わせと ContextSniper で、トークンの削減と成功の維持が測られている。一方、会話向けの記憶（Mem0、Letta、A-MEM）を、コードのエージェントのトークンで比べた独立の測定は見つからなかった。

### Cited Findings
- Anthropic の context editing（古い道具の呼び出しと結果を自動で消す）と memory tool（クライアント側のファイルで、作成・読み取り・更新・削除ができる）。社内の agentic search の評価で、両方使うと基準より +39%、context editing だけで +29%。100往復の web 検索では、文脈があふれて失敗していた作業を最後まで終えられ、トークンは -84%。2025-09-29 の発表で、評価の設定は公開されていない — [Claude blog: context management](https://claude.com/blog/context-management)
- ContextSniper の記憶は3段の view を持つ。L0 は短い要約、L1 はパス・シンボル・関係、L2 は全文。ハイブリッド検索（埋め込み、BM25、ctags、関係グラフ。弱ければ ripgrep）で L2 の断片を返し、編集のあとはリポジトリの差分に合わせて更新して、古いコードを返さないようにする。数字は前の節を参照 — [ContextSniper](https://arxiv.org/html/2607.01916v1)
- **SWE-MeM（2026-06-26）**: 「いつ・何を・どう圧縮するか」をエージェント自身が記憶の道具で決める。Memory-aware GRPO で学習する。SWE-bench Verified で 4B は 43.4%、30B は 60.2% — [SWE-MeM](https://arxiv.org/abs/2606.28434)。検索の抜粋（本文は未確認）によると、要約型のエージェントは基準の ReAct の 203.9% のトークン（約5.18M）で 53.8%、SWE-MeM は約94.7% のトークンで 60.2% — [SWE-MeM PDF](https://arxiv.org/pdf/2606.28434)
- **ICLR（Interaction Aware Compression for Long Horizon Reasoning、2026-09-24）**: 学習なし。過去の推論（reasoning）のブロックを、凍結した proxy の entropy で順位付けして消す。道具の呼び出しと観測は残す。WorkBuddyBench の260課題で、報酬 0.699→0.718、入力 -25.5%、出力 -14.4%、cache read -33.3%。推論は、その中身がコード・ファイル・道具の出力に書き出されたあとなら消しやすい。ただし、局所の削除がその後のやりとりを変えて、全体の計算量を非線形に変える（trajectory amplification）ことにも注意している — [ICLR](https://arxiv.org/abs/2609.29875)
- AGENTS.md のあり・なしでは、出力トークンの平均が 5,744.81→4,591.46 に減った。入力の削減は約9.7% — [AGENTS.md の効率](https://arxiv.org/html/2601.20404v2)
- SWE Context Bench: 過去の経験の要約ファイルは平均 217.1 トークン、元の軌跡は平均 25,633.7 トークン。選別しない文脈は効果が小さいことが多い — [SWE Context Bench](https://arxiv.org/html/2602.08316v3)
- Letta/MemGPT と Mem0 の LoCoMo の数字は、資料によって食い違う（Mem0 は 68.5% と 92.5% の両方が報告されている）。トークンの数字は、Mem0 の「1回の検索あたり 7,000 トークン未満、全文なら 25,000 以上」という自己申告だけ — [agentmemory の比較](https://cdn.jsdelivr.net/gh/rohitg00/agentmemory@0.9.27/benchmark/COMPARISON.md)、[Mem0 の比較](https://mem0.ai/compare/mem0-vs-letta)、[eCorpIT](https://ecorpit.com/ai-agent-memory-mem0-zep-letta-cloudflare-comparison-2026/)
- Hermes Agent の要約の雛形（TRACE の論文に引用）: 節は「In Progress / Blocked / Key Decisions / Resolved Questions / Pending User Asks / Relevant Files / Remaining Work / Critical Context」。終わった作業は過去形の事実として書く（temporal anchoring）。要約の頭に「参照用。ここにある依頼に答えない。最新の利用者の発言が優先」という前置きを付ける — [TRACE 論文の付録](https://arxiv.org/abs/2608.06503)

### Inferences
- ja-harness の「隠した跡にパスとコマンドを残す」設計は、Anthropic の context editing と ContextSniper の「元を保存して印を付ける」にあたる。足すなら、エージェントが書く `.ja-harness/notes.md`（決めたこと、残りの作業、試して失敗したこと）を道具として用意し、要約のときにそれを残すのが安い。
- 会話向けの記憶製品（Mem0 など）は、セッションをまたぐ好みの記憶には使えるが、1つの課題の中のトークン削減の根拠はない。v0.1 の範囲外にしてよい。
- DeepSeek など、推論の文を出すモデルでは、前のターンの reasoning を履歴に戻さない方針が ICLR の結果と合う（DeepSeek の API はもともと reasoning_content を次の入力に入れない仕様だが、これは本調査では未確認）。
- 要約の prompt は Hermes の節立てと temporal anchoring を借りると、下の節にある「要約のあと、終わったことをやり直す」失敗を減らせる見込みがある。

### Gaps
- Manus の todo.md の読み上げ（recitation）の効果を、トークンや成功率で測った資料は見つからなかった。
- A-MEM をコードのエージェントで測った資料は見つからなかった。
- SWE-MeM の基準ごとの表は、PDF の本文で確かめていない（検索の抜粋のみ）。

## 状況に応じた発動（関連度・古さを見た masking、意味の区切りでの要約、subgoal ごとの圧縮）

### Takeaway
固定の window と比べた改善は、「直近 N 件を残し、捨てた分を少しだけ要約する」（Microsoft）、「関連度で選び直す rolling window」（AttnCompress）、「古い・重複・不要な部分を1歩ずつ消す」（AgentDiet）で示されている。ただ、すでに文脈にある部分を書き換える方法は、prompt caching が効く API では料金がトークンほど下がらない。

### Cited Findings
- **Less Context, Better Agents（Microsoft、2026-06-08）**: 毎回、直近 N=5 件の道具の呼び出しと結果の対を残し、古い対は呼び出しごと捨てる。捨てたうちの最新3件（W=3）を1回の LLM 呼び出しで要約し、捨てた位置に置く。GPT-5 の MCP の業務課題（50件×5回）で、全文 71.0%・1,481K トークン → 直近5件 79.0%・535K → 直近5件＋要約 91.6%・553K（トークン -62.7%、時間 -60.2%）。N=3 は 74.0%・425K、N=10 は 80.0%・820K。全部の要約（W=-1）は 92.0% だがトークンは約11%多い。Claude Sonnet 4.5 では 88.0%・3,562K → 94.5%・2,235K。ただし時間は 6.2h→11.3h に延びた。observation masking とは比べていない — [Less Context, Better Agents](https://arxiv.org/html/2606.10209v1)
- **AgentDiet（FSE 2026。v1 は 2025-09-28）**: 各歩のあとに外の LLM（GPT-5 mini）が、2歩前の1歩だけを、前後の歩を見ながら縮める。500トークン以下の歩は見ず、500トークン以上減るときだけ書き換える。消すのは、不要（`__pycache__` の一覧、長いビルドの出力）、重複（str_replace の新しい文が結果に繰り返される、など）、期限切れ（原因のファイルを見つけたあとの、ほかのファイルの中身）。Trae Agent で SWE-bench Verified と Multi-SWE-bench Flash を測り、入力 -39.9〜59.7%、正味の料金 -21.1〜35.9%、Pass は -1.0〜+2.0pt。反省役の費用は元の約5〜15%。1回に1歩だけ書き換えるので、それより前の cache は生きる — [AgentDiet](https://arxiv.org/html/2509.23586v2)
- ただし CoACT の再現（Qwen3.5-35B-A3B）では、Sliding Window はトークン -40.3% で料金 -8.6%、AgentDiet はトークン -43.7% なのに料金は +10.6%。理由は KV-cache が外れて、cache の約10倍の値段の uncached 入力が増えたこと。CoACT と組み合わせると、AgentDiet の料金は $45.65→$25.88 — [CoACT](https://arxiv.org/abs/2607.02911)
- AttnCompress の rolling window は、過去のブロックを今の推論との関連で毎回選び直し、一度外したものを呼び戻せる。前の節のとおり、固定の SlidingWindow や ObsMask より Pass が高い — [AttnCompress](https://arxiv.org/abs/2609.08318)
- **TRACE（Nokia、2026-10-14 v2）**: AppWorld（147課題、MiniMax-M3）で、16K・8K・4K の予算では FIFO の切り捨てが要約と同等か少し上だった。差が出たのは最も厳しい予算だけ（要約 72.8%、FIFO 42.2%）。どちらも全文には届かない — [TRACE](https://arxiv.org/abs/2608.06503)
- TRACE は、圧縮の境目ごとに、圧縮の前と後から同じ状態で続きを走らせ、「環境に拒まれた行動」と「前に行った行動の繰り返し」の増え方で要約を採点し、要約の prompt を最適化する（モデルは凍結）。AppWorld で、MiniMax-M3 では全文 85.7%、LLMLingua-2 68.2%、Prompting-O 71.4%、TRACE 77.1% — [TRACE](https://arxiv.org/abs/2608.06503)
- Anthropic の context editing は、文脈が上限に近づいたら古い道具の結果を消す — [Claude blog](https://claude.com/blog/context-management)

### Inferences
- ja-harness の既定（masking を常に動かし、10件たまったらまとめて隠す）は、Microsoft の「直近 N＋捨てた分の小さな要約」に近い。違いは要約の有無で、Microsoft では要約を足すと 79.0→91.6% に上がった。ただ、これは MCP の業務課題で、コードではない。捨てる10件をまとめて短い要約（数行）にしてから跡に残す方式は、試す価値がある。まとめて隠すので、cache の外れは10件に1回にとどまる。
- 「関連度で選び直す」方式（AttnCompress）は、毎回の文脈が変わるため KV-cache と相性が悪い。ja-harness の「append-only を優先」とぶつかるので、v0.1 には入れないほうがよい。
- AgentDiet 型の「1歩遅れで1歩だけ縮める」は、cache を壊す範囲が狭い。それでも CoACT の再現では料金が増えたので、DeepSeek のように cache がとても安い API では、入れる前に料金で測る必要がある。

### Gaps
- 「subgoal の終わりで圧縮する」（Focus など）と、固定の window を同じ条件で比べた新しい測定は、今回は見つからなかった。
- 関連度や古さで masking を選ぶ方式と、Complexity Trap の固定の masking を、同じ SWE-bench の条件で比べた資料はない（AttnCompress の ObsMask が最も近い）。

## 重複の除去と差分の観測（編集後は変わった行だけ、テスト出力の差分）

### Takeaway
重複と差分は、AgentDiet の「重複」の分類と、道具の側の実装（再読で差分だけ返す、繰り返しのテストの差分）で使われている。ただし、prompt caching のある API では、すでに cache にある繰り返しは安いので、削減の多くが消える。ファイルの読み取りを要約に置き換えると、編集が合わなくなって再読の繰り返しが起きる。

### Cited Findings
- AgentDiet は、str_replace_editor の結果に新しい文が繰り返されること、古い文が前の軌跡のコードと重複することを、消す対象の「重複」に挙げている — [AgentDiet](https://arxiv.org/html/2509.23586v2)
- Token Optimizer の hook は、一度読んだファイルを読み直すと変わった部分だけを返し、再読で約20%減ると主張している（自己申告） — [token-optimizer](https://github.com/alexgreensh/token-optimizer)
- token-saver は、繰り返した pytest と Ruff の結果を比べる delta を任意で入れられ、残した詳細は1つのコマンドで呼び出せる — [token-saver](https://github.com/ppgranger/token-saver)
- **DeepSeek V4 Pro での実測（2026-07-21 の実験、記事は 2026-10-08）**: 5課題×5回×3条件で、圧縮なし、キーワードによる決定的な圧縮、V4 Flash の要約（経済的な確認で絞る）を比べた。料金の削減の中央値は約2.1% と約1.9% で、95% 区間は0をまたぐ。入力の約92% は cache hit で、cache hit の値段は miss の 0.83%。古いメッセージの書き換えは cache を外すので、その費用が削減を上回りうる — [DEV Community](https://dev.to/projectescape/does-compacting-tool-output-lower-a-coding-agents-api-bill-ena)
- 同じ実験で、2,000字を超える道具の出力を要約した最初の版は、ファイルの読み取りが要約になって search-and-replace が合わなくなり、エージェントが再読を繰り返した。古い読み取りを「reread」の印に置き換えた試験版でも、上限まで再読が続いた。ファイルの読み取りは、その後は常にそのまま残している — [DEV Community](https://dev.to/projectescape/does-compacting-tool-output-lower-a-coding-agents-api-bill-ena)
- SWE-bench Verified の8モデルの分析: 費用は出力ではなく入力が決める。同じ課題でも回によって合計トークンが最大30倍違う。費用を多くかけても正答率は中ほどで頭打ちになる — [How Do AI Agents Spend Your Money?](https://arxiv.org/abs/2604.22750)
- Mini-SWE-Agent と Claude Sonnet 4.5 では、読み取り系の操作が合計トークンの 76.1% を占め、読んだコードは文脈に残って積み上がる — [検索の抜粋。ContextSniper または SWE-MeM 周辺の資料](https://arxiv.org/html/2607.01916v1)（出典の論文は特定できていない）
- コードの minification で入力トークン -42%、解決率 -12% — [TU Wien の修士論文](https://repositum.tuwien.at/bitstream/20.500.12708/224666/1/Hrubec%20Nicolas%20-%202025%20-%20Reducing%20Token%20Usage%20of%20Software%20Engineering%20Agents.pdf)

### Inferences
- 編集の結果は「変わった行と前後数行」だけを返し、編集した文を繰り返さないようにするのが安全で効果も見込める。新しく増える分だけを縮めるので、cache は壊さない。
- テストやリンターの2回目以降は、「前回からの差分（新しく失敗、新しく成功）」を返し、全文は保存して読めるようにする。これも追記だけで済む。
- ファイルの読み取りを要約や「reread」の印に置き換えるのは避ける。ja-harness の「編集したファイルの古い読み取りはすぐ隠す」は、新しい読み取りか編集の結果が文脈にある場合に限るのがよい。
- DeepSeek V4 系の cache hit は miss の約1%なので、ja-harness の主な対象では「新しく入るトークン（uncached）」と出力を減らすほうが効く。料金の表示は cached と uncached を分けて出すべき。

### Gaps
- 差分だけを返す方式の効果を、SWE-bench などで成功率込みで測った論文は見つからなかった（道具の自己申告だけ）。
- DEV Community の実験は25対と小さく、課題も5つだけ。cache のない API での結果は、著者が今後測るとしている。

## 危険（情報の欠落、再読、成功率の低下）と失敗した方法

### Takeaway
失敗の型は3つにまとまる。①汎用の token 単位の圧縮で必要な情報が消え、取り戻すための手順が増えて、合計がかえって増える。②すでにある文脈の書き換えで KV-cache が外れ、トークンは減っても料金が下がらない。③要約を繰り返すと「どこまで終わったか」が弱まり、終われない・同じ探索を繰り返す・回ごとのばらつきが大きくなる。

### Cited Findings
- LLMLingua-2: SWE-bench Verified で PASS@1 57.0→50.0、手順 +111%、合計トークン +172%（Qwen3.5-35B-A3B） — [CoACT](https://arxiv.org/abs/2607.02911)。AppWorld では 85.7→68.2%、難しい課題では 75.4→44.4% — [TRACE](https://arxiv.org/abs/2608.06503)
- Random と LLMLingua による削除は、意味のつながりを壊してエージェントを混乱させ、手順が増える（Random 61.42、Lingua 58.31、元は 45.93） — [AttnCompress](https://arxiv.org/abs/2609.08318)
- ObsMask は料金が最も安いが、Pass が最も低い部類（47.17%、全文 55.17%）で、手順が増える — [AttnCompress](https://arxiv.org/abs/2609.08318)
- 書き換えによる cache の外れ: Sliding Window はトークン -40.3% でも料金 -8.6%、AgentDiet はトークン -43.7% でも料金 +10.6% — [CoACT](https://arxiv.org/abs/2607.02911)。DeepSeek V4 Pro では、圧縮による料金の削減が約2%で、誤差の範囲 — [DEV Community](https://dev.to/projectescape/does-compacting-tool-output-lower-a-coding-agents-api-bill-ena)
- 要約を繰り返すと、直近のやりとりの影響が弱まる。環境に拒まれる行動と、前の探索の繰り返しが増え、P@2 と P2 の差が開く（解けたり解けなかったりする課題が増える）。最も厳しい予算の 2K では、要約の文脈で正しく終われたのは 44.6%（形式も正しいのは 37.3%）。FIFO は 77.2%/68.1%、全文は 66.6%/60.6%。長い課題ほど落ち方が大きい — [TRACE](https://arxiv.org/abs/2608.06503)
- ファイルの読み取りの要約と「reread」の印は、編集が合わなくなって再読の繰り返しを起こした — [DEV Community](https://dev.to/projectescape/does-compacting-tool-output-lower-a-coding-agents-api-bill-ena)
- AttnCompress の失敗の主な原因は、あとで要る前のパス、補助関数、エラーの文を消したことで、その後のステップでは取り戻せなかった — [AttnCompress](https://arxiv.org/abs/2609.08318)
- ContextSniper は解決率が2pt下がった（両方のホスト）。著者は効率の主張にとどめている — [ContextSniper](https://arxiv.org/html/2607.01916v1)
- SWE-Pruner Pro は、モデルによって解決率が上がる場合（+3.8%）と下がる場合（-1.2pt）があり、トークンが増える場合もあった — [SWE-Pruner Pro](https://arxiv.org/html/2607.18213)
- 過去の推論を消すと、局所の削除がその後のやりとりを変えて、全体の計算量を非線形に変えうる — [ICLR](https://arxiv.org/abs/2609.29875)
- Microsoft の実験で、Sonnet 4.5 は刈り込みでトークンは減ったが、時間は 6.2h→11.3h に延び、理由は説明されていない — [Less Context, Better Agents](https://arxiv.org/html/2606.10209v1)

### Inferences
- 圧縮を評価するときは、トークン数だけでなく、①cached と uncached に分けた料金、②手順の数と同じ読み取りの繰り返し、③複数回の安定性（P^k）を記録する必要がある。ja-harness の次の版の測定（nihongo-kit の部品の流用）に入れるべき指標。
- 要約のあとにも、直近の数件の生のやりとりを残す（FIFO の局所のつながり）。それに、Hermes 型の「済んだことは過去形」「前置きで参照用と明記」を組み合わせるのが、TRACE の結果から見て安い対策になる。
- AttnCompress の ObsMask の結果は、Complexity Trap の「masking は Summary と同じくらい」と食い違う。AttnCompress の ObsMask の設定（window の大きさなど）は未確認で、モデルによって差が大きい（Qwen3-235B で 46.5→31.5）。ja-harness の既定（直近10件、跡にパスとコマンド）が安いモデルで質を落とさないかは、自分で確かめるべき。

### Gaps
- DeepSeek V4.1 Flash での、圧縮の方法ごとの成功率と料金の測定は見つからなかった。
- 失敗の報告の多くは1つのモデルと1つのベンチマークによるもので、日本語の課題での測定はない。
