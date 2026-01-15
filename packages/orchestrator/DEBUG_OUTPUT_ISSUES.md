# AI 输出问题诊断和修复

## 🔍 发现的问题

### 问题 1：Orchestrator 模式下没有传递 onStream 回调

**位置**：`src/chat/ChatManager.ts:144`

**问题**：
```typescript
// 当前代码（有问题）
const response = await runOrchestratorWithStreamHandler({
  input: message,
  history,
  enableThinking: this.thinkingEnabled,
  sessionDir,
  // ❌ 缺少 onStream 参数！
})
```

**影响**：在 CLI 模式下使用 orchestrator 时，内容不会通过回调发送，而是直接输出到 console。但在 API 模式下（server.ts），这个问题已经通过 `handleOrchestratorStream` 解决了。

### 问题 2：工具调用后可能没有继续发送内容

**位置**：`src/chat/ChatManager.ts:308-400`

**问题**：当 AI 调用工具后，工具执行完成，但可能没有继续发送后续的内容。

### 问题 3：内容可能被过滤或丢失

**位置**：`src/chat/ChatManager.ts:264-282`

**问题**：在流式处理中，某些 chunk 可能没有 `chunk.content`，导致内容丢失。

---

## 🛠️ 修复方案

### 修复 1：确保所有内容都通过 onStream 发送

在 `ChatManager.sendMessage` 中，确保所有内容都通过 `onStream` 回调发送。

### 修复 2：添加调试日志

添加详细的调试日志，帮助诊断问题。

### 修复 3：检查工具调用后的内容流

确保工具调用后，AI 的后续响应也能正常发送。

---

## 📝 检查清单

- [ ] 检查 `onStream` 回调是否在所有路径中都被调用
- [ ] 检查工具调用后是否继续处理流
- [ ] 检查是否有内容被过滤
- [ ] 添加调试日志
- [ ] 测试 simple 模式
- [ ] 测试 orchestrator 模式
- [ ] 测试工具调用场景

