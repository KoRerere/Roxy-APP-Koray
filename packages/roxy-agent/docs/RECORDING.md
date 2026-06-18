# roxy-agent 自动化脚本录制技术方案

## 1. 文档定位

本文给出 `roxy-agent` 的 Playwright Recording 技术方案：让用户在正常使用网页自动化 agent 完成任务时，把真实浏览器操作沉淀成可复用、回放时不依赖 AI 的 RPA 脚本。

本文重点回答三件事：

1. 录制如何承接 `roxy-agent` 的跨轮次会话、后台处理和脚本回放。
2. simple 与 orchestrator（含 `parallel_dispatch`）两种运行形态下如何采集与回放。
3. 第一版应保留哪些边界，避免把录制能力做成过大的 workflow 系统。

## 2. 核心结论

基本判断：脚本来源必须是 agent 已经真实执行过的浏览器操作，而不是模型的自然语言计划。

推荐方案：

1. 显式开始录制
   - 由 agent 侧控制录制生命周期，未来前端仅需向用户展示开始和结束的入口，以及"正在录制"的状态

2. 正常使用 agent 执行任务
   - 用户继续按当前方式和 `roxy-agent` 对话
   - 录制器在后台累计用户意图和真实 `browser_*` 操作
   - 录制操作跨对话轮次，记录多轮对话下的所有浏览器操作
   - 如果任务触发 `parallel_dispatch`，录制器按并行块记录各 worker subagent 实际执行的浏览器操作

3. 停止录制后后台整理脚本
   - 用户手动停止
   - 先把操作日志转换成脚本骨架
   - 由 recording agent 输出稳定的 playwright locator、补充循环和条件等 RPA 控制流，并把实录字面量/循环次数上提为脚本顶部 config 块
   - 最后经过校验，产出一个可复用的 TypeScript 自动化脚本

4. 脚本支持浏览器操作并行
   - chat agent 运行时的 `parallel_dispatch` 会启动多个 worker subagent，每个 worker 各自打开自己的 RoxyBrowser 窗口（以 `dirId` 标识）
   - 脚本回放时不再运行完整 subagent，只回放录制下来的浏览器自动化操作
   - 并行 worker 的操作按各自的 `dirId` 连接对应浏览器，用 async 函数包装，并在并行块结束时用 `Promise.allSettled` 等待全部结果

### 2.1 关键设计决策

以下决策是后续所有章节的前提：

1. 浏览器目标用 RoxyBrowser **窗口标识 `dirId`**，不用一次性 CDP URL。
   - RoxyBrowser 的"窗口/分身"本质是一套启动参数集（代理 + 指纹 + UA + cookie…），其持久标识是 `dirId`（即该窗口的 user-data-dir）。`roxy_open_browsers([dirId])` 每次打开都返回一个**临时** CDP `ws`（`ws://host:port/devtools/browser/<guid>`，端口与 GUID 随实例消亡）。
   - 因此录制只记 `dirId`；回放时按 `dirId` 重新打开拿到新鲜 `ws` 再连接——这样回放跑在与录制完全相同的身份（同代理 / 指纹 / cookie）下。CDP URL 仅作录制期调试引用，不进回放。
2. 跨进程事件采集走 **IPC 回主进程单写**。worker 是独立子进程，录制事件经已有 `process.send` 通道发回主进程，由主进程统一分配 `sequence` 并单点写文件，避免多进程争抢同一 NDJSON。
3. 变量提取并入 **enhance 子代理**（v1 不做运行时参数化）。enhance 同时参考录制操作与全会话记录，把实录字面量 / 循环次数上提为脚本顶部 `config` 块，默认值用实录值（脚本可原样回放），为后续真参数化留台阶。
4. v1 **不做混淆**，最终产物是 **TypeScript 脚本**（`.ts`），可被 `run_script` sandbox 直接执行（sandbox 用 Node.js 原生 `stripTypeScriptTypes` 剥离类型后执行，无需预编译）。
5. v1 **不做运行时自愈**，先简单快速上线；为后续自愈预留接口（internal 保留每步 intent 与稳定锚点）。

