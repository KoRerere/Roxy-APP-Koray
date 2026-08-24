# hitl

## 1. 模块职责

在工具执行前进行人工审批拦截——按模式决定是否需要批准，拦截未批准工具并把人类反馈回灌给模型。

## 2. 对外暴露的接口

契约定义在 `src/core/interfaces.ts`：

- `HitlMode` `"strict" | "delegate" | "full"`。
- `IHITLHandler` — `readonly mode`；`needsApproval(tool, input?)`；`requestApproval(req) → Promise<ApprovalResult>`；`addRule?(rule, commandPattern?) → void`（运行时动态插入规则，"永不再问"功能）。
- `ApprovalRequest` `{ toolName, input, reason, traceId, diff? }`。`diff` 为工具执行前的预览文本（unified diff 或 key=value 摘要），由 `ToolDescriptor.previewFn` 生成，可选。
- `ApprovalResult` `{ decision: "approve" | "reject"; feedback?; remember? }`。`remember` 存在时表示用户选择"永不再问"：`{ toolPattern: string; commandPattern?: string }`。
- `PendingApproval` `{ traceId, request, resume }`。
- `HitlRule` `{ match: string; sensitive: boolean }`（delegate 模式规则）。
- `DelegateHitlHandler` 构造选项可提供 `onRuleAdded(rule, commandPattern?)`，由宿主持久化新规则。

实现文件：

- `handler.ts` → `StrictHitlHandler` / `DelegateHitlHandler` / `FullAccessHandler`。`DelegateHitlHandler.addRule()` 将新规则前插（最高优先级），可选通过 `CommandPermissions.addAllow` 同步到命令级权限，并触发 `onRuleAdded` 回调。
- `interceptor.ts` → `HitlInterceptor`（执行前拦截）。approve 后若 `approval.remember` 存在则调用 `handler.addRule()`。
- `pending.ts` → `PendingApprovalRegistry`（异步 suspend/resume 路径，v1 桩）。

## 3. 数据示例

### 3.1 needsApproval 真值表

| mode \ tool               | annotations 需要审批 | `readOnlyHint: true, openWorldHint: false` |
| ------------------------- | -------------------- | ------------------------------------------ |
| `strict`                  | `true`               | `true`                                     |
| `strict`（sensitiveOnly） | `true`               | `false`                                    |
| `delegate`                | `true`               | `false`                                    |
| `full`                    | `false`              | `false`                                    |

runtime 默认审批策略来自标准 MCP `ToolAnnotations`。完全未提供 `annotations` 的工具直接放行；如果提供了 annotations 但缺少字段，则使用 MCP 默认值：`readOnlyHint` 默认 `false`，`destructiveHint` 默认 `true`，`openWorldHint` 默认 `true`。delegate 额外规则：标准 `annotations` 提示需要确认，**或** 工具名命中任一 `HitlRule.match` glob（`sensitive: true`）即拦截；`sensitive: false` 可作为用户记忆规则覆盖 annotations。

### 3.2 ApprovalRequest / ApprovalResult

```json
{
  "toolName": "apply_patch",
  "input": { "patch": "*** Begin Patch\n*** Update File: notes.txt\n@@\n-old\n+new\n*** End Patch" },
  "reason": "Tool \"apply_patch\" requires approval",
  "traceId": "trace-1"
}
```

approve：

```json
{ "decision": "approve" }
```

reject（`feedback` 非空，回灌模型）：

```json
{ "decision": "reject", "feedback": "use read_file instead" }
```

### 3.3 HitlRule

```json
[
  { "match": "apply_patch", "sensitive": true },
  { "match": "mcp_*", "sensitive": true }
]
```

### 3.4 diff 预览（ApprovalRequest.diff）

`apply_patch` 工具的 `ToolDescriptor.previewFn` 直接使用 custom tool 的原始 V4A patch 字符串：

