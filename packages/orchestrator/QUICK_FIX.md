# 快速修复 - 如果仍然没有输出

## 临时禁用过滤（用于测试）

如果调试日志显示内容被过滤，可以临时禁用过滤来测试：

### 修改 1：ChatManager.ts (第 278 行)

**临时注释掉过滤**：
```typescript
// 临时禁用过滤进行测试
// if (!contentStr || contentStr.trim() === '') {
//   continue
// }
```

### 修改 2：server.ts (第 230 行)

**临时注释掉过滤**：
```typescript
// 临时禁用过滤进行测试
// if (type === 'content' && (!text || text.trim() === '')) {
//   return
// }
```

### 修改 3：server.ts (第 127 行)

**临时注释掉过滤**：
```typescript
// 临时禁用过滤进行测试
// if (event.type === 'content' && event.data?.text === '') {
//   return
// }
```

## 检查 AI 模型是否返回内容

如果启用调试后，完全没有 chunk 日志，可能是：

1. **AI 模型没有响应** - 检查 API key 和网络连接
2. **流被中断** - 检查是否有错误日志
3. **模式选择问题** - 检查是否错误地使用了 orchestrator 模式

## 检查模式

在调试日志中查看：
```
[DEBUG] Current Mode: simple
[DEBUG] Auto-router routed to: simple
```

如果显示 `orchestrator`，可能需要切换到 `simple` 模式测试。