## 3. 设计原则

录制链路：

```text
开始录制
  -> 在 Playwright MCP 工具层捕获 browser_* 操作（跨轮次、覆盖主会话与 worker）
  -> 记录用户消息、工具输入、工具结果、点击 DOM 上下文
  -> 停止录制
  -> 确定性转换为脚本骨架
  -> refine locator
  -> enhance RPA 控制流 + 变量上提
  -> validate / repair
  -> 最终产物：可复用 TypeScript 脚本
```

这条链路遵循四个设计原则：

1. 记录真实的浏览器操作执行
   - agent 的推理计划可能变化、撤销或失败
   - 浏览器工具调用才代表实际发生过的页面行为

2. 录制期间只收集事实
   - 开始到停止之间主要保存操作、结果、快照和用户意图
   - 不在每一步都让模型改写脚本，减少噪声和成本

3. 停止后做集中整理
   - raw script 先由确定性转换产生
   - refine 只处理 locator 和等待稳定性
   - enhance 再根据用户意图补充循环、分页、批量、条件、随机等待等 RPA 结构，并上提变量

4. 运行脚本时不再依赖 AI
   - 保存后的脚本直接连接目标 RoxyBrowser 窗口执行
   - agent 后续可以调用脚本，但不需要重新推理每一个浏览器动作

## 4. 关键设计选择

`roxy-agent` 的运行形态是 HTTP/SSE 长会话服务，同时支持 simple 和 orchestrator 模式，且 orchestrator 的 worker 运行在独立子进程。录制据此做四处设计选择。

### 4.1 录制生命周期由后端 API 管理

录制生命周期暴露为后端能力：

- start：为某个 conversation 创建 active recording。
- stop：冻结本次 recording 并启动后台处理。
- status：查询处理阶段、错误和最终 artifact。
- cancel/resume：用于长流程中断或失败后的恢复。

前端是否做按钮、进度面板或脚本库入口，不属于第一版 recording 后端方案的必要条件。

### 4.2 录制范围绑定跨轮次 conversation

`roxy-agent` 的用户任务可能跨多次 `/chat` 请求完成，因此 recording session 绑定一整个会话，而不是绑定单个轮次或用户消息。只要当前会话仍处于运行状态（轮次仍未运行完成、用户没有点击“停止录制”）：

- 每轮用户消息都追加为意图上下文
- 每轮 agent 调用 Playwright MCP 的真实浏览器动作都追加到事件日志
- 停止录制时一次性整理整个会话中被录制的网页操作

这样用户可以像平时一样分多轮补充指令，例如“先打开页面”“再搜索这个关键词”“把前 5 条结果逐个处理”，最终仍能生成一个完整脚本。

### 4.3 在 Playwright MCP 工具层捕获

录制不从 SSE/stream 事件观察，而是在 Playwright MCP 工具包装层记录操作。原因：

- orchestrator worker 运行在独立子进程，其事件会被父进程包装，主 stream 不一定保留足够完整的工具上下文。
- 点击前 DOM 上下文需要在真实点击发生前捕获，SSE 事件通常已经太晚。

在工具层捕获后，simple agent 和 worker 内部真实执行的浏览器动作都能被覆盖，且可以在工具执行前后保存输入、输出和失败信息。

### 4.4 parallel_dispatch 从 subagent 调度变为脚本并行块

`parallel_dispatch` 在 chat agent 中的职责是把任务发给多个 worker subagent 并发执行；这适合在线推理，但不适合脚本回放。如果脚本运行时继续启动完整 subagent，会重新引入模型调用、上下文、工具选择和不确定性，违背“保存后的脚本不依赖 AI”的目标。

