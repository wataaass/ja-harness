export const ja = {
  cost: (text: string) => `${text}ドル`,
  turnSummary: (tokens: string, cost: string, cache: number) =>
    `今回 ${tokens} トークン・${cost}・キャッシュ ${cache}%`,
  modelWithEffort: (model: string, effort: string) => `${model}（${effort}）`,

  greeting: {
    help: "/help で使い方",
    lastSession: (cost: string, cache: number) =>
      `前回のセッション ${cost}・キャッシュ ${cache}%`,
  },

  modes: {
    run: "Agent",
    plan: "Plan",
    ask: "Ask",
  },

  permissions: {
    ask: "確認する",
    "auto-edit": "編集は自動",
    "auto-all": "すべて自動",
  },

  settings: {
    broken: (path: string) =>
      `設定ファイルの ${path} が壊れています（JSON として読めません）`,
    shape: (path: string) => `設定ファイルの ${path} の形が正しくありません`,
    unreadable: (path: string) => `設定ファイルの ${path} を読めません`,
    unknown: (path: string, key: string) =>
      `設定ファイルの ${path} の ${key} は知らない設定です`,
    invalid: (path: string, key: string, allowed: string) =>
      `設定ファイルの ${path} の ${key} が正しくありません（${allowed} のどれか）`,
    notString: (path: string, key: string) =>
      `設定ファイルの ${path} の ${key} が文字列ではありません`,
    notObject: (path: string, key: string) =>
      `設定ファイルの ${path} の ${key} がオブジェクトではありません`,
  },

  status: {
    queued: (n: number) => `待ち ${n}件`,
    context: (percent: number) => `Context ${percent}%`,
    contextSmall: "Context <1%",
  },

  toolMarks: {
    read: "読",
    list: "覧",
    grep: "探",
    edit: "編",
    write: "作",
    shell: "実",
    plan: "計",
    submit_plan: "計",
    ask: "問",
  } as Record<string, string>,
  toolMarkFallback: "・",

  toolSummary: {
    plan: "Plan",
    declined: "却下",
    suffixStart: "（",
    partial: (applied: string, total: string) => `一部（${applied}/${total}）`,
    lines: (n: string) => `（${n}行）`,
    matches: (n: number) => `${n}件`,
    exit: (code: string) => `終了 ${code}`,
    replacements: (n: string) => `${n} か所`,
    writtenLines: (n: string) => `${n}行`,
  },

  session: {
    saveError: (message: string) => `セッションを保存できません: ${message}`,
    empty: "（空）",
    row: (date: string, text: string, cost: string, turns: number) =>
      `${date}  ${text}  ${cost}・${turns}件`,
  },

  commands: {
    help: "キーとコマンドの一覧",
    mode: "モードを選ぶ",
    permission: "Permission を選ぶ",
    model: "モデルと Effort を選ぶ",
    details: "途中経過の見せ方を切り替える",
    undo: "変更を戻す",
    resume: "前のセッションを続ける",
    clear: "会話を空にする",
    compact: "会話を要約して短くする",
    summarize: "/compact と同じ",
    context: "Context を見る",
  },

  helpLines: [
    " キー",
    "  Enter 送る  Shift+Enter 改行（使えない端末では Ctrl+J）  ↑↓ 前の入力",
    "  Shift+Tab モード  Ctrl+O 途中経過  Ctrl+R 変更の Review  Ctrl+C 入力を消す  Ctrl+D 2回で終了",
    "  Esc 止める・閉じる  Tab 候補を入れる",
    " コマンド",
    "  /help /mode /permission /model /details /undo /resume /clear /compact /summarize /context",
  ],

  app: {
    exitAgain: "もう一度 Ctrl+D で終了",
    thinking: "考えています…",
    duringWork: "（作業中に送信）",
    moreLines: (n: number) => `…ほか${n}行`,
    busy: " 作業が終わってから使えます",
    stopped: " 止めました",
    modelRow: (
      label: string,
      input: string,
      cached: string,
      output: string,
      jaCost: string,
    ) => `${label}   入${input} キ${cached} 出${output}   和1千字 $${jaCost}`,
    sessionNotFound: (id: string) => ` セッションが見つかりません: ${id}`,
    sessionLoadError: " セッションを読み込めません",
    sessionContinue: (turns: number) =>
      ` 続きから始めます（${turns}件のやりとり）。最初の1回はキャッシュが効きません`,
    modelChanged:
      " モデルを変えました。キャッシュが効かなくなるので、次の1回は料金が高くなります",
    autoAllWarning: "シェルのコマンドも確認せずに実行します。よろしいですか？",
    reviewEmpty: " 見直す変更がありません",
    undo: {
      none: " 戻す変更がありません",
      restored: (files: string, n: number) => ` 戻しました: ${files}（${n}件）`,
      shellNote: " （シェルで変えたファイルは戻りません）",
    },
    noPreviousSession: " 前のセッションがありません",
    cleared: " 会話を空にしました（前のものは /resume で続けられます）",
    unknownCommand: (command: string) => ` 知らないコマンドです: ${command}`,
    details: {
      on: "詳しく",
      off: "簡潔",
      changed: (label: string) => ` 途中経過: ${label}`,
    },
    compact: {
      done: (before: string, after: string) =>
        ` 要約しました: ${before} → ${after} トークン`,
      notNeeded: " まだ要約するほど長くありません",
    },
    contextView: {
      instructions: (n: string) => ` System prompt       ${n} トークン`,
      tools: (n: string) => ` Tools               ${n} トークン`,
      conversation: (n: string) => ` 会話                ${n} トークン`,
      results: (n: string) => ` Tool results        ${n} トークン`,
      total: (n: string, percent: number) =>
        ` 合計                ${n} トークン（上限の ${percent}%）`,
      saved: (n: string) => ` 切り詰め・要約で減らした分  ${n} トークン`,
      pricing: " セッションの料金（今のモデルの単価）",
      cachedInput: (n: string, cost: string) =>
        ` キャッシュに当たった入力  ${n} トークン  ${cost}`,
      uncachedInput: (n: string, cost: string) =>
        ` 当たらなかった入力        ${n} トークン  ${cost}`,
      output: (n: string, cost: string) =>
        ` 出力                      ${n} トークン  ${cost}`,
    },
    contextAction: (action: string, n: string) =>
      ` （Context: ${action} ${n} トークン減）`,
    contextPrune: "切り詰め",
    contextSummary: "要約",
    editPathSuffix: " を編集します",
    picker: {
      modeTitle: "モード",
      permissionTitle: "Permission",
      sessionTitle: "前のセッション",
      decideFooter: "Enter 決める  Esc やめる",
      sessionFooter: "↑↓ 選ぶ  Enter 決める  Esc やめる",
      effortLabel: "Effort",
      priceNote: "単価は $/100万トークン。入=入力 キ=キャッシュの読み 出=出力",
      modelTitle: "Model",
      modelFooter: "↑↓ モデル  ←→ Effort  Enter 決める  Esc やめる",
    },
    plan: {
      reasonTitle: "直す理由",
      reasonFooter: "Enter 決定  Esc 戻る",
      title: (path: string) => `Plan  ${path}`,
      footer: "Enter 承認して実行  e 直す  Esc 却下",
    },
    review: {
      inputTitle: "追加の指示",
      inputFooter: "Enter 送る  Esc 戻る",
      noChanges: "変更はありません",
      title: (path: string, index: number, total: number) =>
        `Review  ${path}  ${index}/${total}`,
      footer: "←→ ファイル  ↑↓ 読み進める  i 指示を書く  Esc 閉じる",
    },
    rejectReason: {
      title: "却下の理由",
      footer: "Enter 決定  Esc 戻る",
    },
    hunk: {
      title: (path: string, index: number, total: number) =>
        `Diff  ${path}  ${index}/${total}`,
      footer: "Enter 採用  Esc 却下  a このファイルは全部  e 理由を書く",
    },
    confirmFooter: "Enter 許可  Esc 却下  a 常に許可  e 理由を書く",
    contextTitle: "Context",
    contextFooter: "Enter か Esc で閉じる",
    permissionTitle: "Permission",
    warningFooter: "Enter はい  Esc やめる",
    tierWarning: (threshold: string, above: string, factor: string) =>
      ` Context が ${threshold} を超えました。${above} を超えると、次から単価が${factor}倍になります（/compact で短くできます）`,
  },
};
