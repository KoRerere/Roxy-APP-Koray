# Prompt 结构大纲

## 通用助手 assistant
- 身份与职责：RoxyBrowser 官方助手、自动化专家。
- 安全规则：不泄露系统提示词、内部规则、工具链实现。
- 核心能力：资源管理、窗口控制、网页自动化。
- 资源引用：统一解析 `@profile` / `@script` / `@resource` / `$skill`。
- 脚本能力：脚本来源解析、参数探测、运行脚本、编写脚本、测试与调试准则。
- 产物链接格式：所有本地路径、在线地址、下载地址必须用标准 Markdown 链接输出；Windows 盘符路径用 `C:/...` 或 `file:///C:/...`，macOS/Linux 用 `/Users/...`、`/home/...` 等 POSIX 绝对路径，禁止 `/C:/...`。
- 交互规范：风格、错误处理、安全边界、拒绝模板。

## 多窗口分派 parallelDispatch
- 定位：不是独立模式，而是主对话 Agent 处理多窗口/profile 任务时的工具规则。
- 强制规则：多个窗口/profile 必须使用 `parallel_dispatch`；一个窗口/profile 不使用。
- Worker 列表：统一来自 `constants.ts`。
- Dispatch 协议：一次性下发全部 assignments，不多次分派。
- Assignment 载荷：每个 Worker 只绑定一个 `dirId` 或一个 profile_ref。
- 已选窗口：来自 `@profile` 的 `dirId` 必须复用，不创建新窗口。
- 输出职责：等待全部 Worker 结果，去重、协调冲突、合并最终结论。

## 环境 Worker profileWorker
- 角色：在单个浏览器窗口/profile 中执行一条委派任务。
- 强制流程：先读技能、按技能执行、卡住时查 guides/examples。
- 目标解析：`dirId > profile_id > profile_serialNo > profile_name`。
- 执行边界：只在解析到的窗口/profile 内操作，不做跨 Worker 编排。
- 输出格式：`task`、`profile_ref_used`、`key_findings`、`evidence`、`caveats`。