因此 recording 应把 `parallel_dispatch` 视为一种特殊的录制操作：

- 主 agent 调用 `parallel_dispatch` 时，录制器创建一个 parallel block。
- 每个 worker subagent 在 block 内拥有自己的 `workerId`。
- worker 内部真实执行的 `browser_*` 操作按 `workerId` 分组写入同一个 parallel block。
- 主会话 agent 自己执行的浏览器操作仍按原来的线性顺序记录，不需要附加 `workerId`。

转换为脚本时，parallel block 不生成 subagent 调度代码，而是生成多个 async 浏览器操作函数，并在 block 末尾用 `Promise.allSettled` 阻塞等待。这样脚本获得与 `parallel_dispatch` 类似的并发浏览器执行能力，但运行时仍然是确定性的 Playwright/Roxy 脚本。

> 说明：`parallel_dispatch` 的实际输入 schema 仅为 `{ assignments: [{ worker, task }] }`；`workerId` 由运行时派生（`worker-<dispatchId>-<index>`，`dispatchId` 真实存在）。每个 worker 操作的浏览器目标（`dirId`）**不在 dispatch 输入里**，需由录制器从该 worker 子进程内部实际执行的 `browser_connect_roxy`（并结合其 `roxy_open_browsers` 返回）反查得到。

## 5. 用户流程

第一版可以按如下方式理解用户体验：

### 5.1 开始录制

- 用户在某个网页自动化 agent 会话中点击“开始录制”
- 系统创建一个 recording session，并把它与当前 agent 会话绑定

### 5.2 正常下达网页自动化任务

- 用户继续自然语言对话，agent 持续调用 Playwright MCP 操作浏览器
- 录制器在后台保存三类信息：
  - 操作事实：实际执行过的 `browser_*` 工具调用
  - 辅助上下文：工具结果、ARIA ref、点击前 DOM 上下文、失败信息
- 普通文本回答、thinking、OpenAPI 管理工具和纯验证动作不直接变成脚本步骤
- 如果当前任务触发了 `parallel_dispatch`，用户体验上仍然是一次普通 agent 并行执行；录制器会在后台把这个并行执行区间标记为 parallel block，并把不同 worker 的浏览器动作分别归档。用户不需要理解 worker 细节

### 5.3 停止录制

- 用户停止录制后，系统不再接受新事件，并启动后台处理
- 处理过程分为两类：
  - 确定性阶段：生成脚本骨架、语法校验、策略校验
  - 模型阶段：稳定 locator、补充 RPA 控制流与变量上提、修复校验错误
- 调用方可以轮询 status，直到 recording 进入 done 或 failed

### 5.4 复用脚本

- 最终产物是一个 **TypeScript 脚本**。它应能进入现有 `run_script` 执行链路，自动开启对应的用户浏览器窗口并回放操作
- 这意味着用户后续复用脚本时，agent 可以只负责选择和启动脚本；具体页面操作由脚本自己完成。对于录制期间出现过的并行 worker 操作，脚本会在对应位置并行执行浏览器自动化函数，而不是再次发起 worker subagent

## 6. 与 Simple / Orchestrator 模式的关系

simple 模式仍然是最直接的线性录制路径，主 agent 自己执行的浏览器操作会按发生顺序转换成线性脚本步骤。

orchestrator-worker 模式需要区别对待：

- 在线执行时，`parallel_dispatch` 会启动多个 worker subagent，每个 worker 可能都会创建或打开特定的浏览器窗口，并调用自己的 Playwright Client 操作浏览器
- 录制时，不能把这些 worker 操作直接混进主线性步骤，否则并行窗口场景会丢失真实执行关系
- 脚本回放时，也不能再次运行完整 worker subagent，否则脚本会重新依赖 AI 推理

推荐规则：

