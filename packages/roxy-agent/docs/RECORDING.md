# roxy-agent 自动化脚本录制技术方案

## §1 文档定位

本文给出 `roxy-agent` 的 Playwright Recording 技术方案：让用户在正常使用网页自动化 agent 完成任务时，把真实浏览器操作沉淀成可复用、回放时不依赖 AI 的 TypeScript RPA 脚本。

本文重点回答四件事：

1. 录制如何承接 `roxy-agent` 的跨轮次会话、后台处理和脚本回放。
2. 第一版如何先覆盖单窗口、线性浏览器自动化场景。
3. 停止录制后如何用一个综合的 agentic enhancement 阶段，把原始操作整理成稳定 locator、RPA 控制流和可调 config。
4. 生成脚本应运行在怎样的 sandbox runtime 中，以及测试阶段和实际运行阶段如何共用同一套能力边界。

多窗口并行、`parallel_dispatch` worker 回放和多 `dirId` 并发连接暂不进入第一版主路径，保留在本文尾部作为后续扩展设计。

## §2 外部产品调研与设计评估

调研结论：浏览器录制产品大致分为两类。一类是传统 recorder，重点是把真实操作转换成可编辑脚本或工作流；另一类是 AI 浏览器 agent，重点是在运行时用模型适配页面变化。`roxy-agent` recording 更适合走中间路线：录制真实事实，停止后用 AI 增强脚本，回放时仍然保持无 AI、可审计、可复现。

### §2.1 同类产品观察

