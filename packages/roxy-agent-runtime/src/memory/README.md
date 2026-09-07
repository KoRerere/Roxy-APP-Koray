# memory

## 1. 模块职责

管理对话历史、滑动窗口裁剪、归档摘要与系统提示装配——让长对话在 token 预算内继续，且不丢失关键上下文。

本模块的 `IMemoryProvider` 是 **session working context**：保存当前
agent loop 要发送给模型的短期消息历史、summary 与 trim 后上下文。跨进程
恢复走 `ISessionStore` / rollout replay；长期记忆、RAG、用户画像等外部
记忆系统应通过 plugin 组合 `addMemoryLifecycle()`（写入）与
`addContextContributor()`（读回注入）。

## 2. 对外暴露的接口

契约全部定义在 `src/core/interfaces.ts`，本模块仅提供实现：

- `IMemoryProvider` — `append` / `getAll` / `getSince(count)` / `trim(policy)` / `setSummary` / `getSummary` / `clear`。
- `Trimmer` — `trim(messages, policy) → { kept, summary }`（同步）。
- `TrimPolicy` `{ mode: "turns" | "tokens"; keep: number }`；`TrimSummary` `{ removedCount, removedTokens, archivedText }`。
- `Summarizer` — `summarize(archivedText) → Promise<string>`。
- `SystemPromptBuilder` — `(base, skills?) → SystemBlock[]`；装配稳定的宿主 system prompt 与当前 Agent 的 Skill catalog。
- 长期记忆写入生命周期位于 plugin 系统：`MemoryLifecycle.onTurnEnd`
  适合记录完整 turn，`MemoryLifecycle.onCompaction` 适合记录即将离开
  working context 的 archived messages 与 summary。

实现文件：

- `memory.ts` → `InMemoryProvider`（live in-process 历史，唯一 provider）。
- `trimmer.ts` → `SlidingWindowTrimmer`（注入 `countTokens` 回调）。
- `summarizer.ts` → `BackgroundSummarizer` + `buildSystemPrompt`。

`BackgroundSummarizer(provider, model, options)` 支持宿主传入 `instructions` 和 `maxTokens`。默认摘要预算仍为 1024；启用
extended thinking 的宿主必须提供不小于其 thinking budget 的合法输出预算。

> 会话持久化（跨进程恢复）不在本模块，走 rollout——见 `core/interfaces.ts` 的 `ISessionStore` / `RolloutEvent`。live memory 在 resume 时由 rollout 重放重建，所以本模块无需落盘实现。

## 3. 数据示例

### 3.1 TrimPolicy + TrimSummary（turns 模式）

输入历史（每条 16 字符 ≈ 4 token）：

```json
[
  { "role": "user", "content": "user-message-xxxx" },
  { "role": "assistant", "content": "assistant-message-xxxx" },
  { "role": "user", "content": "user-message-xxxx" },
  { "role": "assistant", "content": "assistant-message-xxxx" }
]
```

```json
{ "mode": "turns", "keep": 2 }
```

裁剪结果：

```json
{
  "kept": [
    { "role": "user", "content": "user-message-xxxx" },
    { "role": "assistant", "content": "assistant-message-xxxx" }
  ],
  "summary": {
    "removedCount": 2,
    "removedTokens": 8,
    "archivedText": "user: user-message-xxxx\nassistant: assistant-message-xxxx"
  }
}
```

### 3.2 tokens 模式（预算 4，仅保留尾部一条）

`{ "mode": "tokens", "keep": 4 }` → `kept` 仅含最后一条 `assistant`，`removedCount: 3`，`archivedText` 以 `user:` 开头。

### 3.3 裁剪后 + 摘要注入 ChatRequest.messages

裁剪 → `archivedText` 喂给 `Summarizer.summarize` → 摘要以隐藏的 developer message 写入 working memory：

```json
{
  "system": [{ "type": "text", "text": "You are roxy." }],
  "messages": [
    {
      "role": "developer",
      "content": "Previous conversation summary:\n<summary>\n用户曾询问 X；助手回答 Y。\n</summary>",
      "visible": false
    },
    { "role": "user", "content": "user-message-xxxx" },
    { "role": "assistant", "content": "assistant-message-xxxx" }
  ]
}
```