1. 主 agent 操作保持线性脚本。
2. `parallel_dispatch` 对应一个 parallel block。
3. parallel block 内按 `workerId` 保存各 worker 的浏览器操作序列。
4. 脚本生成时，每个 worker 序列转换为一个 async 函数。
5. parallel block 结束时用 `Promise.allSettled` 等待全部 worker 函数结束，并把失败结果写入报告或抛给上层策略。

这样可以保留 orchestrator 的多窗口并行能力，同时避免把 subagent 调度、模型推理和 worker prompt 复制到最终脚本里。

## 7. Refine / Enhance 工作机制

停止录制后，确定性转换只能产出一份“照着录制原样复刻”的 raw skeleton：locator 可能依赖动态文案、动作只执行了一次代表性样本、没有循环和判断。把它变成真正可复用的 RPA 脚本，要再做两步模型整理——**refine 稳定 locator、enhance 补控制流并上提变量**。

两步刻意分开，因为它们是性质不同的改写：refine 是“逐行、保守、只动定位”的局部修复，enhance 是“读懂意图、外扩结构”的全局重写。混在一步里两者会互相干扰，也更难校验。

### 7.1 共同前提

- 两步都由独立的 recording agent 执行，不挂浏览器工具。它们不能再操作浏览器，只能读录制下来的上下文、输出新的脚本代码。这保证整理过程不产生新的副作用，也不污染录制事实。
- 输入只有录制期沉淀的材料：raw skeleton、每步的工具结果 / snapshot / 点击前 DOM 上下文 / 失败标记，以及整段会话的用户消息（意图来源）。
- 两步都必须**保持 parallel block 的结构**：不同 worker 的操作各自成函数、不能合并，`Promise.allSettled` 等待语义不能破坏。
- 两步都**只在已有事实上改写**，不发明录制 / 会话里不存在的元素或数值。

### 7.2 Refine：稳定 locator（一次性对话）

Refine 解决的是“录制时的 locator 太脆，换台机器或隔天就点不中”。

**运行方式**：一次性模型调用，不给任何工具。

- Refine 子代理读取 raw skeleton + 录制上下文（点击前 DOM、snapshot、失败标记），输出一份 refined TypeScript 脚本。
- **不注入浏览器工具、文件系统工具、MCP/Skill** — 纯粹的“读上下文 → 输出代码”单次推理，保持轻量与可控。
- 模型失败或超时时，直接用 raw skeleton 继续，保证链路不中断。

**改什么**：

- 只处理元素定位与等待稳定性。
- 借助点击前 DOM 上下文和 snapshot，识别依赖动态文案、统计数字、搜索结果标题、随机排序位置的 locator。
- 优先用 test attribute、稳定的 aria-label 前缀、语义化 class；必要时退回“角色 + 第 n 个”这类结构定位。
- 同时修复录制期捕获到的失败步骤（补页面 / 状态稳定等待，或删掉过期等待）。

**不改什么**：

- 不增删业务动作、不引入循环和判断、不改控制流；已经稳定的行保持不动，避免无谓改写引入回归。

一句话：refine 是一次保守的、局部的定位修复，动作序列与录制一一对应，只是更稳。

### 7.3 Enhance：补 RPA 控制流 + 变量上提（agentic 多轮优化）

录制通常只执行了“一个代表性样本”——用户说“前 5 条逐个处理”，录制里往往只点了第 1 条。Enhance 解决的是“把样本外扩成用户真正想要的流程”。

**运行方式**：带临时工作目录的完整 agent 多轮深度优化。

#### 工作环境

Enhance 不再是一次性代码生成，而是创建一个独立的 recording enhance agent，在隔离的临时目录下多轮迭代改写脚本：

1. **临时工作目录**
   - 为每次 enhance 创建临时目录（如 `<CHECKPOINT_DIR>/recordings/<id>/enhance-workspace/`）。
   - agent 的所有文件操作限定在这个目录（`rootDir` 隔离 + 路径遍历检测）。
   - 目录内包含：refined 脚本草稿、中间产物、agent 自己的工作文件、主会话完整上下文。
   - enhance 完成后，pipeline 从约定路径（如 `enhanced.ts`）取走最终脚本，临时目录可选保留或清理。

