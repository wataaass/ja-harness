# 往復（turn）を減らす技術：コードのエージェントでやりとり全体のトークンを抑える

調べた日: 2026-10-26。対象は ja-harness（TypeScript、DeepSeek V4.1 Flash・Claude Haiku）。計画済みの plan mode、subagent、repo map、repeat detection、30往復の上限は扱わず、それ以外の手段と数値を集めた。

## Parallel tool calls：各社の対応、測った削減、失敗のしかた

### Takeaway
Anthropic・OpenAI・DeepSeek（第三者の資料による）のどれも、1回の応答で複数の tool call を出せる。ただし往復やトークンがどれだけ減るかを、コードのエージェントで測った一次資料は見つからなかった。ハーネス側で必ず守ることは2つある。すべての tool_result を次の1つの user message にまとめること（分けると、モデルが並列に呼ばなくなる）と、副作用のある呼び出しは順に実行すること。

### Cited Findings
- Anthropic: 既定で並列の tool use が有効。1つの assistant turn に複数の `tool_use` block が入りうる。実行の順は API が決めず、同時でも順でもよい。独立した読み取り専用の操作は並列にしてよく、副作用・共有状態・順序のある tool は順に実行するほうがよい場合がある — [Anthropic Docs: Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)
- Anthropic: 各 `tool_use` に1つずつ `tool_result` を返し、すべてを次の1つの user message に、テキストより前に入れる。実行しなかった呼び出し（前の書き込みが失敗した、など）にも `is_error: true` と短い理由を返す — [同上](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)
- Anthropic: 並列にならない原因で最も多いのは、履歴の tool_result の形の誤り。結果ごとに user message を分けると、Claude が並列の呼び出しを避けるように「学ぶ」。次の対策は、システムプロンプトに `<use_parallel_tool_calls>` の指示を足すこと（Claude 4 以降向け） — [同上](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)
- Anthropic: 止めるには `tool_choice` の中に `disable_parallel_tool_use: true` を入れる（トップレベルの引数ではない）。`auto` なら1応答に最大1回、`any`/`tool` ならちょうど1回になる — [同上](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)
- Anthropic: `tool_choice` を変えると、キャッシュしたメッセージの block が無効になる（tool 定義とシステムプロンプトのキャッシュは残る）。Opus 5.5・Sonnet 5.5 などは `any`/`tool` で 400 を返す — [Anthropic Docs: Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- OpenAI: 以前は、Structured Outputs の strict と並列の function call は相性が悪く、`parallel_tool_calls: false` が勧められていた — [Vapi support thread（OpenAI の告知の引用）](https://support.vapi.ai/t/26824393/strict-parameter-doesn-t-work)、[apiyi docs](https://docs.apiyi.com/en/api-capabilities/openai/function-calling)。一方、2025-05-21 の OpenAI コミュニティの投稿は「並列の function calling が strict でも動くようになった」と書いている — [OpenAI Community: Structured Outputs gets nifty improvements](https://community.openai.com/t/structured-outputs-gets-nifty-improvements/1266968)。資料どうしが食い違う。今の公式文書での確認はできていない
- DeepSeek: AG2 の文書は、DeepSeek が parallel tool calling に対応していると書いている — [AG2 docs: DeepSeek v3](https://docs.ag2.ai/latest/docs/user-guide/models/deepseek-v3/)。LiveKit の DeepSeek 連携には `parallel_tool_calls` の引数がある — [LiveKit docs](https://docs.livekit.io/agents/models/llm/deepseek.md)。自前で動かす場合（LightLLM）は deepseekv3 の parser と `parallel_tool_calls` の引数を使う — [LightLLM docs](https://lightllm-en.readthedocs.io/en/latest/tutorial/function_calling.html)。どれも第三者の資料
- 往復1回の削減の目安: Anthropic は「20回以上の呼び出しを1つのコードにまとめると、推論を19回以上省ける。5つの tool の流れなら、ふつうは推論が5回要る」と書いている（Programmatic Tool Calling の文脈。並列呼び出しの実測ではない） — [Anthropic: Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)

### Inferences
- 並列にしても、出る tool call の数と tool_result のトークンは変わらない。減るのは往復の数だけで、往復ごとに送り直す prefix の分（キャッシュがあれば cached input の料金、なければ全額）が浮く。キャッシュの効く Claude では効果が小さくなり、キャッシュが弱い・ない provider では大きくなる。
- ja-harness では、読み取り系（read、grep、glob、ls）は並列に、書き込みとシェルは順にする方針が自然。シェルは確認が要るので、複数のシェル呼び出しは1回の確認画面にまとめて見せると、往復も人の手間も減る。
- OpenAI 互換 API で使う場合は、tool_result を `role: "tool"` の連続したメッセージとして返すのが仕様。Anthropic の「1つの user message にまとめる」という注意は、Anthropic 形式に変換するときに守る必要がある。

### Gaps
- コードのエージェントで並列呼び出しを有効にしたとき・止めたときの、往復数・トークン・成功率を比べた測定は見つからなかった。
- DeepSeek の公式文書（api-docs.deepseek.com）で、並列呼び出しの対応、上限、ストリーミング中のふるまいを確認できていない。DeepSeek V4.1 Flash や OpenCode Go 経由でどうなるかは、実際に試す必要がある。
- 安いモデルほど並列の呼び出しで引数を誤る、などの失敗の頻度のデータは見つからなかった。

## Code mode・programmatic tool calling：測った削減、sandbox の費用、ローカルのハーネスへの当てはめ

### Takeaway
モデルに tool を直接呼ばせず、tool を呼ぶコードを書かせて1回で実行すると、途中の結果がモデルを通らなくなり、往復とトークンが減る。測った数字は、Anthropic の PTC で平均トークン −37%、CodeAct で往復が最大約28%減と成功率 +20 ポイント前後。代わりに、生成したコードを安全に動かす sandbox が要る。

### Cited Findings
- Anthropic「Code execution with MCP」（2025-11-04）: MCP サーバーを tool の呼び出しではなく、ファイルの木に置いたコードの API（例: `./servers/google-drive/getDocument.ts`）として見せる。エージェントはディレクトリを見て、要るファイルだけを読む。tool 定義のトークンが約150,000から約2,000に減った（98.7%減） — [Anthropic Engineering](https://www.anthropic.com/engineering/code-execution-with-mcp)
- 同記事: 2時間の会議の文字起こしを tool から tool に渡すと、モデルを2回通るため約50,000トークン余分にかかる。10,000行の表でも、コードで絞り込めば、モデルが見るのは5行で済む — [同上](https://www.anthropic.com/engineering/code-execution-with-mcp)
- 同記事の欠点: エージェントが書いたコードを動かすには、sandbox、資源の上限、監視のある安全な実行環境が要る。直接の tool call にはない運用の手間と、セキュリティの検討が増える — [同上](https://www.anthropic.com/engineering/code-execution-with-mcp)
- Anthropic「Advanced tool use」（2025-11-24、beta header `advanced-tool-use-2025-11-20`）の Programmatic Tool Calling: 複雑な調査の課題で、平均トークンが 43,588 → 27,297（−37%）。社内の知識検索の正解率は 25.6% → 28.5%、GIA は 46.5% → 51.2% — [Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use)
- 同記事: 経費の明細 約2,000件（記事の中で「50KB 以上」と「200KB」の両方の表記がある）が 1KB の結果に減った。使うべき場面は、要約だけが要る大きなデータ、3回以上の依存した呼び出し、結果の絞り込みや変換、多くの項目への並列の操作。使わない場面は、単発の簡単な呼び出し、途中の結果をすべてモデルが考える必要がある課題、応答が小さい短い調べもの — [同上](https://www.anthropic.com/engineering/advanced-tool-use)
- 同記事の Tool Search Tool: 58の tool（MCP サーバー5つ）で開始前に約55K トークン、ふつうの読み込みで約77K。Tool Search では合計約8.7K（−85%）。最初の固定費は約500トークン、見つけた tool 3〜5個で約3K。正解率は Opus 4 が 49% → 74%、Opus 4.5 が 79.5% → 88.1%。tool が10個未満、毎回使う tool、定義が小さい場合は勧めない。検索の分だけ遅くなる（数字はない） — [同上](https://www.anthropic.com/engineering/advanced-tool-use)
- Cloudflare「Code Mode」（2025-09-26）: MCP サーバーの schema を doc comment つきの TypeScript API に変え、モデルには「TypeScript を実行する」tool を1つだけ渡す。コードは V8 isolate で動かし、片ごとに新しい isolate を作って捨てる（数ミリ秒・数 MB で起動）。`fetch()` と `connect()` は例外を投げ、外のネットにはつながらない。MCP には binding で接続し、API キーは監督する側が持つので、生成したコードは鍵に触れない。出力は `console.log()` で返す — [Cloudflare Blog](https://blog.cloudflare.com/code-mode/)
- 同記事の主張: LLM は実際のコードを大量に見てきたが、tool call の特殊トークンは主に合成データから学んでいる。だから API をコードとして見せたほうが、大きく複雑な API も扱える。複数の段階を踏む課題では、途中の結果をモデルに通すのは次の呼び出しに写すためだけで無駄になる。ベンチマークやトークンの数字は記事にない — [同上](https://blog.cloudflare.com/code-mode/)
- CodeAct（Wang et al., ICML 2024）: 行動を JSON や文章ではなく、実行できる Python にする。17の LLM で、既存の形式より成功率が最大20%高い — [arXiv:2402.01030](https://arxiv.org/abs/2402.01030)
- CodeAct の M3ToolEval（82問、上限10往復）の平均往復数: gpt-4-1106-preview は CodeAct 5.5 対 JSON 7.6（約28%減）、gpt-3.5-turbo-0613 は 7.0 対 8.8（約20%減）、claude-2 は 7.2 対 8.3、Llama-2-70b-chat は 9.1 対 9.8。claude-instant-1 では逆に 8.8 対 8.6（Text）で増えた。成功率は gpt-4-1106-preview が 74.4 対 53.7（+20.7pt）、gpt-3.5-turbo-0613 が 51.2 対 26.8（+24.4pt）。claude-instant-1 は 20.7 対 31.7（−11.0pt）、lemur-70b は −2.5pt で、弱いモデルでは逆効果の例もある — [arXiv:2402.01030 HTML 版](https://arxiv.org/html/2402.01030v4)

### Inferences
- コードのエージェントのハーネスは、もともとシェル（bash）を持っている。モデルが `grep ... | head`、`for f in ...; do ...` のように1回のシェルで複数の操作をまとめれば、それ自体が小さな code mode になる。ja-harness で新しく足すとしたら、「tool の API をスクリプトから呼べる形で公開する」こと（例: MCP の tool を Node のスクリプトから呼べるようにする）になる。
- ローカルのハーネスでの sandbox の費用: Cloudflare の isolate はそのまま使えない。Node なら `node:vm` は安全な境界ではないので、`isolated-vm`、子プロセスと OS の制限（seccomp・bubblewrap・sandbox-exec）、コンテナなどが候補になる。どれを選んでも、ja-harness の「シェルはどのモードでも確認する」方針と組み合わせると、確認の単位がスクリプト1本になり、中身が長いと人が判断しにくくなる。
- PTC の効果が大きいのは、途中の結果が大きく、モデルが全部を見る必要のない場面（ログの集計、多数ファイルの一括処理）。ふつうのコード編集では、途中の結果（ファイルの中身）をモデルが読む必要があるので、効果は小さいと見込まれる。
- CodeAct の結果から、弱い・古いモデルでは逆効果もありうる。DeepSeek V4.1 Flash や Haiku で効くかは、自分で測る必要がある。

### Gaps
- PTC や code mode を SWE-bench のようなコードの課題で測り、往復・トークン・解決率を出した一次資料は見つからなかった。
- ローカルの sandbox（isolated-vm、bubblewrap など）の起動時間と運用の費用を、エージェントの用途で比べた資料は見つからなかった。
- Anthropic の PTC は Anthropic の API の機能で、DeepSeek や OpenAI 互換 API には同じ仕組みがない。ハーネス側で同じことをするときの効果は測られていない。

## Batch tools と、呼び出しを減らす tool の設計

### Takeaway
Anthropic の指針は、「数を少なく、1回でできることを多く」した tool を勧めている。いくつもの段階をまとめる、一覧ではなく検索を返す、出力の詳しさを選べるようにする、の3つ。複数ファイルの読み取りや複数の編集を1回の呼び出しでできる tool は、この考え方の具体例になる。ただし、batch の tool そのものの往復の削減を測った資料は見つからなかった。

### Cited Findings
- 段階のまとめ: `list_users`・`list_events`・`create_event` を別々にせず、空きを探して予定を入れる `schedule_event` 1つにする。`get_customer_context` は、関連する情報を1回で集める — [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- 一覧ではなく検索: `list_contacts` ではなく `search_contacts`、`read_logs` ではなく、関係する行と前後だけを返す `search_logs` — [同上](https://www.anthropic.com/engineering/writing-tools-for-agents)
- `response_format`（concise・detailed）: 例では detailed が206トークン、concise が72トークン。後の呼び出しに ID を渡す必要があるときは detailed が要る — [同上](https://www.anthropic.com/engineering/writing-tools-for-agents)
- 応答の大きさには、ページ分け、範囲の指定、絞り込み、切り詰めの既定値を設ける。Claude Code の tool の応答は既定で25,000トークンまで。切り詰めたときの通知とエラー文で、次にどう呼べばよいかを示す。重複した呼び出しが多ければ、ページ分けやトークンの上限を見直す合図になる — [同上](https://www.anthropic.com/engineering/writing-tools-for-agents)
- 関連する操作は、`action` の引数をとる1つの tool にまとめる（`create_pr`・`review_pr`・`merge_pr` を分けない）。tool の数が少ないと選び間違いが減る。応答には、次の判断に要るフィールドだけを入れる — [Anthropic Docs: Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- `input_examples` で、複雑な引数の正解率が 72% → 90%（社内の試験）。例1つあたり約20〜50トークン、入れ子の複雑な例で約100〜200トークン増える — [Anthropic: Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)、[Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- 失敗した編集は往復を増やす。SWE-agent（GPT-4 Turbo）では、2,294件の軌跡のうち1,185件（51.7%）に1回以上の失敗した編集があった。最終的に解決する確率は全体で90.5%だが、1回失敗した後は57.2%に下がる — [SWE-agent, arXiv:2405.15793](https://arxiv.org/pdf/2405.15793)（検索結果の抜粋からの数字。本文の図で確かめていない）

### Inferences
- ja-harness に入れる候補は次のとおり。`read` が複数のパス（と行の範囲）を受け取る。`edit` が1ファイルへの複数の置き換えを受け取る（Claude Code の MultiEdit と同じ考え方）。`grep` が一致した行の前後を返し、その後の read を省けるようにする。どれも1回の呼び出しで済む範囲を広げ、往復を減らす。
- 複数パスの read は出力が大きくなりやすい。ja-harness の「1件2,000トークンまで」の上限と、ファイルごとの上限の両方を決めておく必要がある。
- `edit` が失敗したときに、近い候補の行を返す（「old_str が見つからない。似た行: 42行目 …」）と、モデルがもう一度ファイルを読む往復を省ける。SWE-agent の数字は、失敗した編集が多く、その後の成功率が下がることを示している。

### Gaps
- 複数ファイルの read や MultiEdit で、往復やトークンがどれだけ減ったかを測った公開データは見つからなかった。
- `response_format` の206対72トークンは1つの例で、平均の削減率ではない。

## 自動の検証ループ：編集の後に lint・テストを自動で走らせるか、モデルに任せるか

### Takeaway
編集のたびにハーネスが lint を走らせ、エラーのある編集をはじく（SWE-agent の guardrail）と、解決率が上がった。外すと約3ポイント下がった。ただし、自動の検証で往復やトークンがどれだけ変わるかを直接測った資料は見つからなかった。

### Cited Findings
- SWE-agent は編集の処理に、大きなエラーを生まない変更だけを適用する介入（linter）を入れた。lint なしの版では解決率が下がった（抜粋では「without linting, 15.0% ↓ 3.0」。lint ありより3.0ポイント低い15.0%と読める） — [SWE-agent, arXiv:2405.15793](https://arxiv.org/pdf/2405.15793)（抜粋が崩れていたため、本文の Figure 6 で確かめていない）
- 同論文: 失敗した編集を1回でもした軌跡は51.7%。1回失敗すると、最終的な成功率が90.5%から57.2%に下がる — [同上](https://arxiv.org/pdf/2405.15793)
- 一般の指針として、tool のエラー文は次の試みで入力を直せる具体的な内容にする — [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)

### Inferences
- 往復の面で、自動の検証には2つの効果がある。（1）モデルが「lint を走らせる」tool call を出さなくてよくなり、1往復ぶん浮く。（2）結果を編集の tool_result にまとめて返せば、余分な往復なしにモデルが同じ turn で直せる。逆に、毎回の編集でテスト一式を走らせると、時間がかかり、出力も増える。lint と型チェックは編集のたびに、テストは関係するものだけか、モデルが終わりを宣言したときに、と分けるのが妥当と見込まれる。
- 返す結果は短くする（エラーの数、上位の数件、ファイルと行だけ）。ja-harness の「道具の結果は1件2,000トークンまで」の上限にも合う。
- SWE-agent のように「エラーを生む編集は適用しない」とすると、壊れたファイルを直すための往復を防げる。ただし、複数のファイルを順に直す途中で、一時的にエラーが出るのは正常なこともある。拒否ではなく警告にとどめる設定も要る。

### Gaps
- 自動の検証と、モデルが自分で決めて検証する場合とで、往復・トークン・解決率を比べた研究は見つからなかった。
- 編集のたびの lint の時間の費用（大きなリポジトリの tsc など）を測った資料はない。

## 先に計画する方式（plan-then-execute、ReWOO、LLMCompiler）と ReAct の比較

### Takeaway
計画を1回で立ててから tool を実行する方式は、ReAct（考える→呼ぶ→見る、を繰り返す）より、トークンと待ち時間が大きく減ったと報告されている。ReWOO はトークン効率5倍、LLMCompiler は費用が最大6.7分の1。ただし測ったのは QA の課題で、コードのエージェントの課題ではない。

### Cited Findings
- ReWOO（Xu et al., 2023）: 推論と観察を切り離し、計画を先に立てる。HotpotQA でトークン効率5倍、正解率+4%（絶対値か相対値かは要旨に書かれていない）。tool が失敗しても頑健だと主張している（数字はない） — [arXiv:2305.18323](https://arxiv.org/abs/2305.18323)
- LLMCompiler（Kim et al., 2023）: 依存関係のある関数呼び出しを DAG として計画し、並列に実行する。ReAct と比べて待ち時間が最大3.7倍速く、費用が最大6.7分の1、正解率が最大約9%向上 — [arXiv:2312.04511](https://arxiv.org/abs/2312.04511)
- ハーネスの設計の実証研究（arXiv:2609.20804）は、計画をなくすと SWE-bench の軌跡の長さが大きく変わることを見つけた（検索結果の要約から。本文は読んでいない） — [arXiv:2609.20804](https://arxiv.org/pdf/2609.20804)

### Inferences
- コードの作業は、観察してから次を決める部分が多い（テストの失敗を見て直す、など）。ReWOO のように全部を先に決める方式は、そのままでは合わない。現実的なのは、ja-harness の plan mode で「読むファイルと調べる場所」を先に列挙させ、それを並列の read でまとめて実行する、という LLMCompiler に近い使い方。
- plan mode は計画済みなので、ここでの論点は「計画の中の独立した手順を並列の tool call にまとめる」ことと、「計画の後は ReAct に戻す」ことの組み合わせになる。

### Gaps
- ReWOO・LLMCompiler をコードの課題（SWE-bench など）で測った結果は見つからなかった。
- ReWOO の全文の表（ReAct との往復数・トークンの比較の詳細）は読めていない。要旨の数字だけ。

## 早く止める・ループを見つける研究

### Takeaway
2026年の研究では、軌跡の途中で失敗を予測して止めたりやり直したりすると、実行トークンが約15〜20%減った。解決率が上がった例もある。主な危険は、成功するはずだった軌跡まで止めること。失敗する軌跡は成功する軌跡より長くなりやすいので、長さそのものも合図になる。

### Cited Findings
- Fail-Fast, Restart-Smart（Wang, Lyu, He, Yang, Zhong, Harel, Lo、2026-08-04）: 0.6B の monitor が、行動の途中までの列から失敗を予測する。SWE-bench Verified で、偽陽性の目標5%のとき実行トークンを14.6〜20.4%減らした（Qwen3.6-27B で学び、他の3つの policy に移しても効いた。そのうち1つは closed API のモデル）。Qwen3.6-27B で1歩ごとに判定する AgentStop の版は12.5%減。警報が出たら新しい rollout を始める RestartSmart（偽陽性の目標25%）で、解決率が66.6% → 71.8%（ただ最初からやり直す cold restart では66.8%） — [arXiv:2608.03222](https://arxiv.org/abs/2608.03222)
- Understanding Code Agent Behavior（arXiv:2511.00197）: 失敗した軌跡は成功した軌跡より長く、ばらつきも大きい（エージェントとベンチマークによって12.6〜82.5%長い）。早めに見張れば、見込みのない試みを見つけられると著者は述べている — [alphaXiv overview](https://www.alphaxiv.org/overview/2511.00197)（要約のページ。論文の本文は読んでいない）
- EET（Guo et al.、2026-04 改訂）: 似た過去の issue の経験と確信度を使って早く止める。SWE-bench Verified で費用を19〜55%減らし、解決率は約−0.2〜+7.8ポイント変化した — [個人ブログの解説](https://codex.danielvaughan.com/2026/06/21/early-termination-strategies-coding-agents-codex-cli-cost-efficiency-eet-agentstop-hooks/)（二次資料。原論文で確かめていない）
- NL2Repo-Bench の「early termination」は、100往復未満で「完了」と言ってしまう早すぎる終了を指し、ループとは別の失敗 — [arXiv:2512.12730](https://arxiv.org/pdf/2512.12730)

### Inferences
- ja-harness の repeat detection と30往復の上限は、ここでの「ルールによる停止」にあたる。学習した monitor（0.6B）を手元で動かすのは v0.1 には重い。代わりに、同じ tool と引数の繰り返し、同じファイルへの編集の失敗の繰り返し、往復の数が中央値を大きく超えた、などの安い合図で人に確認するのが現実的。
- 止めるより「やり直す」ほうが解決率を上げた（66.6% → 71.8%）。ただし、何も持たずにやり直す cold restart では上がらなかった（66.8%）。止めたときは、それまでに分かったこと（読んだファイル、失敗した方針）を短くまとめて次に渡すと、ja-harness の要約の仕組みも生かせる。
- 偽陽性の目標を上げる（5% → 25%）と、節約は増えても成功する軌跡を止める危険も増える。既定値は控えめにして、設定で変えられるようにすると、ja-harness の文脈管理の方針（値はすべて設定で変えられる）にも合う。

### Gaps
- Fail-Fast の偽陽性5%のときの解決率の変化、移した先の policy の名前は要旨に書かれていない。
- 2511.00197 の「30〜50%の節約」という数字は要約のサイトにしかなく、論文で確かめられなかった。
- 繰り返しの検出（同じ呼び出しが n 回続いたら止める、など）のルールを、往復とトークンで比べた研究は見つからなかった。FutureAGI などのベンダーのページには「繰り返しの編集のループが未解決の最大の原因」という主張があるが、根拠を確かめられないので使っていない。
