# Enhance Examples Index

> Use this file to route from a user intent / capability cluster / fixture id to
> the canonical example file. When the user's intent matches multiple rows,
> prefer the example that covers the most clusters (more techniques to crib).

Each example is a complete, runnable Playwright TypeScript script faithfully
translated from `output/RPA/<id>.json` (Roxybrowser RPA DSL). They use
`chromium.connectOverCDP` / `chromium.connect` / `firefox.connect` (selected by
`BROWSER_TYPE` at runtime) and minimal env (`BROWSER_URL` preferred, `CDP_URL`
legacy fallback; the sandbox env whitelist is limited to `BROWSER_URL`/`CDP_URL`/`BROWSER_TYPE`/`SANDBOX_RUN_ID`/`SANDBOX_DIR_ID`). Business inputs (emails, thresholds, copy arrays, counts…) are passed through the script's `options` argument on `main(options)`, declared per-script via an `interface` and persisted as a JSON Schema.

The 18 capability clusters (C1-C18) are documented in
`output/RPA/rpa-test-case.md` § "用例分类与功能聚类". Three (C10 / C13 / C18)
have no canonical fixture yet — see `docs/harness/09-rpa-capability-gap.md`.

---

## Table 1 — User intent keyword → file

When you see these phrases in the user's recording-time messages, read the
matching file before writing.

| Keyword (中/英) | Example file | Cluster |
|----------------|-------------|--------|
| "视口内"、"viewport-closest"、"最近的可见 Like" | `facebook-02-viewport-aware-like.md` | C1 |
| "平滑滚动"、"模拟真人"、"wheel 事件" | `facebook-02-viewport-aware-like.md` | C2 |
| "backstep"、"往回滚一小段"、"懒加载" | `reddit-02-variable-driven-scroll.md` | C2 |
| "搜索"、"输入关键词"、"按 Enter" | `amazon-04-fallback-selector-hover.md` | C3 |
| "fallback selector"、"#X 不存在则 #Y" | `amazon-04-fallback-selector-hover.md` | C3 + C8 |
| "群组搜索"、"Facebook Groups"、"Join 按钮" | `facebook-03-language-and-groups-search.md` | C3 |
| "遍历推文"、"前 N 条点赞"、"第 N-M 条转推" | `twitter-03-index-segment-action.md` | C4 |
| "转推前 N 条"、"hover→click→下拉确认" | `twitter-02-retweet-with-confirm.md` | C4 + C12 |
| "发推"、"compose tweet"、"输入到 textbox" | `twitter-02-retweet-with-confirm.md` | C5 |
| "回复"、"评论 reply"、"对话框存在" | `twitter-04-dialog-or-inline-reply.md` | C5 + C9 |
| "导出 CSV"、"保存表格" | `facebook-05-network-monitor-csv.md` 或 `amazon-03-paginated-scrape.md` | C6 |
| "翻页累积"、"下一页"、".a-last a" | `amazon-03-paginated-scrape.md` | C6 + C14 |
| "登录态早退"、"未登录关闭浏览器"、"Logout" | `facebook-05-network-monitor-csv.md` | C7 |
| "邮箱已注册"、"early-exit on missing field" | `walmart-01-responsive-multi-exit.md` | C7 |
| "屏幕宽度"、"viewportSize"、"responsive"、"小屏 vs 大屏" | `walmart-01-responsive-multi-exit.md` | C8 |
| "对话框存在"、"dialog vs inline"、"二选一" | `twitter-04-dialog-or-inline-reply.md` | C9 |
| "切换语言"、"非英文则切英文"、"lang attribute" | `facebook-02-viewport-aware-like.md` 或 `facebook-03-language-and-groups-search.md` | C11 |
| "hover 序列"、"悬停后点击"、"转推下拉菜单" | `twitter-02-retweet-with-confirm.md` | C12 |
| "依次悬停 N 张图"、"image carousel hover" | `amazon-04-fallback-selector-hover.md` | C12 |
| "网络监听"、"graphql 监听"、"page.on response" | `facebook-05-network-monitor-csv.md` | C15 |
| "用变量 X"、"传入参数"、"options 入参" | `walmart-01-responsive-multi-exit.md` 或 `reddit-02-variable-driven-scroll.md` | C16 |
| "截图记录"、"留痕"、"deliverable screenshot" | `facebook-02-viewport-aware-like.md` | C17 |
| "重试"、"网络错误重试"、"backoff" | (no canonical fixture — see `docs/harness/09` C10) | C10 |
| "切 tab"、"切到含 URL 子串的 tab" | (no canonical fixture — see `docs/harness/10` MCP gap) | C13 |
| "返回上一页"、"goBack"、"navigate_back" | (rd-02 uses goBack, but C18 not its main pattern) | C18 |

## Table 2 — Capability cluster → file (inverse)