2. **只读文件系统工具**
   - 提供 `ls`、`read_file`、`glob`、`grep` 四个只读工具，所有路径限定在临时工作目录。
   - 不提供 `write_file`、`edit_file`、`execute` — agent 通过**输出结构化结果**（如 `{ enhancedScript: string }`）或写到约定路径，由 pipeline 取走并校验后再落盘。
   - 这些工具走 `FilesystemBackend`，受 `rootDir` 强隔离，agent 无法读写临时目录外的文件。

3. **轮次 / 预算上限**
   - 必须设置 **maxTurns（如 20 轮）或 token 预算硬上限**，防止无界循环。
   - 超限时用当前最好产物收尾（agent 可在每轮把阶段性脚本写到临时目录，pipeline 取最新版）。

4. **Checkpoint 隔离**
   - agent 的对话 checkpoint 使用 recording id（如 `rec_<id>_enhance`），不污染主聊天会话的记忆。

#### 改写目标

在 refine 定稳的动作之上补 RPA 结构，并把可变量抽出来：

- 按用户消息里的意图，把单次动作包成循环、分页、批量、条件分支、概率执行、随机等待、人类化滚动等，并补 `report()` 输出执行摘要。
- 同时参考录制到的实际操作（具体输入了什么、点了第几条）和全会话记录（用户说了什么），把实录字面量和循环次数抽到脚本顶部的 `config` 块，**默认值就用实录值**——这样脚本不传任何参数也能原样回放，同时为将来真正的运行时参数化留好入口。

**不改什么**：

- 不重新找元素、不改 refine 定下的 selector。
- 不发明录制 / 会话里没出现过的值。
- 不把并行 worker 还原成 subagent 调度。
- `config` 块不写入 token / cookie 等敏感值。

变量上提之所以并入 enhance、而不是单独做参数化：判断“哪个字面量是该变的量、循环该跑几次”本身就要读用户意图，和补控制流是同一件事的两面，合在一步最自然。

#### 多轮迭代示意

```text
Turn 1: agent 读 refined 脚本 + 用户意图，识别“前 5 条”模式，生成初版 enhanced 脚本
Turn 2: agent 自查发现循环次数硬编码，把它上提为 config.count = 5
Turn 3: agent 补充 report() 输出、优化等待时间
Turn 4: 写入 enhanced.ts，标记完成
-> pipeline 取走 enhanced.ts 进入 validate
```

Agent 在临时目录内自由读写草稿、自检、迭代，直到满意或到达轮次上限。

示意（只说明思路，非最终代码）：

```text
录制事实：在搜索结果点了 1 次“赞”，用户消息说“前 5 条都点赞”
  -> refine（一次性）：把“第 1 条结果标题”这种动态 locator 换成“第 n 个结果”的结构定位
  -> enhance（agentic）：
      - 读出“前 5 条”意图，把单次点赞包进 for 循环
      - 把次数上提为 config.count = 5（默认值取自意图）
      - 多轮自检、补 report、优化等待
      - 写入 enhanced.ts
```

### 7.4 交接、校验与失败处理

- raw -> refine（一次性）-> enhance（agentic）-> validate，后一步在前一步产物上继续，不回头重做。
- refine 或 enhance 任一步失败（模型超时、异常、无法产出合规代码），**直接报告错误给用户**，不自动降级到上一阶段产物。录制到 stop 后的整理是完整流程，任一环节失败都应暴露、由用户决定重试或放弃，而不是静默返回未完全处理的半成品。
- Validate & Repair 只关注语法与结构：
  - Validate 检查：TypeScript 语法是否合法、sandbox 契约是否满足（文件结构、导入限制、禁用能力）、parallel block 是否保持 `Promise.allSettled` 等待语义、`config` 块是否只含可序列化字面量且不含敏感值（token/cookie）
  - Repair：修语法错误、结构不合规、sandbox 契约违规

