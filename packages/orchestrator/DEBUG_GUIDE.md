# 调试指南 - AI 输出问题

## 🔍 如何启用调试模式

### 方法 1：设置环境变量

在启动服务器前设置：

```bash
# Windows PowerShell
$env:DEBUG="true"
npm run server

# Windows CMD
set DEBUG=true
npm run server

# Linux/Mac
DEBUG=true npm run server
```

### 方法 2：在 .env 文件中设置

在 `packages/orchestrator/.env` 文件中添加：

```env
DEBUG=true
```

## 📊 调试日志说明

启用调试后，你会看到以下日志：

### 1. ChatManager 日志

```
[DEBUG] ChatManager: Sending message: <你的消息>
[DEBUG] Current Mode: simple
[DEBUG] ChatManager - Turn 1/20
[DEBUG] ChatManager - Chunk #1 has content: "Hello..."
[DEBUG] ChatManager - Processing content chunk #1, length: 5
[DEBUG] ChatManager - Calling onStream('content', length: 5)
[DEBUG] ChatManager - Stream completed, processed 10 chunks
[DEBUG] ChatManager - hasContentInThisTurn: true
[DEBUG] ChatManager - aggregatedMsg.content length: 50
```

### 2. handleSimpleStream 日志

```
[DEBUG] handleSimpleStream - Received content event, text length: 5
[DEBUG] Content preview: "Hello..."
[DEBUG] handleSimpleStream - Sending content event to onStream
```

### 3. streamCallback 日志

```
[DEBUG] streamCallback - Received event type: content
[DEBUG] Content event, text length: 5
[DEBUG] Content preview: "Hello..."
[DEBUG] streamCallback - Sending content event via SSE
```

## 🐛 常见问题诊断

### 问题 1：没有收到任何 content 事件

**检查**：
1. 查看是否有 `[DEBUG] ChatManager - Chunk #X has content` 日志
2. 如果没有，说明 AI 模型没有返回内容
3. 如果有，检查是否有 `[DEBUG] ChatManager - Processing content chunk` 日志

**可能原因**：
- AI 模型没有返回内容
- 内容被过滤掉了（检查是否有 "Skipping empty content chunk" 日志）
- onStream 回调没有被调用

### 问题 2：收到内容但前端没有显示

**检查**：
1. 查看是否有 `[DEBUG] streamCallback - Sending content event via SSE` 日志
2. 检查浏览器 Network 标签中的 EventStream，看是否有 content 事件
3. 检查前端控制台是否有错误

**可能原因**：
- SSE 事件格式不正确
- 前端解析 SSE 失败
- 内容被前端过滤

### 问题 3：只有 thinking 事件，没有 content 事件

**检查**：
1. 查看是否有 `[DEBUG] ChatManager - Content empty but thinking present` 日志
2. 检查是否有 `[DEBUG] ChatManager - Sending thinking as content` 日志

**可能原因**：
- 使用了 Deepseek 模型 + MCP，内容在 thinking 中
- 需要检查 workaround 是否正常工作

## 🔧 快速诊断步骤

1. **启用调试模式**：
   ```bash
   DEBUG=true npm run server
   ```

2. **发送一条测试消息**

3. **查看服务器日志**，检查：
   - 是否有 chunk 被处理
   - 是否有内容被发送
   - 是否有错误

4. **查看浏览器控制台**，检查：
   - 是否有 SSE 事件被接收
   - 是否有解析错误
   - 是否有渲染错误

5. **查看 Network 标签**，检查：
   - EventStream 中是否有 content 事件
   - 事件数据是否正确

## 📝 报告问题时的信息

如果问题仍然存在，请提供：

1. **服务器日志**（启用 DEBUG 后）
2. **浏览器控制台日志**
3. **Network 标签中的 EventStream 截图**
4. **使用的模型名称**
5. **是否启用了 MCP**
6. **使用的模式**（simple/orchestrator/auto）

