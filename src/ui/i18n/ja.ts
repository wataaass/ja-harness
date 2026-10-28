export const ja = {
  cost: (text: string) => `$${text}`,
  turnSummary: (tokens: string, cost: string, cache: number) =>
    `${tokens} tokens · ${cost} · cache ${cache}%`,
  modelWithEffort: (model: string, effort: string) => `${model}（${effort}）`,

  greeting: {
    help: "/help for help",
    lastSession: (cost: string, cache: number) =>
      `Last session ${cost} · cache ${cache}%`,
  },

  instructions: (labels: string) => ` Instructions: ${labels}`,
  instructionsTruncated: " 決まりのファイルが長いので、12,000字で切りました",
  skills: (on: number, off: number) => ` Skills: ${on} on, ${off} off`,
  mcpInvalidName: (name: string) =>
    `MCP サーバー名 ${name} は使えません（英数字・-・_ だけ）`,

  modes: {
    run: "Agent",
    plan: "Plan",
    ask: "Ask",
  },

  permissions: {
    ask: "Confirm",
    "auto-edit": "Auto-edit",
    "auto-all": "Auto",
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
    notStringArray: (path: string, key: string) =>
      `設定ファイルの ${path} の ${key} が文字列の配列ではありません`,
    brokenSave:
      "設定ファイルが壊れているので保存しません（JSON として読めません）",
    shapeSave: "設定ファイルの形が正しくないので保存しません",
  },

  status: {
    queued: (n: number) => `Queued ${n}`,
    context: (percent: number) => `Context ${percent}%`,
    contextSmall: "Context <1%",
  },

  toolMarks: {
    read: "Read",
    list: "List",
    grep: "Grep",
    edit: "Edit",
    write: "Write",
    shell: "Shell",
    plan: "Plan",
    submit_plan: "Plan",
    ask: "Ask",
  } as Record<string, string>,
  toolMarkFallback: "Tool",

  toolSummary: {
    plan: "Plan",
    declined: "Rejected",
    suffixStart: " (",
    partial: (applied: string, total: string) =>
      `Partial (${applied}/${total})`,
    lines: (n: string) => `(${n} lines)`,
    matches: (n: number) => `${n} matches`,
    exit: (code: string) => `exit ${code}`,
    replacements: (n: string) => `${n} replaced`,
    writtenLines: (n: string) => `${n} lines`,
  },

  session: {
    saveError: (message: string) => `セッションを保存できません: ${message}`,
    empty: "(empty)",
    row: (date: string, text: string, cost: string, turns: number) =>
      `${date}  ${text}  ${cost} · ${turns} turns`,
  },

  helpLines: (enter?: "send" | "newline"): string[] => [
    " Keys",
    enter === "newline"
      ? "  Enter newline (Enter on an empty line sends)  Shift+Enter/Ctrl+J send  ↑↓ history"
      : "  Enter send  Shift+Enter newline (Ctrl+J if unsupported)  ↑↓ history",
    "  Shift+Tab mode  Ctrl+O details  Ctrl+R review  Ctrl+C clear input  Ctrl+D twice to exit",
    "  Esc stop/close  Tab complete",
    " Commands",
    "  /help /mode /permission /model /details /undo /resume /skills /clear /compact /summarize /context",
  ],

  app: {
    exitAgain: "Press Ctrl+D again to exit",
    thinking: "Thinking…",
    duringWork: "(sent while working)",
    moreLines: (n: number) => `…${n} more lines`,
    busy: " Available after the current task",
    stopped: " Stopped",
    modelRow: (label: string, input: string, cached: string, output: string) =>
      `${label}   in $${input}  cache $${cached}  out $${output}`,
    sessionNotFound: (id: string) => ` Session not found: ${id}`,
    sessionLoadError: " Could not load the session",
    sessionContinue: (turns: number) =>
      ` 続きから始めます（${turns}件のやりとり）。最初の1回はキャッシュが効きません`,
    modelChanged:
      " モデルを変えました。キャッシュが効かなくなるので、次の1回は料金が高くなります",
    autoAllWarning: "シェルのコマンドも確認せずに実行します。よろしいですか？",
    reviewEmpty: " No changes to review",
    undo: {
      none: " Nothing to undo",
      restored: (files: string, n: number) => ` Restored: ${files} (${n})`,
      shellNote: " （シェルで変えたファイルは戻りません）",
    },
    noPreviousSession: " No previous session",
    cleared: " 会話を空にしました（前のものは /resume で続けられます）",
    unknownCommand: (command: string) => ` Unknown command: ${command}`,
    details: {
      on: "verbose",
      off: "brief",
      changed: (label: string) => ` Details: ${label}`,
    },
    compact: {
      done: (before: string, after: string) =>
        ` Compacted: ${before} → ${after} tokens`,
      notNeeded: " Not long enough to compact yet",
    },
    contextView: {
      instructions: (n: string) => ` System prompt       ${n} tokens`,
      tools: (n: string) => ` Tools               ${n} tokens`,
      conversation: (n: string) => ` Conversation        ${n} tokens`,
      results: (n: string) => ` Tool results        ${n} tokens`,
      total: (n: string, percent: number) =>
        ` Total               ${n} tokens (${percent}% of limit)`,
      saved: (n: string) => ` Saved by pruning/summary  ${n} tokens`,
      pricing: " Session cost (current model prices)",
      cachedInput: (n: string, cost: string) =>
        ` Cached input                ${n} tokens  ${cost}`,
      uncachedInput: (n: string, cost: string) =>
        ` Uncached input              ${n} tokens  ${cost}`,
      output: (n: string, cost: string) =>
        ` Output                      ${n} tokens  ${cost}`,
    },
    contextAction: (action: string, n: string) =>
      ` (Context: ${action} -${n} tokens)`,
    contextPrune: "pruned",
    contextSummary: "summarized",
    editPathPrefix: "Edit ",
    picker: {
      modeTitle: "Mode",
      permissionTitle: "Permission",
      sessionTitle: "Sessions",
      decideFooter: "Enter select  Esc cancel",
      sessionFooter: "↑↓ move  Enter select  Esc cancel",
      effortLabel: "Effort",
      modelTitle: "Model",
      modelFooter: "↑↓ model  ←→ effort  Enter select  Esc cancel",
      skillsTitle: "Skills",
      skillsFooter: "↑↓ move  Space toggle  Enter save  Esc cancel",
      skillsRow: (mark: string, name: string, source: string, tokens: string) =>
        `${mark} ${name}  ${source}  ~${tokens} tokens`,
      skillsSaved: " 保存しました。次の /clear か起動から効きます",
    },
    skillsInstall: {
      title: "Install skills",
      footer: "Enter install  Esc cancel",
      row: (name: string, description: string, replace: boolean) =>
        `${name} — ${description}${replace ? " (replace)" : ""}`,
      installed: (names: string) =>
        ` 入れました: ${names}。次の /clear か起動から使えます`,
      notFound: " SKILL.md が見つかりません",
      noSource:
        " /skills add のあとに GitHub の URL かフォルダのパスを書いてください",
      noGit: " git がないのでスキルを入れられません",
      cloneFailed: (message: string) => ` git clone に失敗しました: ${message}`,
      copyFailed: (message: string) =>
        ` スキルをコピーできませんでした: ${message}`,
    },
    plan: {
      reasonTitle: "What to change",
      reasonFooter: "Enter submit  Esc back",
      title: (path: string) => `Plan  ${path}`,
      footer: "Enter approve & run  e revise  Esc reject",
    },
    review: {
      inputTitle: "More instructions",
      inputFooter: "Enter send  Esc back",
      noChanges: "No changes",
      title: (path: string, index: number, total: number) =>
        `Review  ${path}  ${index}/${total}`,
      footer: "←→ file  ↑↓ scroll  i instruct  Esc close",
    },
    rejectReason: {
      title: "Why reject",
      footer: "Enter submit  Esc back",
    },
    hunk: {
      title: (path: string, index: number, total: number) =>
        `Diff  ${path}  ${index}/${total}`,
      footer: "Enter accept  Esc reject  a whole file  e give reason",
    },
    confirmFooter: "Enter allow  Esc reject  a always allow  e give reason",
    contextTitle: "Context",
    contextFooter: "Enter or Esc to close",
    permissionTitle: "Permission",
    warningFooter: "Enter yes  Esc cancel",
    tierWarning: (threshold: string, above: string, factor: string) =>
      ` Context が ${threshold} を超えました。${above} を超えると、次から単価が${factor}倍になります（/compact で短くできます）`,
  },
};
