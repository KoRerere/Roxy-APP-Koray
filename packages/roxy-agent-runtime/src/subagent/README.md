# subagent

## 1. 模块职责

`AgentManager` 管理一棵会话级具名 agent tree。根节点固定为 `/root`；child path 由可信 parent path 与 model 提供的 snake_case `name` 组成。每个 child 是独立 Agent，拥有自己的 memory、session、tool set 与宿主资源。

## 2. 核心契约

- `SubAgentSpec`：由宿主预注册的 `agentType`、能力描述、system prompt、工具 allowlist 与静态 token 配置。
- `ManagedAgentBuilder`：根据 spec 与 manager 分配的 path 构造隔离 child。
- `AgentManager`：注册 root、原子保留 path/并发 slot、托管后台 child、保存快照、等待 subtree、级联取消与清理。
- `spawn_agent`：接收 `agent_type`、`name`、`message` 与可选 `dirIds`，立即返回 `starting` receipt，不等待 child 完成。
- `list_agents`：按路径边界返回稳定排序的 tree snapshot。
- `wait_agent`：等待调用者 descendants 达到业务终态；timeout 只结束本次等待，不取消 child。

## 3. 生命周期

```text
starting -> running -> completed
                   |-> failed
                   |-> cancelled
```

业务终态与资源终态分开：`wait_agent` 在 descendants 全部 terminal 后返回；并发 slot、manager `dispose()` 与会话 teardown 直到 `cleanupSettled=true` 才完成。cleanup 失败写入 `cleanupError`，不覆盖已经确定的业务状态。

root 不计入并发配额。默认一棵 tree 最多 10 个 active subagent；`starting`、`running` 和 cleanup 尚未 settled 的 terminal child 都占 slot。达到上限时不排队、不创建 node，返回 `agent_concurrency_limit_reached`。

## 4. 取消边界

调用方 turn 的 AbortSignal 不取消已经成功创建的 child。root stop、manager dispose 或显式 `cancelSubtree()` 才沿 tree 级联取消。一个 child 失败不会取消 sibling；parent 正常结束不会取消已经启动的 descendants，但 terminal parent 不能再创建 child。

## 5. 历史兼容

`RolloutEvent.subagent_delegated` 只作为已有 parent-child session link 的持久化格式继续读取。它不代表旧 `Agent.delegate()`、anonymous fan-out 或 pipeline 执行面仍然存在。
