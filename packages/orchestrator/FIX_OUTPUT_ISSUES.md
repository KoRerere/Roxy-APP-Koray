# AI 输出问题修复方案

## 🔍 发现的问题

### 问题 1：内容可能被过滤

**位置**：`src/chat/ChatManager.ts:264`

**问题**：
```typescript
// 只有当 chunk.content 存在时才发送
if (chunk.content) {
  if (onStream) {
    onStream('content', chunk.content.toString())
  }
}
```

**影响**：如果某些 chunk 的 `content` 为空字符串或 null，内容可能丢失。

### 问题 2：工具调用后可能没有继续发送内容

**位置**：`src/chat/ChatManager.ts:308-367`

**问题**：工具调用后，代码会继续循环，但是可能在某些情况下没有正确发送后续内容。

### 问题 3：Deepseek + MCP 的 workaround 可能影响输出

**位置**：`src/chat/ChatManager.ts:376-383`

**问题**：当 content 为空时，使用 thinking 内容作为 response，但这可能不会通过 `onStream` 发送。

---

## 🛠️ 修复方案

### 修复 1：确保所有内容都通过 onStream 发送

需要检查：
1. 所有 `chunk.content` 都被发送
2. 工具调用后的内容也被发送
3. 最终响应也被发送

### 修复 2：添加调试日志

添加详细的调试日志，帮助诊断问题。

### 修复 3：检查内容累积

确保内容正确累积到 `finalResponse`，并在最后发送。