`role: "system"` 永不出现在 `messages` 中——system 是 `ChatRequest.system` 顶层字段。

## 4. 调用时序与异常语义

- `trim` 从历史 **HEAD** 移除消息，**始终保留最新一条**（即便 `keep < 1` 或 token 预算为 0，也至少保留尾部一条）。
- 发生真实裁剪时，runtime memory 会按 `compactionKey` 取最新一条隐藏上下文、按 `compactionOrder` 排序并放回保留历史头部；已保留的同 key 消息先去重。`removedCount: 0` 时不改写历史。
- `archivedText` 稳定格式：每条被移除消息渲染为 `"<role>: <text-or-json>"`，以 `"\n"` 连接；字符串内容用字符串，块数组用 `JSON.stringify`。**不包含**保留的尾部。
- `Summarizer.summarize` 失败时记录 warn 并 **resolve `""`**——**永不 reject**，runtime 据此省略摘要块而非崩溃。
- `buildSystemPrompt(base, skills?)` 返回稳定的 base block 与当前 Agent 的 XML Skill catalog；summary 与 contributor 上下文不改变顶层 system prompt。
- 摘要失败不会中断 turn；成功时 runtime 会在下一次模型调用前等待摘要完成，并把摘要作为 synthetic developer message 注入保留历史头部。

## 5. 协议映射 / 关键约定

- runtime 组装 `ChatRequest.messages` 时调用 `memory.getAll()`（或 `getSince(n)`）；超预算先 `trim(policy)` 再调用 provider。
- `provider.countTokens(messages)` 的结果作为 `SlidingWindowTrimmer` 的 `countTokens` 回调，驱动 tokens 模式。
- turn-start 的 summary 和 contributor 输出以 `visible: false` 的 developer message 写入 memory 与 rollout；Skill catalog 保持在 `ChatRequest.system`，不写入会话历史；显式 skill 仍以 user message 注入，再随历史进入 `ChatRequest.messages`。
- 宿主可用 `Message.compactionKey` / `compactionOrder` 标记 metadata、长期记忆等压缩后必须恢复的上下文；compaction 事件的 `keptMessages` 只包含 trim 后保留的消息，不包含 synthetic summary，rollout replay 会构造唯一 summary 后追加这些消息。
- 外部长期记忆的读回通过 `IContextContributor.contribute()` 注入
  隐藏 developer message；写入通过 plugin memory lifecycle 在 turn-end 与
  compaction 时机接收完整 payload。contributor 每轮只调用一次。
- canonical phase：裁剪产生 `memory_trimmed` 事件（见 observability）。

## 6. 验收标准

- **turns**：保留最后 N 条、归档头部；`archivedText === "user: user-message-xxxx\nassistant: assistant-message-xxxx"`（`test/memory/trimmer.contract.test.ts`）。
- **turns always-keep-latest**：`keep: 0` 时 `kept` 仍长度 1 且为最后一条。
- **turns within-budget**：在预算内 `removedCount: 0`、`archivedText: ""`。
- **tokens**：尾部不超预算（除强制保留的最新条）；`keep: 4` 四条 4-token 消息 → 仅留 1 条；空历史 → `kept: []`、`removedCount: 0`、`archivedText: ""`。
- **buildSystemPrompt**：返回非空 base block，并在存在 Skill 时追加 XML catalog；动态摘要与 contributor 不进入 system（`test/memory/systemPrompt.test.ts`）。
- 生产实现 `SlidingWindowTrimmer` 必须满足 `test/helpers/miniTrimmer.ts` 的参考行为。

## 7. 边界用例 / 不做清单（out of scope）

- live memory 一律 **in-memory**（进程退出即丢）；不做 sqlite/关系型 provider——schema 迁移成本换不来收益，跨进程恢复交给 rollout。
- 摘要生成在触发 compaction 的模型调用前等待完成，并以隐藏 developer message 注入。
- `archivedText` 永不包含保留尾部；`role: "system"` 永不进入 `ChatRequest.messages`。
- 不做跨会话持久化摘要索引、不做向量检索召回（非本模块职责）。