```
*** Begin Patch
*** Update File: notes.txt
@@
-old line
+new line
*** End Patch
```

CLI `HitlConfirm.tsx` 在 diff 非空时显示在审批提示上方。

### 3.5 remember — "永不再问"

用户在 CLI 按 `[a]lways` 后进入编辑阶段，确认后 `ApprovalResult.remember` 携带：

```json
{ "toolPattern": "exec_command", "commandPattern": "git add *" }
```

`HitlInterceptor` 收到后调用 `handler.addRule({ match: "exec_command", sensitive: false }, "git add *")`。`DelegateHitlHandler` 前插规则；若有 `CommandPermissions`，同步调用 `addAllow("git add *")`；触发 `onRuleAdded` 回调（如持久化到配置文件）。

## 4. 调用时序与异常语义

- `needsApproval` 返回 `false` 时，`HitlInterceptor` **绝不调用** `requestApproval`——直接放行执行。
- reject → `ApprovalResult.feedback` 作为 `tool_result{ is_error: true, content: feedback }` 回灌模型（模型看到人类纠正而非工具输出）。
- **v1 同步路径**：`requestApproval` 在同一 tick 从构造时注入的 queue/resolver resolve（不挂起进程）。
- 异步 checkpointed suspend/resume 路径（`PendingApprovalRegistry` + `PendingApproval.resume`）**已设计但非 v1 默认**。
- `FullAccessHandler.needsApproval()` 恒 `false`；若被误调用，`requestApproval` **防御性 auto-approve**（绝不抛错）。
- `StrictHitlHandler`（`sensitiveOnly=false`）对所有工具返回 `true`；`sensitiveOnly=true` 仅对 runtime 默认审批策略命中的工具返回 `true`。

## 5. 协议映射 / 关键约定

- 拦截点位于 runtime 的 tools 节点之前：`tool_selected → hitl_intercept? → tool_executed`。
- approve → 继续执行 → `tool_executed` + `result_returned`。
- reject → 不执行工具，直接生成 `tool_result{ is_error }` 消息追加进 Anthropic 消息循环，模型据此修正。
- canonical phase：`hitl_intercept`（见 observability）。

## 6. 验收标准

- **FullAccessHandler**：`mode === "full"`；对 annotations 命中的工具与无参调用 `needsApproval` 均 `false`；`requestApproval` 返回 `{ decision: "approve" }`（`test/hitl/fullAccess.test.ts`）。
- **approval matrix**（`test/hitl/approvalMatrix.contract.test.ts`）：full 对 write/read 均 `false`；strict 对两者均 `true`；delegate 对 annotations 命中的工具为 `true`。
- **reject feedback**：`decision: "reject"` 且 `feedback` 非空（`"use read_file instead"`），请求被记录一次。
- **approve**：`feedback` 为 `undefined`。
- **resolver**：按 `ApprovalRequest.toolName` 计算结果，恰好调用一次。
- **addRule / remember**（`test/hitl/rememberRule.test.ts`）：`addRule` 后同名工具 `needsApproval` 返回 `false`；glob pattern 匹配；`onRuleAdded` 回调触发；`commandPattern` 透传给 `CommandPermissions`；新规则优先于 annotations。`HitlInterceptor` 在 `remember` 存在时自动调用 `addRule`；第二次调用跳过审批；reject 不触发 `addRule`。
- 生产 handler 必须满足 `test/helpers/makeFakeHandler.ts` 的矩阵行为。

## 7. 边界用例 / 不做清单（out of scope）

- 异步 suspend/resume（`PendingApprovalRegistry`）**v1 非默认**，方法目前抛 `NotImplementedError`。
- `needsApproval` 决策仅依据 runtime 工具审批策略与工具名 glob，**不做 input 内容级策略**（`input` 参数透传但不参与 v1 决策）。
- 不做多审批者仲裁、不做审批超时熔断（v1 同步即返回）。