- [Playwright Test Generator](https://playwright.dev/docs/codegen) 会在用户操作浏览器时生成测试代码，并优先生成 role、text、test id 等 locator；官方也强调生成后可以人工检查和改进。
- [Chrome DevTools Recorder](https://developer.chrome.com/docs/devtools/recorder/overview) 支持录制、回放、编辑、调试 user flow，并导出 JSON 或 Puppeteer 格式。
- [Selenium IDE](https://www.selenium.dev/selenium-ide/) 是 record-and-playback 工具，特点是为同一个元素记录多个 locator，回放时一个失败再尝试另一个。
- [Automa](https://extension.automa.site/) 把录制动作变成可视化 workflow block，适合低代码自动化、触发器、日志和数据导出。
- [Stagehand](https://www.browserbase.com/stagehand/) 与 Browserbase 更偏 AI runtime：用 `act`、`extract`、`observe`、`agent` 等原语让脚本在运行时通过自然语言适配页面变化。
- [Browser Use Cloud](https://docs.browser-use.com/cloud/quickstart) 把 Agent、Browser、Profile、recording 等作为云端能力组合，优势是托管浏览器与运行时 agent，代价是回放仍更接近在线 agent 执行。

### §2.2 对当前方案的评估

当前方案里最值得保留的判断有六个：

1. 脚本来源必须是已经真实执行过的 `browser_*` 操作，而不是模型的自然语言计划。
2. 回放时不再运行 agent，不再调用 LLM，只运行可审计的 Playwright/RoxyBrowser 脚本。
3. 浏览器目标应保存 `dirId`，回放时重新打开 RoxyBrowser 窗口获取新鲜 CDP `ws`，而不是把一次性 CDP URL 写进脚本。
4. 录制期间只收集事实，停止录制后集中增强，避免每一步都调用模型造成成本和不确定性。
5. 脚本绑定 sandbox 运行时而不是标准 Playwright 契约（理由详见 §14）。
6. Enhancement 引入测试运行器，实现”生成候选脚本 → 真实执行 → 读取结果 → 修正”的闭环。这是与 browser-use Code Mode、Stagehand 等产品差距最大的部分——它们生成脚本后没有测试反馈，或依赖运行时自愈，而非编译期验证。

需要调整的地方：

1. 第一版不应把多窗口并行作为主路径。`parallel_dispatch` 涉及 worker 子进程、IPC 汇流、并行块语义和多 `dirId` 映射，会显著放大落地复杂度。它应该后置，而不是阻塞单窗口录制。
2. **`refine` 与 `enhance` 应两步分离，不合并**（与旧版”合并为 Agentic Enhancement”相反）。两个任务的信息结构根本不同：Refine 的核心输入是每个 click 的 DOM context（局部、逐行独立），Enhance 的核心输入是整段脚本 + 用户消息（全局意图）。合并后 DOM context 作为噪声进入 Enhance 推理空间，”减少一次会话”是幻觉——合并后 Enhance 的 prompt 更大，单次调用反而更贵。Refine 输出完整修正后脚本，Enhance 只接收该脚本和用户消息，不含 DOM context，上下文反而缩小 30-40%。Refine 保持单次 LLM 会话；Enhance 升级为完整 agent 运行（多轮，带工具），以支持与测试运行器的交互闭环。
3. 外部传统 recorder 的共同经验是”录制结果通常需要编辑”；AI runtime 产品的共同经验是”运行时适配强但成本和不确定性更高”。因此 `roxy-agent` 应把 AI 用在停止后的脚本生成质量上，而不是放进每次回放路径。

## §3 核心结论

基本判断：第一版 recording 先支持单窗口、线性浏览器自动化，把用户已完成的一段 agent 操作变成一个可复用 TypeScript 脚本。

推荐方案：

1. 显式开始录制
   - 由 agent 侧控制录制生命周期，未来前端仅需向用户展示开始和结束入口，以及“正在录制”的状态。

2. 正常使用 agent 执行任务
   - 用户继续按当前方式和 `roxy-agent` 对话。
   - 录制器在后台累计用户意图和真实 `browser_*` 操作。
   - 录制操作跨对话轮次，记录多轮对话下的所有浏览器操作。
   - 第一版只接收主会话单窗口线性操作；遇到 `parallel_dispatch` 或多窗口并行时，应提示暂不支持或只记录为不可生成脚本的诊断事件。

3. 停止录制后后台整理脚本
   - 用户手动停止。
   - 确定性转换先把操作日志生成 raw skeleton。
   - **Refine**（单次 LLM 会话）：处理 locator 稳定化。输入是每个 `browser_click` 执行前采集的 DOM context（祖先链、testAttrs、ariaLabel、outerHTML），识别并替换 UNSTABLE locator，输出完整修正后脚本。有效覆盖范围当前限于 `browser_click`；`browser_type` 等工具的扩展覆盖作为后续改进独立处理。
   - **Enhance**（完整 agent 运行，多轮带工具）：接收 Refine 产出的脚本和会话用户消息，负责全局控制流补充（循环、分页、条件、批量）、config 上提、`report()` 生成，以及与测试运行器的交互闭环。Enhance 挂只读文件工具和 `test_script` 工具，不挂会改变页面状态的浏览器工具。
   - 最后经过 validate / repair，产出一个可复用的 TypeScript 自动化脚本。

4. 脚本回放不依赖 AI
   - 脚本按 `dirId` 打开并连接 RoxyBrowser 窗口。
   - 回放时只执行 Playwright/RoxyBrowser 自动化动作，不启动 chat agent、worker subagent 或 LLM。

### §3.1 关键设计决策

以下决策是后续所有章节的前提：

1. 浏览器目标用 RoxyBrowser 窗口标识 `dirId`，不用一次性 CDP URL。
   - RoxyBrowser 的窗口/分身本质是一套启动参数集（代理、指纹、UA、cookie 等），其持久标识是 `dirId`。
   - `roxy_open_browsers([dirId])` 每次打开都返回临时 CDP `ws`。端口与 GUID 随实例消亡，因此只适合作为运行期连接信息，不适合作为脚本产物。
   - 录制只保存 `dirId`；回放时按 `dirId` 重新打开拿到新鲜 `ws` 再连接。

2. 第一版按单窗口线性脚本落地。
   - 主 agent 自己执行的浏览器操作按发生顺序转换为脚本步骤。
   - `parallel_dispatch`、worker 子进程、多窗口并行回放暂不进入主链路。
   - 多窗口并行的采集与回放设计保留在 §12。

3. 停止后分两步整理脚本，两步保持分离。
   - **Refine**（单次 LLM 会话）：局部 locator 稳定化。输入是每个 `browser_click` 执行前采集的 DOM context（祖先链、testAttrs、ariaLabel、outerHTML）。识别 UNSTABLE locator，按优先级替换，输出完整修正后脚本。任务逐行独立，不需要全局意图，也不需要多轮推理，单次调用够用。当前有效覆盖范围仅限于 `browser_click`（其他工具的 DOM context 尚未在 `on_tool_start` 采集）；扩展覆盖作为后续改进独立处理。
   - **Enhance**（完整 agent 运行，多轮带工具）：全局控制流优化。接收 Refine 产出脚本和会话用户消息（不含 DOM context），负责循环/分页/条件/批量控制流、config 上提、`report()` 生成，以及与测试运行器的多轮交互闭环。挂只读工具（`read_file`、RPA skill 文档）和 `test_script`，不挂会改变页面状态的浏览器工具。
   - 两步分离的原因：Refine 的输入是局部 DOM context，合并后该 context 作为噪声进入 Enhance 推理空间，合并后 Enhance 的 prompt 更大，并非更优；Enhance 需要与测试运行器多轮交互，单次会话根本做不到。
   - 合并后 validate / repair 职责更清晰：validate 只做确定性检查（语法、结构、sandbox 契约、安全约束）；脚本运行测试由 Enhance agent 内部驱动；repair 只修结构问题；业务层修正由 Enhance 完成。

4. v1 不做混淆，最终产物是 TypeScript 脚本（`.ts`）。
   - 脚本可被 `run_script` sandbox 直接执行。
   - sandbox 用 Node.js 原生 `stripTypeScriptTypes` 剥离类型后执行，无需预编译。

5. v1 不做运行时自愈。
   - 回放失败应暴露明确错误和步骤报告。
   - 为后续自愈预留 internal trace、step intent 和稳定锚点。

## §4 设计原则

录制链路：

```text
开始录制
  -> 在 Playwright MCP 工具层捕获 browser_* 操作（跨轮次，v1 仅主会话单窗口）
  -> 记录用户消息、工具输入、工具结果、点击 DOM 上下文
  -> 停止录制
  -> 确定性转换为 raw skeleton
  -> Refine（单次 LLM 会话，locator 稳定化，当前覆盖 browser_click）
  -> Enhance（完整 agent 运行，多轮带工具：RPA 控制流 + config 上提 + 测试反馈闭环）
  -> validate / repair
  -> 最终产物：可复用 TypeScript 脚本
```

这条链路遵循四个设计原则：

1. 记录真实的浏览器操作执行。
   - agent 的推理计划可能变化、撤销或失败。
   - 浏览器工具调用才代表实际发生过的页面行为。

2. 录制期间只收集事实。
   - 开始到停止之间主要保存操作、结果、快照和用户意图。
   - 不在每一步都让模型改写脚本，减少噪声和成本。

3. 停止后分两步集中整理。
   - raw skeleton 先由确定性转换产生。
   - **Refine**（单次 LLM 会话）：局部 locator 稳定化，逐行独立判断，无需多轮推理。
   - **Enhance**（完整 agent 运行，多轮带工具）：全局控制流优化、变量上提、候选脚本测试反馈修正。Enhance 接收 Refine 的产出脚本，不再包含 DOM context，上下文反而缩小。
   - 集中整理失败时直接暴露错误，不静默产出半成品。

4. 运行脚本时不再依赖 AI。
   - 保存后的脚本直接连接目标 RoxyBrowser 窗口执行。
   - agent 后续可以负责选择和启动脚本，但不重新推理每一个浏览器动作。

## §5 关键设计选择

`roxy-agent` 的运行形态是 HTTP/SSE 长会话服务。第一版 recording 先围绕 simple / 主会话单窗口路径落地。

### §5.1 录制生命周期由后端 API 管理

录制生命周期暴露为后端能力：

- `start`：为某个 conversation 创建 active recording。
- `stop`：冻结本次 recording 并启动后台处理。
- `status`：查询处理阶段、错误和最终 artifact。
- `cancel` / `resume`：用于长流程中断或失败后的恢复。

前端是否做按钮、进度面板或脚本库入口，不属于第一版 recording 后端方案的必要条件。

### §5.2 录制范围绑定跨轮次 conversation

`roxy-agent` 的用户任务可能跨多次 `/chat` 请求完成，因此 recording session 绑定一整个会话，而不是绑定单个轮次或用户消息。只要当前会话仍处于录制状态：

- 每轮用户消息都追加为意图上下文。
- 每轮 agent 调用 Playwright MCP 的真实浏览器动作都追加到事件日志。
- 停止录制时一次性整理整个会话中被录制的网页操作。

这样用户可以像平时一样分多轮补充指令，例如“先打开页面”“再搜索这个关键词”“把前 5 条结果逐个处理”，最终仍能生成一个完整脚本。

### §5.3 在 Playwright MCP 工具层捕获

录制不从 SSE/stream 事件观察，而是在 Playwright MCP 工具包装层记录操作。原因：

- 工具层最接近真实副作用，能记录调用前输入、调用后结果和错误。
- 点击前 DOM 上下文需要在真实点击发生前捕获，SSE 事件通常已经太晚。
- 后续扩展到 worker 子进程时，工具层也是唯一能稳定拿到 worker 内部浏览器操作事实的位置。

第一版只记录主会话 Playwright 工具。遇到 worker 内部工具调用时，可以先写入诊断事件，但不进入最终脚本生成。

### §5.4 单窗口优先

第一版的可生成脚本范围限定为一个 RoxyBrowser 窗口：

- 一个 recording 对应一个主要 `dirId`。
- 允许同一 conversation 多轮操作同一个窗口。
- 如果同一 recording 中出现多个 `dirId`，应在 stop 阶段把状态置为 `needs_manual_review` 或 `unsupported_multi_target`，并提示用户拆成多个单窗口录制。
- 如果用户任务触发 `parallel_dispatch`，第一版不把它转换成脚本并行块。

这个边界能让第一版先打通从事实采集、脚本生成、agentic enhancement 到 sandbox 回放的闭环。

## §6 用户流程

第一版可以按如下方式理解用户体验。

### §6.1 开始录制

- 用户在某个网页自动化 agent 会话中点击“开始录制”。
- 系统创建一个 recording session，并把它与当前 agent conversation 绑定。
- 系统记录当前主窗口的 `dirId`，作为本次脚本的目标窗口。

### §6.2 正常下达网页自动化任务

- 用户继续自然语言对话，agent 持续调用 Playwright MCP 操作浏览器。
- 录制器在后台保存三类信息：
  - 操作事实：实际执行过的 `browser_*` 工具调用。
  - 辅助上下文：工具结果、ARIA ref、点击前 DOM 上下文、失败信息。
  - 意图上下文：录制期间用户发出的自然语言消息。
- 普通文本回答、thinking、OpenAPI 管理工具和纯验证动作不直接变成脚本步骤。
- 如果出现多窗口或并行 worker，第一版应尽早提示“本次录制包含暂不支持的并行 / 多窗口操作”，避免 stop 后才给用户失败。

### §6.3 停止录制

- 用户停止录制后，系统不再接受新事件，并启动后台处理。
- 处理过程分为三类：
  - 确定性阶段：冻结事件、生成 raw skeleton。
  - 模型阶段：**Refine**（单次 LLM 会话）做 locator 稳定化，产出修正后脚本；**Enhance**（完整 agent 运行）做全局控制流优化，按需在选中 `dirId` 窗口运行测试，并根据被动观测结果继续修正。
  - 校验阶段：validate / repair，检查语法、结构、sandbox 契约和安全约束。
- 调用方可以轮询 status，直到 recording 进入 `done` 或 `failed`。

### §6.4 复用脚本

- 最终产物是一个 TypeScript 脚本。它应能进入现有 `run_script` 执行链路，自动开启对应的用户浏览器窗口并回放操作。
- 用户后续复用脚本时，agent 可以只负责选择和启动脚本；具体页面操作由脚本自己完成。
- 如果脚本执行失败，应返回清晰的失败步骤、错误信息和 `report()` 摘要，而不是让 agent 自动“手动补跑”。

## §7 两步增强工作机制

停止录制后，确定性转换产出一份”照着录制原样复刻”的 raw skeleton：locator 可能依赖动态文案，动作只执行了一次代表性样本，没有循环和判断。把它变成真正可复用的 RPA 脚本，经过两步顺序执行的增强阶段。

### §7.0 两步架构概述

```text
raw skeleton
  → Refine（单次 LLM 会话）
      输入：raw skeleton + 每个 browser_click 的 DOM context
      职责：locator 稳定化（逐行独立判断）
      输出：locator 修正后的完整脚本
  → Enhance（完整 agent 运行，多轮带工具）
      输入：Refine 产出脚本 + 会话用户消息（不含 DOM context）
      职责：全局控制流 + config 上提 + 测试反馈闭环
      输出：{ enhancedScript, summary }
  → validate / repair
```

**为什么不合并**：两个任务的信息结构根本不同。Refine 的核心输入是每个 click 的 DOM context（局部、逐行独立，4K token 够用）；Enhance 的核心输入是整段脚本 + 用户消息（全局意图，8K+ 才稳定）。合并后 DOM context 作为噪声进入 Enhance 推理空间，”减少一次会话”是幻觉——合并后 prompt 更大，反而更贵。Refine 完成后其 DOM context 被丢弃，Enhance 只接收修正后脚本，上下文缩小 30-40%。Enhance 还需要与测试运行器多轮交互，单次会话根本做不到。

### §7.1 Refine：Locator 稳定化（单次 LLM 会话）

**职责**：识别并替换不稳定的 locator，输出完整修正后脚本。

**工作方式**：无工具的单次 LLM 调用，不启动完整 agent 运行，不需要多轮推理。任务逐行独立：判断每个 locator 是否 UNSTABLE，如果是，从 DOM context 按优先级选替代方案。

**输入**：raw skeleton + 每个 `browser_click` 执行前采集的 DOM context。

**输出**：locator 修正后的完整 TypeScript 脚本（交给 Enhance）。

### §7.2 Enhance：控制流优化与测试反馈闭环（完整 agent 运行）

**职责**：全局意图理解、RPA 控制流补充（循环/分页/条件/批量）、config 上提、`report()` 生成，以及与测试运行器的多轮交互闭环。

**工作方式**：完整 agent 运行，多轮，带工具。Enhance 不挂会改变页面状态的浏览器工具，也不能直接调用 click、type、navigate 等操作；只能通过 `test_script` 工具运行完整候选脚本来间接操作浏览器。

**约束**：Enhance agent 不挂会改变页面状态的工具；只能通过 `test_script` 运行完整候选脚本来间接操作浏览器；只读观察工具只用于观察，不能替代脚本执行。

以下各点为 Enhance 阶段的具体设计细节：

1. 临时工作目录
   - 为每次 enhancement 创建临时目录，如 `<CHECKPOINT_DIR>/recordings/<id>/enhancement-workspace/`。
   - 目录内包含 Refine 产出脚本、压缩后的录制上下文、用户消息、RPA pattern 文档和 agent 中间草稿。
   - 路径必须做 rootDir 隔离和路径遍历检测。
 
2. 只读文件系统工具
   - 提供 `ls`、`read_file`、`glob`、`grep` 四个只读工具，以及 `write_file`、`edit_file` 用于修改临时脚本文件。所有路径限定在临时工作目录。
   - 不提供 `execute`。

3. Skill / pattern 资料
   - 可以加载 RPA enhancement 相关 skill 或参考文档，作为只读资料。
   - 不自动注入 OpenAPI MCP、全量浏览器 MCP 或任意会产生副作用的工具。
   - 浏览器观察能力必须从 `roxybrowser_playwright` 工具列表中显式筛选白名单，只允许 `browser_snapshot` 这类只读工具。

4. 只读浏览器观察工具
   - 测试运行器执行候选脚本后，enhancement agent 可以按需调用只读观察工具查看页面结果。
   - 基于网页自动化 agent 断点中看到的 21 个 `roxybrowser_playwright` 工具，第一版可按如下规则筛选：
     - 默认只读观察候选：`browser_snapshot`、`browser_console_messages`、`browser_network_requests`、`browser_take_screenshot`
     - 默认不开放：`browser_resize`、`browser_handle_dialog`、`browser_evaluate`、`browser_file_upload`、`browser_fill_form`、`browser_press_key`、`browser_type`、`browser_navigate`、`browser_navigate_back`、`browser_run_code`、`browser_click`、`browser_drag`、`browser_hover`、`browser_select_option`、`browser_tabs`、`browser_wait_for`、`browser_connect_roxy`
   - `browser_connect_roxy` 是连接准备动作，不是观察工具；只读观察入口应由 pipeline 复用测试运行器建立好的 `dirId -> ws` 连接或在受控代码里完成连接。
   - 只读观察工具的输出也写入内部 trace，作为”为什么这样修改脚本”的证据。
   - 只读观察工具不能替代候选脚本执行，agent 不能通过多次观察 + 手工推理绕过脚本测试。

5. 受控脚本测试运行器
   - 提供一个结构化工具，例如 `test_script({ script, dirId, timeoutMs })`。
   - 工具内部负责按 `dirId` 打开或复用选中的 RoxyBrowser 窗口，获取临时 CDP `ws`，再通过 sandbox 运行候选脚本。
   - **连接复用策略**：同一次 Enhancement 的多轮测试复用同一个 `dirId` 连接，不每次重新打开窗口。第一次测试在干净状态跑，后续测试在前一次结束的页面状态上继续——这本身就是真实场景的验证。如果 Enhance agent 需要从干净状态重跑，应在候选脚本内显式调用 `browser_navigate` 回到起点。
   - **高风险动作确定性检测**：测试运行器内部在脚本执行前或执行中做确定性检查，不依赖 LLM 判断。检测到以下情况时停止测试并报告用户：
     - `browser_click` 的按钮文本或 name 含「购买/下单/支付/提交订单/删除/发布/确认」等高风险关键词
     - `browser_navigate` 的目标 URL 含支付/结算路径特征
     - 执行期间出现 POST/PUT/DELETE 类网络请求（通过 `browser_network_requests` 判断）
   - 工具返回结构化测试结果：退出码、错误栈、`report()` 输出、失败步骤、console 摘要、最终 URL、关键截图或 trace 摘要。
   - 工具不暴露 Playwright 原语给 agent；agent 不能在脚本执行中调用 click / fill / goto 来补救。
   - 每轮测试都写入内部 trace，供后续审计”脚本为什么这样改”。
   - **测试运行器是 Enhance 的工具，不是 Refine 的工具。** Refine 是无工具的单次会话，不涉及测试运行。

6. 轮次与预算上限
   - 必须设置 `maxTurns` 或 token 预算硬上限，例如 20 轮。
   - 必须设置测试运行次数上限，例如最多 3 次脚本测试，防止真实浏览器反复执行产生副作用。
   - 超限时如果没有合规最终脚本，本次 recording 进入 `failed`，由用户决定重试。

7. Checkpoint 隔离
   - Enhance agent 的 checkpoint 使用 recording id，例如 `rec_<id>_enhance`。
   - Refine 不启动 agent，无需 checkpoint；它只是一次 LLM 调用，结果直接传给 Enhance。
   - Enhance 的 checkpoint 不能污染主聊天会话的记忆。

### §7.3 Enhance 增强步骤

Enhance agent 内部建议按如下顺序自检和改写：

1. 读取任务意图
   - 从录制期间用户消息中提取目标、对象、数量、范围、停止条件和异常处理要求。
   - 如果用户没有明确表达批量或循环意图，就保持线性回放，不强行扩展。

2. 审查 Refine 产出的 locator 质量
   - 确认 Refine 已处理的 `browser_click` locator 是否符合预期。
   - 对 `browser_type`、`browser_select_option` 等工具的 locator（Refine 未覆盖），根据用户意图酌情改写，但改写不能基于 AXTree ref（临时会话 ID），必须基于 locator 语义（role、testId、text 前缀等）。

3. 补 RPA 控制流
   - 把代表性样本扩展成用户真实意图，例如前 N 条、分页直到无下一页、按条件筛选、批量表单填写。
   - 加入必要的人类化等待、滚动、重试和执行摘要。
   - 控制流必须能从用户消息或录制事实解释出来。

4. 上提 config
   - 把实录字面量、循环次数、搜索词、目标 URL、等待上限等抽到顶部 `config` 块。
   - 默认值使用录制值，保证脚本不传任何参数也能原样回放。
   - `config` 不写入 token、cookie、Authorization、用户隐私文本或完整原始消息。

5. 生成 report
   - 脚本应通过 `report()` 或等价 helper 返回执行摘要。
   - 摘要至少包含关键步骤、成功数量、失败数量和失败原因。

6. 运行候选脚本并基于反馈修正
   - agent 在认为候选脚本达到可测状态后，调用测试运行器在选中 `dirId` 窗口上跑一次。
   - 测试结束后，agent 可以调用 `browser_snapshot` 等只读观察工具查看脚本实际留下的页面状态。
   - 如果测试失败，agent 只根据测试报告、错误栈、只读观察结果、截图 / trace 摘要和录制上下文修改脚本。
   - 如果失败是业务状态不可恢复、登录态缺失、页面数据已变化或动作有高风险副作用（测试运行器已确定性检测），agent 应停止并报告用户，而不是继续试错。
   - 如果测试通过，候选脚本进入 validate 阶段。

### §7.4 不允许的改写（Refine 和 Enhance 共同适用）

- 不调用会改变页面状态的浏览器工具、OpenAPI 工具、LLM 或 worker subagent 来直接操作页面。
- 不把脚本改成运行时 agent。
- 不在测试运行过程中接管浏览器执行临时 click / fill / goto / scroll / evaluate；截图只能通过白名单只读观察入口收集，不能作为手动推进任务的工具。
- 不把只读观察工具当成通用浏览器控制面；`browser_snapshot` 这类工具只能观察页面状态，不能推进任务。
- 不把测试运行器当成通用浏览器工具；它只能运行完整候选脚本并返回被动观测结果。
- 不访问临时目录外的文件。
- 不把 prompt、thinking、trace、大段 tool result 写进最终脚本。
- 不为未录制过的站点、按钮、账号、表单字段发明新动作。
- v1 不生成 parallel block，不生成 `Promise.allSettled` 多窗口并行回放代码。

### §7.5 两步迭代示意

```text
录制事实：用户在搜索结果点了 1 次”赞”
用户消息：把前 5 条结果都点赞

--- Refine（单次 LLM 会话）---
输入：raw skeleton + 每个 browser_click 执行前的 DOM context（3 层祖先链、testAttrs 等）
判断：locator “点赞按钮（具体标题）” 含动态文案，标记 UNSTABLE
改写：替换为 aria-label 前缀 /^Like/ + 结构定位，输出 locator 修正后脚本

--- Enhance（完整 agent 运行）---
Turn 1: 读取 Refine 产出脚本 + 用户消息”前 5 条”
Turn 2: 识别循环意图，把单次动作包进 for 循环，上提 config.count = 5
Turn 3: 补 report()、等待策略和失败摘要，调用测试运行器在选中 dirId 窗口跑候选脚本
Turn 4: 读取测试报告，用 browser_snapshot 观察页面停在第 3 条附近，
         判断懒加载导致按钮不可见，补滚动与可见性等待
Turn 5: 再次测试通过，输出 enhancedScript，pipeline 进入 validate
```

## §8 脚本验证

Validate 只关注语法、结构、sandbox 契约和安全约束，不重新理解业务逻辑。

Validate 检查：

- TypeScript 语法是否合法。
- 脚本是否满足 `run_script` sandbox 契约。
- 是否存在禁用导入、网络请求、文件系统写入、子进程、LLM 调用、agent 调度或 MCP 调用。
- 是否包含 token、cookie、Authorization、完整 prompt、thinking、trace 或大段 tool result。
- `config` 是否只含可序列化字面量。
- 是否仍残留 `// FAILED:`、未闭合 TODO、空 locator、明显不可执行的占位符。
- v1 是否只包含单 `dirId` 线性回放。

脚本运行测试不属于 validate 本身。它发生在 `Agentic Enhancement` 内部，用来给 agent 提供真实浏览器反馈；validate 是最终确定性 gate，用来阻止结构或安全不合规的脚本进入产物。

Validate 应该暴露一个单独的工具 `validate_script`。作为轮次的最后阶段，agent 调用它来验证最终脚本的合法性：如果不合法，工具将所有收集到的错误信息总结并返回给 agent，在经历多次修改并完成验证后，`validate_script` 工具将会直接终止整个 agent loop，保存最后的脚本。

## §9 脚本沙箱运行时环境

recording 脚本的运行时不应只是“能跑一段 TS”。它需要成为测试阶段和实际运行阶段共用的一层受控 runtime：同一份脚本在 agentic enhancement 测试时如何执行，在用户后续复用时也应以同一套全局 API、权限模型和错误报告执行。

### §9.1 继承现有 sandbox 基础

现有 `roxy-agent` 已经有可复用的 sandbox 基础：

1. `run_script` 通过子进程 `fork()` 启动 agent entry，并注入 `ROXY_MODE=sandbox`、`CDP_URL` 等运行期变量。
2. `sandbox.ts` 读取本地脚本或 HTTP 脚本，用 Node.js 原生 `stripTypeScriptTypes()` 剥离 TypeScript 类型。
3. 脚本通过 `vm.SourceTextModule` 在隔离 context 中执行，未列入 allowlist 的模块 import 会被拒绝。
4. sandbox 通过 IPC 收集 `report()` 消息，由父进程汇总成执行报告。
5. 父进程负责中断、退出码、超时和失败摘要。
   新的 recording runtime 应在这套基础上做产品化收敛，而不是另起一套执行器。关键变化是：脚本不直接 import Playwright、MCP client 或裸浏览器连接对象，而是调用 sandbox 注入的全局函数，例如 `browser_click()`、`browser_type()`、`browser_snapshot()` 和 `report()`。

### §9.2 两种运行配置

同一个 runtime 支持两种 profile：

1. `mode: "debug"`
   - 主要用于 Enhance 测试运行器调用候选脚本，也可以用于开发者本地调试最终脚本。
   - `log.debug()` 和 `log.trace()` 输出到 stderr 并持久化到日志文件。
   - `trace.step()`、`trace.attachText()`、`trace.attachJson()` 有效，写入内部 trace 供 enhancement agent 分析。
   - **每次浏览器操作自动写入专用操作日志** `browser_ops_<runId>.log`（规范见 §9.5）。
   - 允许受限 scratch 文件写入（logs + outputs 目录）。
   - 允许测试运行器在脚本执行后收集只读浏览器观察结果（`browser_snapshot`、`browser_console_messages`、`browser_network_requests`、`browser_take_screenshot`）。
   - 强制测试次数、单次超时、总耗时和高风险动作停止策略。
   - 输出结构化 `TestRunResult`，包含退出码、失败步骤、错误栈、`report()` 输出、trace 摘要、最终 URL、`browser_ops_<runId>.log` 路径引用、只读观察摘要和可选截图引用。

2. `mode: "release"`
   - 用于用户实际复用最终脚本的生产运行。
   - `log.info()`、`log.warn()`、`log.error()` 有效，输出到用户可见日志。
   - `log.debug()`、`log.trace()` 调用**静默无行为**，不产生任何输出或文件写入。
   - `trace.step()`、`trace.attachText()`、`trace.attachJson()` 调用同样**静默无行为**。
   - 不写 `browser_ops_<runId>.log`；每次浏览器操作只记录最小必要摘要（操作类型、成功/失败、耗时）用于 `report()` 汇总。
   - 不开放只读浏览器观察旁路，不写 scratch 文件。
   - 输出结构化 `RunResult`，包含成功 / 失败、执行摘要、失败步骤、错误类型和用户可见报告。

两种 profile 的浏览器操作语义和全局函数 API 完全一致，脚本不感知当前 mode。`debug` 模式产出的诊断材料不影响脚本的执行路径——如果脚本只有在 `debug` 下才能跑通，说明脚本依赖了 debug 专属能力，这是需要修复的 bug。

### §9.3 标准运行时与模块 allowlist

脚本环境保留最小可用的 JavaScript / Node.js runtime：

- JS 全局对象：`Promise`、`JSON`、`Math`、`Date`、`URL`、`URLSearchParams`、`TextEncoder`、`TextDecoder`、`Buffer`、常见集合类型和计时器。
- 日志与报告：`console` 可保留给本地调试，但产品脚本推荐使用 `log` 与 `report`。
- 模块 import 继续走 allowlist。`path`、`url`、`crypto`、`buffer`、`stream` 可以作为基础标准库保留。
- `fs` 不应继续以裸模块形式暴露给 recording 脚本；需要替换为受限 `files` API。
- `os` 只暴露必要只读信息，避免脚本探测过多本机环境。
- `fetch` 默认应关闭或走域名白名单。大多数录制脚本只应操作浏览器，不应绕过浏览器直接访问外网 API。
- `process.env` 不应继续全量暴露。runtime 只提供白名单环境，例如 `runtime.mode`（值为 `"debug"` 或 `"release"`）、`runtime.runId`、`runtime.dirId`、`runtime.outputDir`、`runtime.logsDir`，并避免暴露 token、cookie、Authorization 或完整系统环境。

### §9.4 浏览器全局函数

浏览器能力以全局函数暴露，脚本内可以直接调用，不需要 import：

```ts
const config = {
  keyword: 'roxy browser',
  count: 5,
}

await browser_navigate({ url: `https://example.com/search?q=${encodeURIComponent(config.keyword)}` })

for (let index = 0; index < config.count; index++) {
  await trace.step('处理搜索结果', { index })
  await browser_click({ role: 'button', name: 'Like', index })
  await browser_wait_for({ state: 'networkidle', timeoutMs: 5000 })
}

report({ ok: true, processed: config.count })
```

第一版建议暴露三组函数：

1. 写操作函数
   - `browser_navigate(input)`
   - `browser_click(input)` — `input` 接受 **locator 语义**，不接受 AXTree ref（AXTree ref 是会话级临时 ID，每次 `browser_snapshot` 后就失效，不能出现在持久化脚本里）。示例：
     ```ts
     await browser_click({ role: 'button', name: /^Like video/ })
     await browser_click({ selector: '[data-e2e="like-icon"]' })
     await browser_click({ testId: 'submit-btn' })
     ```
     Runtime adapter 内部把 locator 语义转换成 `page.getByRole()`、`page.locator()` 等 Playwright 调用，对脚本透明。
   - `browser_type(input)`
   - `browser_fill_form(input)`
   - `browser_press_key(input)`
   - `browser_select_option(input)`
   - `browser_wait_for(input)` — 支持三种等待语义：
     ```ts
     // 等页面加载状态
     await browser_wait_for({ state: 'networkidle', timeoutMs: 5000 })
     // 等元素出现
     await browser_wait_for({ selector: '.result-list', timeoutMs: 3000 })
     // 固定等待（人类化节奏）
     await browser_wait_for({ ms: 500 })
     ```

2. 只读观察函数
   - `browser_snapshot(input?)`
   - `browser_console_messages(input?)`
   - `browser_network_requests(input?)`
   - `browser_take_screenshot(input?)`

3. 运行诊断函数
   - `browser_current_target()`
   - `browser_target_info()`

`browser_connect_roxy` 不暴露给脚本。runtime 在脚本启动前根据 `dirId` 打开或复用窗口，拿到临时 CDP `ws` 并建立连接。脚本只知道自己正在操作目标窗口，不负责管理连接生命周期。

每个浏览器函数都应由 runtime 自动包裹：

- 记录 step start / end / error。
- 给错误附加 `toolName`、`inputSummary`、`stepName`、`browserStateRef` 和可选截图引用。
- 对敏感字段做脱敏后再进入 trace。
- 把底层 MCP / Playwright schema 变化隔离在 runtime adapter 内，避免污染脚本产物。

### §9.5 文件、日志与调试工具

脚本不直接使用裸 `fs`。runtime 注入受限文件 API：

- `files.readText(path, options?)`
- `files.writeText(path, content, options?)`
- `files.appendText(path, content, options?)`
- `files.exists(path)`
- `files.list(path, options?)`

文件 API 必须满足以下限制：

- 所有路径解析后必须落在 `runtime.workDir`、`runtime.outputDir` 或明确声明的 attachment 目录下。
- 禁止路径穿越、符号链接逃逸和绝对路径写入。
- 限制单文件大小、总写入大小、文件数量和允许扩展名。
- `debug` 模式允许写 scratch、logs 和 outputs；`release` 模式默认只允许写 outputs 和用户可见报告。
- 文件写入结果只返回受控引用，不把本机绝对路径泄漏进最终脚本。

**browser_ops 操作日志（仅 `debug` 模式）**

`debug` 模式下，runtime 为每次浏览器函数调用自动追加一条 NDJSON 行到 `browser_ops_<runId>.log`，路径在 `runtime.logsDir` 下。脚本本身不需要显式调用——runtime wrapper 在每次 `browser_*` 函数执行的 start / end / error 钩子里自动写入，对脚本透明。

每条记录的结构：

```jsonc
{
  "seq": 1,                        // 本次运行内的操作序号，从 1 开始递增
  "runId": "rec_abc123_run1",      // 与 TestRunResult.runId 对应
  "ts": "2026-06-09T10:23:45.123Z",// ISO 8601 UTC 时间戳
  "op": "browser_click",           // 浏览器函数名
  "input": { "selector": "..." },  // 脱敏后的函数入参（去除密码、token 等敏感字段）
  "result": "ok" | "error",        // 操作结果
  "durationMs": 312,               // 执行耗时（毫秒）
  "error": null | {                // 仅 result === "error" 时非 null
    "message": "...",
    "stack": "..."                  // 截断到前 10 行
  },
  "stepName": "处理搜索结果",       // 最近一次 trace.step() 的名称（如有）
  "url": "https://...",            // 操作发生时的页面 URL
  "screenshotRef": null | "..."    // 仅失败时，runtime 自动截图的受控引用（可选，策略开关）
}
```

`browser_ops_<runId>.log` 的用途：

- Enhance agent 读取操作日志，定位哪一步失败、失败时的页面 URL 和错误栈，不需要靠 console 输出反推。
- 结合 `stepName` 字段（来自最近一次 `trace.step()`），可以把低层错误关联到用户意图层面的步骤名称。
- 文件按 `seq` 严格追加，runtime 保证写入原子性（行级别），不会出现截断的 JSON 行。
- `release` 模式下，此文件**不存在**，runtime 不进行任何文件 I/O。

日志与调试工具分层提供：

- `log.info(message, data?)`
- `log.warn(message, data?)`
- `log.error(message, data?)`
- `log.debug(message, data?)` — `debug` 模式有效；`release` 模式静默无行为
- `log.trace(message, data?)` — `debug` 模式有效；`release` 模式静默无行为
- `trace.step(name, data?)` — `debug` 模式有效；`release` 模式静默无行为
- `trace.attachText(name, text, options?)` — `debug` 模式有效；`release` 模式静默无行为
- `trace.attachJson(name, data, options?)` — `debug` 模式有效；`release` 模式静默无行为
- `report(markdownOrObject)` — 两种模式均有效，是用户可见结果通道

`report()` 是用户可见结果通道；`log.info/warn/error` 和 `browser_ops_<runId>.log` 是两类调试通道（后者只在 `debug` 模式存在）。`debug` 模式会持久化 trace 和操作日志供 enhancement agent 分析；`release` 模式只保留 `report()` 输出、`log.info/warn/error` 和最小浏览器操作摘要。

### §9.6 权限边界

sandbox runtime 的安全边界应以“脚本只做浏览器自动化”为中心：

- 禁止 `child_process`、`worker_threads`、动态加载未授权模块、原生插件、任意 shell 执行。
- 禁止脚本直接访问 MCP client、OpenAPI client、LLM client、agent checkpoint 或主聊天上下文。
- 禁止脚本读取全量 `process.env`、本机 cookie、浏览器 profile 文件和临时目录外文件。
- 禁止脚本绕过浏览器直接调用业务 API，除非后续产品明确加入网络白名单和审计。
- 浏览器写操作只通过 runtime 暴露的 `browser_*` 函数执行。
- enhancement agent 在测试阶段只能调用“运行完整候选脚本”的测试工具；它可用只读观察工具看结果，但不能直接调用写操作函数。

这也意味着最终脚本产物面向的是 `RecordingSandboxRuntime` 契约，而不是裸 Playwright 脚本契约。后续如果底层从 MCP 工具改为直接 Playwright adapter，只要全局函数契约不变，已保存脚本就不需要跟着迁移。

## §10 产物契约

recording 产物面向线上脚本库契约。

最终对外产物：

- 一个 TypeScript 脚本文件（`.ts`）。
- 可被 `run_script` sandbox 直接加载执行。
- 浏览器目标用 `dirId` 标识，连接所需的 `ws` 由调用方按 `dirId` 预先打开后注入。
- 顶部 `config` 块暴露可调输入，实录值为默认。
- 第一版只支持单窗口线性浏览器操作。
- 不包含 source map、完整 prompt、用户原始消息、模型 thinking、trace 或大段 tool result。
- 通过 `report()` 返回执行摘要。

内部调试材料：

- 原始事件日志。
- 主窗口 `dirId` 与运行期 CDP `ws` 调试引用。
- DOM 和工具结果快照。
- raw skeleton 与 enhanced TypeScript 草稿。
- enhancement / 测试运行 / repair 模型 trace。
- 候选脚本测试报告（`debug` 模式下的 `TestRunResult`）：退出码、失败步骤、错误栈、`report()` 输出、`browser_ops_<runId>.log` 路径引用、只读浏览器观察结果、截图或 trace 摘要。
- validate 报告。

## §11 分阶段落地

### §11.1 Phase 1: 单窗口最小可用录制

目标是先打通跨轮次事实采集和 raw skeleton 生成。

交付内容：

- recording session 生命周期。
- conversation 级 active recording。
- 主会话 Playwright MCP 工具调用记录。
- 主窗口 `dirId` 绑定。
- 用户消息累计。
- raw skeleton 生成。
- 多窗口 / `parallel_dispatch` 检测与明确失败提示。

验收标准：

- 同一 conversation 多轮 `/chat` 后，事件日志能连续记录真实浏览器操作。
- raw skeleton 能覆盖导航、点击、输入、等待和失败标记。
- 单窗口脚本能按 `dirId` 重新连接并回放。
- 出现多窗口或 `parallel_dispatch` 时不会生成误导性的半成品脚本。
- 不涉及前端 UI、上传和模型增强。

### §11.2 Phase 2A：Refine + Validate Gate

目标是用两步增强整理 raw skeleton，让它变成更稳定的 RPA 脚本。

交付内容（不含测试运行器，留给 Phase 2B）：

- **Refine** agent（单次 LLM 会话）：处理 `browser_click` locator 稳定化；输入为 raw skeleton + DOM context；有效覆盖范围当前限于 `browser_click`，`browser_type` 等工具的扩展覆盖作为后续独立改进。
- **Enhance** agent（完整 agent 运行，多轮带工具）：接收 Refine 产出脚本 + 用户消息，处理控制流补充、config 上提、`report()` 生成；挂只读文件工具，不挂浏览器写操作工具；此阶段暂不引入测试运行器（Phase 2B 引入）。
- Validate gate：补充语法之外的结构检查：
  - `// FAILED:` 残留（正则扫描）
  - 禁用导入（`child_process`、`net`、`http`、`fetch`）——AST import 节点检查
  - 空 locator（`getByRole('')`、`locator('')` 等正则）
  - 裸 `process.env` 访问（AST 成员表达式检查）
  - `config` 是否只含可序列化字面量（AST 变量初始化检查）
- repair loop。

验收标准：

- 动态文本 locator 能被替换为更稳定的选择器。
- 用户消息里的循环、分页、批量处理意图能进入 enhanced script。
- 实录字面量 / 循环次数被上提为顶部 `config` 块，默认值为实录值。
- `config` 不含 token、cookie 或隐私文本。
- 明显不可运行或违反 sandbox 契约的脚本不会进入最终产物。

### §11.3 Phase 2B：Enhance 测试运行反馈闭环

目标是为 Enhance agent 引入测试运行器，实现"生成 → 测试 → 修正"的完整闭环。

交付内容：

- 为 Enhance agent 实现 `test_script` 工具
- 高风险动作确定性检测（关键词 + 网络请求拦截，不依赖 LLM 判断）
- 连接复用策略：同一次 Enhancement 的多轮测试复用同一 `dirId` 连接
- 只读浏览器观察白名单（`browser_snapshot`、`browser_console_messages`、`browser_network_requests`、`browser_take_screenshot`）
- 测试次数上限（3 次）+ turn budget 硬约束（20 轮）
- Enhance agent 根据 `TestRunResult` 修正脚本，再次运行，直到通过或超限

验收标准：

- enhancement agent 能在最多 3 次受控测试内，根据真实执行报告修正 locator、等待或控制流问题。
- 测试过程中 agent 不能直接通过 Playwright/MCP 写操作控制浏览器，只能运行完整候选脚本，并使用白名单只读工具观察结果。
- 高风险动作（支付/删除/发布等）触发确定性检测，停止测试并报告用户，不依赖 LLM 判断。

### §11.4 Phase 3: Sandbox Runtime 与回放

目标是让脚本产物可在 sandbox 内复用回放。

交付内容：

- `RecordingSandboxRuntime`：基于现有 `ROXY_MODE=sandbox`、`stripTypeScriptTypes` 和 `vm.SourceTextModule` 的统一脚本运行时。
- 全局浏览器函数 adapter：把 `browser_click()`、`browser_type()`、`browser_snapshot()` 等脚本调用映射到底层 `roxybrowser_playwright` 工具或 Playwright adapter。
- test / run 两套权限 profile。
- 受限 `files` API、`log`、`trace`、`report()`。
- `run_script` 本地调试入口。
- recording 专用测试运行入口，可执行未入库的候选脚本。
- recording 专用只读观察入口，可连接同一 `dirId` 窗口，并从 `roxybrowser_playwright` 白名单中执行 `browser_snapshot`、`browser_console_messages`、`browser_network_requests` 等只读诊断。
- 最终 TypeScript 脚本校验。
- 结构化 `TestRunResult` / `RunResult` 与失败步骤报告。

验收标准：

- 最终产物是单个 TypeScript 脚本（`.ts`）。
- 脚本不包含内部 trace、prompt 或 source map。
- sandbox 能按注入的 `dirId -> ws` 映射直接执行 TS 产物。
- 脚本能直接调用 `browser_click()` 等全局函数，不需要 import Playwright 或 MCP client。
- `debug` 模式能留下可供 enhancement agent 分析的 trace、`browser_ops_<runId>.log`、受限文件输出和只读浏览器观察摘要。
- `release` 模式不写操作日志，`log.debug`/`trace` 静默无行为，不暴露 enhancement 专用调试能力。
- 执行结果通过 `report()` 返回。

### §11.5 Phase 4: 多窗口并行扩展

目标是在单窗口链路稳定后，再支持 `parallel_dispatch` 和多窗口并行回放。

交付内容和设计见 §12。

## §12 后续扩展：多窗口并行与 parallel_dispatch

本节保留原方案中关于多窗口并行的核心设计，但它不是第一版交付范围。

### §12.1 设计目标

`parallel_dispatch` 在 chat agent 中的职责是把任务发给多个 worker subagent 并发执行；这适合在线推理，但不适合脚本回放。如果脚本运行时继续启动完整 subagent，会重新引入模型调用、上下文、工具选择和不确定性，违背“保存后的脚本不依赖 AI”的目标。

后续版本应把 `parallel_dispatch` 视为一种特殊的录制操作：

- 主 agent 调用 `parallel_dispatch` 时，录制器创建一个 parallel block。
- 每个 worker subagent 在 block 内拥有自己的 `workerId`。
- worker 内部真实执行的 `browser_*` 操作按 `workerId` 分组写入同一个 parallel block。
- 主会话 agent 自己执行的浏览器操作仍按原来的线性顺序记录，不需要附加 `workerId`。

转换为脚本时，parallel block 不生成 subagent 调度代码，而是生成多个 async 浏览器操作函数，并在 block 末尾用 `Promise.allSettled` 阻塞等待。

### §12.2 采集要求

多窗口并行需要解决三类额外问题：

1. 跨进程事件采集
   - worker 是独立子进程。
   - 录制事件应经已有 `process.send` 通道发回主进程。
   - 主进程统一分配 `sequence` 并单点写文件，避免多进程争抢同一 NDJSON。

2. `dirId` 反查
   - `parallel_dispatch` 的实际输入 schema 仅为 `{ assignments: [{ worker, task }] }`。
   - `workerId` 由运行时派生，例如 `worker-<dispatchId>-<index>`。
   - 每个 worker 操作的浏览器目标 `dirId` 不在 dispatch 输入里，需要录制器从 worker 子进程内部实际执行的 `browser_connect_roxy` 以及对应 `roxy_open_browsers` 返回中反查。

3. 并行块边界
   - enhancement 可以改 locator、等待和 worker 内部控制流。
   - enhancement 不能打散 parallel block，不能把不同 worker 的动作合并成一个线性序列。
   - validate 需要检查 `Promise.allSettled` 等待语义。

### §12.3 回放规则

后续版本的 parallel block 回放规则：

1. 主 agent 操作保持线性脚本。
2. `parallel_dispatch` 对应一个 parallel block。
3. parallel block 内按 `workerId` 保存各 worker 的浏览器操作序列。
4. 脚本生成时，每个 worker 序列转换为一个 async 函数。
5. parallel block 结束时用 `Promise.allSettled` 等待全部 worker 函数结束，并把失败结果写入报告或抛给上层策略。

这样可以保留 orchestrator 的多窗口并行能力，同时避免把 subagent 调度、模型推理和 worker prompt 复制到最终脚本里。

## §13 边界与风险

第一版明确不做：

- 不支持多窗口并行脚本生成。
- 不支持 `parallel_dispatch` worker 回放。
- 不允许 enhancement agent 在测试时直接接管浏览器执行写操作；只读观察白名单除外。

主要风险：

1. locator 稳定性仍可能受页面结构变化影响。
   - 通过 DOM 上下文、用户意图和 validate 报告降低风险，但不能承诺所有站点零维护。

2. 用户意图可能不足以推导 RPA 控制流。
   - enhancement 应保持保守：没有明确数量、范围或条件时不主动扩展。

3. 单窗口边界可能让复杂任务无法一次录完。
   - 第一版优先保障闭环质量；多窗口并行放到 §12 的后续扩展。

4. 模型增强可能产出看似合理但业务含义错误的脚本。
   - validate 只负责结构和安全，业务正确性仍需要用户预览、试跑和回放报告。

5. 测试运行可能产生真实业务副作用。
   - enhancement 测试必须有次数上限、超时上限和失败停止条件；遇到登录态缺失、交易 / 发布 / 删除等高风险动作时，应停止并请求用户确认或报告失败。
   - 只读观察工具必须保持无副作用；如果 `roxybrowser_playwright` 中某个工具可能触发页面计算、下载、焦点变化或滚动，就不能进入白名单。

6. 敏感信息泄露风险。
   - 最终脚本不得包含 token、cookie、Authorization、完整原始消息、thinking、trace 或大段 tool result。

7. 现有 sandbox 默认能力过宽。
   - 当前实现仍向脚本暴露裸 `fs`、`os`、`fetch` 和全量冻结 `process.env`。recording runtime 落地时应收敛为受限 `files` API、网络白名单和环境变量白名单。
   - 全局浏览器函数必须由 runtime adapter 注入，不能把 MCP client 或 Playwright page 对象直接暴露给脚本。

## §14 为什么脚本绑定 sandbox 而不是标准 Playwright

这是一个开发者会反复质疑的决策，值得单独解释。

直觉上，生成标准 Playwright TypeScript 脚本更"通用"——用户可以直接拿走，在任何 Playwright 环境里运行，也更容易理解。但 roxy-agent recording 的脚本不应该是裸 Playwright 脚本，而是面向 `RecordingSandboxRuntime` 契约的受控脚本。原因如下：

**理由 1：安全边界必须在运行时强制执行**

标准 Playwright 脚本可以 `import` 任何 Node.js 模块、写文件、访问 `process.env` 全量环境变量、启动子进程、直接调用网络请求。在 RoxyBrowser 多账号指纹浏览器的场景里，脚本操作的是真实账号、可能涉及真实资金和隐私数据。"靠约定不做坏事"是不够的——权限边界必须在运行时强制执行。`RecordingSandboxRuntime` 的 `vm.SourceTextModule` 隔离、模块 allowlist、受限 `files` API 和环境变量白名单，都是运行时强制执行而非靠约定。

**理由 2：底层变化对已保存脚本透明**

`roxybrowser-playwright-mcp` 的工具接口未来会变，Playwright 版本会升级，人类化鼠标轨迹实现会迭代，CDP 连接方式可能调整。如果脚本直接调用 Playwright API，每次底层变化都可能需要用户手动迁移已保存脚本。通过全局函数接口（`browser_click()`、`browser_navigate()` 等），所有底层变化被 runtime adapter 吸收，对脚本产物透明。这不是过度抽象，而是保证脚本产物的长期有效性。

**理由 3：test / run 两种模式共用同一套能力边界**

Enhancement 阶段的测试运行和用户实际回放，必须执行同一份脚本、用同一套权限模型，才能保证"测试通过的脚本在生产跑也能通过"。如果测试用裸 Playwright 而回放用 sandbox，两者的 API 表面不同，测试结果不具备参考价值。统一在 `RecordingSandboxRuntime` 下，才能让"测试闭环"真正有意义。

**理由 4：业界先例**

Robocorp 的 RPA 框架（Robot Framework）、UiPath 的脚本都是同样的模型：脚本调用受控 library，不直接操作底层 Selenium/Playwright。"脚本绑定运行时"是 RPA 领域的标准做法，针对的就是"脚本长期维护 + 安全边界 + 多版本兼容"这三个问题。roxy-agent 的场景和这些产品完全对应。

**不是完全封闭**：这个决策不阻止用户导出脚本。如果产品后续需要提供"导出为标准 Playwright 脚本"的功能，可以通过 runtime adapter 逆向生成。但这是一个可选的导出动作，而不是脚本的默认存储格式。