| Cluster | What it covers | Primary file | Also in |
|---------|---------------|-------------|--------|
| C1 视口感知 | viewport-closest element via getBoundingClientRect | `facebook-02-viewport-aware-like.md` | — |
| C2 滚动+概率循环 | humanScroll / wheel events / backstep | `facebook-02-viewport-aware-like.md` (no backstep) | `reddit-02-variable-driven-scroll.md` (with backstep) |
| C3 搜索引擎流 | search box + keyword + Enter | `amazon-04-fallback-selector-hover.md` | `facebook-03-language-and-groups-search.md`, `amazon-03-paginated-scrape.md` |
| C4 信息流批量互动 | iterate articles + per-index action | `twitter-03-index-segment-action.md` | `twitter-02-retweet-with-confirm.md` |
| C5 UGC 发帖/评论 | composer + type + submit | `twitter-02-retweet-with-confirm.md` | `twitter-04-dialog-or-inline-reply.md` |
| C6 数据采集 + 持久化 | extract DOM fields + write file | `amazon-03-paginated-scrape.md` | `facebook-05-network-monitor-csv.md` |
| C7 状态早退 | detect → log → close → return | `facebook-05-network-monitor-csv.md` (login form) | `walmart-01-responsive-multi-exit.md` (3 exits) |
| C8 响应式分支 | window.innerWidth → 大/小屏路径 | `walmart-01-responsive-multi-exit.md` | `amazon-04-fallback-selector-hover.md` (selector fallback) |
| C9 二选一 / 竞争 | dialog.count() ? path1 : path2 | `twitter-04-dialog-or-inline-reply.md` | — |
| C10 重试 + 错误处理 | for + try/catch + backoff | (gap) | `docs/harness/09` |
| C11 语言切换 | lang attribute → settings flow | `facebook-02-viewport-aware-like.md` | `facebook-03-language-and-groups-search.md` |
| C12 hover 序列 | hover → wait_for menu → click | `twitter-02-retweet-with-confirm.md` | `twitter-04-dialog-or-inline-reply.md`, `amazon-04-fallback-selector-hover.md` |
| C13 多 tab 切换 | (gap — MCP tool needed) | — | `docs/harness/10` |
| C14 翻页累积 | "next" link + break on missing | `amazon-03-paginated-scrape.md` | — |
| C15 网络监听 | page.on('response') + parse | `facebook-05-network-monitor-csv.md` | — |
| C16 变量注入 | `main(options)` / interface / JSON Schema | `walmart-01-responsive-multi-exit.md` (email/password) | `reddit-02-variable-driven-scroll.md` (commentThreshold/rounds) |
| C17 业务留痕截图 | screenshot as deliverable | `facebook-02-viewport-aware-like.md` | `twitter-04-dialog-or-inline-reply.md`, `walmart-01-responsive-multi-exit.md` |
| C18 history 返回 | goBack / navigate_back | (gap, partial in rd-02) | `docs/harness/09` |

## Table 3 — Fixture id → file + clusters

| id | File | Clusters | `options` input (beyond BROWSER_URL/CDP_URL) |
|----|------|---------|------------------------------|
| fb-02 | `facebook-02-viewport-aware-like.md` | C1 + C2 + C5 + C11 + C17 | — |
| fb-03 | `facebook-03-language-and-groups-search.md` | C3 + C11 | — |
| fb-05 | `facebook-05-network-monitor-csv.md` | C6 + C7 + C15 | — |
| x-02 | `twitter-02-retweet-with-confirm.md` | C4 + C5 + C12 | `tweets?: string[]` (optional, defaults to built-in copy) |
| x-03 | `twitter-03-index-segment-action.md` | C4 | — |
| x-04 | `twitter-04-dialog-or-inline-reply.md` | C5 + C9 + C12 | — |
| amz-03 | `amazon-03-paginated-scrape.md` | C3 + C6 + C14 | — |
| amz-04 | `amazon-04-fallback-selector-hover.md` | C3 + C8 + C12 | — |
| wm-01 | `walmart-01-responsive-multi-exit.md` | C7 + C8 + C16 | `email` (always) + `password?` (sign-up branch) |
| rd-02 | `reddit-02-variable-driven-scroll.md` | C2 + C16 | `commentThreshold?`, `rounds?` (default 100/3) |

---

## Routing precedence (when user intent matches multiple rows)

1. **Most specific cluster wins** — if user mentions "viewport-closest" AND "70% probability", pick `fb-02` because it covers both.
2. **Look at "Also in" column for inspiration** — sometimes a primary file has the *most* of the pattern but a secondary file shows a *variant* technique you also need.
3. **Multi-cluster intents** combine techniques across files — read the primary file, then crib the missing technique from a secondary file. Don't try to stuff all 5 fixture patterns into one read.

## How an enhance subagent uses this

```
1. Read SKILL.md (always first).
2. Match user intent to a row in SKILL.md's Quick Decision Matrix.
3. If unambiguous → read that one example file and adapt.
4. If ambiguous / multi-cluster → read THIS file, walk the 3 tables, decide
   which 1-2 example files cover the most patterns.
5. Read those file(s).
6. Write the enhanced script — adapt selectors / loop counts / probabilities
   to the user's specific intent. Selectors from the recorded skeleton ALWAYS
   override selectors from the example.
```