## 8. 产物契约

recording 产物面向线上脚本库契约。

最终对外产物：

- 一个 **TypeScript 脚本文件**（`.ts`）；
- 可被 `run_script` sandbox 直接加载执行（sandbox 用 Node.js 原生 `stripTypeScriptTypes` 剥离类型后通过 `vm.SourceTextModule` 执行，无需预编译）；
- 浏览器目标用 `dirId` 标识，连接所需的 `ws` 由调用方按 `dirId` 预先打开后注入（不内嵌任何字面 CDP URL）；
- 顶部 `config` 块暴露可调输入（实录值为默认），便于人工改值复跑；
- 支持线性/并行浏览器操作；
- 不包含 source map、完整 prompt、用户原始消息、模型 thinking、trace 或大段 tool result；
- 通过 `report()` 返回执行摘要；

内部调试材料：

- 原始事件日志；
- parallel block 与 worker 分组信息、`dirId` 目标映射；
- DOM 和工具结果快照；
- raw/refined/enhanced TypeScript 草稿（阶段性产物）；
- refine/enhance/repair 模型 trace；

## 9. 分阶段落地

### Phase 1: 最小可用录制

目标是先打通跨轮次事实采集和 raw script 生成。

交付内容：

- recording session 生命周期。
- conversation 级 active recording。
- Playwright MCP 工具调用记录。
- `parallel_dispatch` 录制操作类型。
- worker 浏览器操作按 parallel block 和 `workerId` 分组。
- 用户消息累计。
- raw script skeleton 生成。

验收标准：

- 同一 conversation 多轮 `/chat` 后，事件日志能连续记录真实浏览器操作。
- raw script 能覆盖导航、点击、输入、等待和失败标记。
- orchestrator 多 worker 场景下，主线性操作和 parallel block 操作不会混写。
- 不涉及前端 UI、上传和模型增强。

### Phase 2: Refine / Enhance / Validate

目标是用模型整理 raw script，让它变成更稳定的 RPA 脚本。

交付内容：

- recording 专用 refine 子代理。
- recording 专用 enhance 子代理（含变量上提：把实录字面量 / 循环次数提到顶部 `config` 块）。
- 语法、策略和 sandbox 契约校验。
- repair loop。

验收标准：

- 动态文本 locator 能被替换为更稳定的选择器。
- 用户消息里的循环、分页、批量处理意图能进入 enhanced script。
- 实录字面量 / 循环次数被上提为顶部 `config` 块，默认值为实录值；不发明录制 / 会话中不存在的值，`config` 不含 token/cookie。
- refine/enhance 不破坏 parallel block 的 worker 分组和 `Promise.allSettled` 等待语义。
- 明显不可运行或违反 sandbox 契约的脚本不会进入最终产物。

### Phase 3: Sandbox Runtime 与回放

目标是让脚本产物可在 sandbox 内复用回放。

交付内容：

- sandbox runtime helper：`roxy.connectToRecordedTarget({ dirId })`，从注入的 `dirId → ws` 映射取连接。
- parallel block runtime helper（多 `dirId` 并发连接）。
- `run_script` 本地调试入口（注入 `dirId → ws` 目标映射）。
- 最终 TypeScript 脚本校验（语法、结构、不含敏感值）。

验收标准：

- 最终产物是单个 **TypeScript 脚本**（`.ts`）。
- 脚本不包含内部 trace、prompt 或 source map。
- sandbox 能按注入的 `dirId → ws` 映射直接执行 TS 产物（用 `stripTypeScriptTypes` 剥离类型后通过 `vm.SourceTextModule` 执行），线性步骤和并行步骤都能通过 `report()` 返回执行结果。
