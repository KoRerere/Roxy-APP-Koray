# API 服务器实现总结

## 已完成的改造

### 1. ✅ 创建了 API 服务器入口 (`src/api/server.ts`)
- Express 服务器
- SSE 流式输出支持
- 会话管理端点
- CORS 支持

### 2. ✅ 创建了会话管理器 (`src/api/SessionManager.ts`)
- 多用户会话支持
- 每个会话独立的 ChatManager 实例
- 会话配置管理

### 3. ✅ 改造了 ChatManager (`src/chat/ChatManager.ts`)
- 添加了可选的 `onStream` 回调参数
- 支持流式输出到回调而不是直接 console
- 保持向后兼容（无回调时仍使用 console）

### 4. ✅ 改造了 OrchestratorStreamHandler (`src/cli/orchestrator/index.ts`)
- 添加了可选的 `onStream` 回调
- 支持 API 模式和 CLI 模式
- 事件类型：plan, thinking, content, worker, synthesis, done

### 5. ✅ 创建了流式适配器 (`src/api/streamAdapter.ts`)
- SSE 格式转换
- 事件格式化工具

## API 端点

### POST /api/chat
发送消息并接收 SSE 流式响应

**请求体：**
```json
{
  "message": "用户消息",
  "sessionId": "可选，现有会话ID",
  "thinkingEnabled": true,
  "mcpEnabled": true,
  "mode": "auto"
}
```

**响应：** SSE 流
```
event: thinking
data: {"text": "思考内容"}

event: content
data: {"text": "响应内容"}

event: done
data: {"finalAnswer": "最终答案"}
```

### POST /api/sessions
创建新会话

**响应：**
```json
{
  "sessionId": "uuid",
  "config": {...}
}
```

### DELETE /api/sessions/:sessionId
删除会话

### GET /api/sessions/:sessionId
获取会话信息

## 使用方式

### 启动服务器

```bash
# 方式1: 直接运行 API 服务器
tsx src/api/server.ts

# 方式2: 修改 package.json 添加新脚本
npm run api
```

### 前端连接示例

```javascript
const eventSource = new EventSource('http://localhost:3000/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: '你好',
    thinkingEnabled: true
  })
});

eventSource.addEventListener('thinking', (e) => {
  const data = JSON.parse(e.data);
  console.log('思考:', data.text);
});

eventSource.addEventListener('content', (e) => {
  const data = JSON.parse(e.data);
  console.log('内容:', data.text);
});

eventSource.addEventListener('done', (e) => {
  const data = JSON.parse(e.data);
  console.log('完成:', data.finalAnswer);
  eventSource.close();
});
```

## 需要进一步完成的工作

### 1. 修复 POST /api/chat 的 SSE 实现
当前实现有问题，SSE 需要 GET 请求或使用不同的方式。建议：
- 使用 WebSocket 替代 SSE（更灵活）
- 或使用 POST 创建任务，GET 接收流

### 2. 完善 OrchestratorStreamHandler 的回调支持
- 需要添加更多事件类型（worker 状态等）
- 需要处理 synthesis 阶段的流式输出

### 3. 错误处理
- 添加更完善的错误处理和重试机制
- 添加超时处理

### 4. 认证和授权
- 添加 API key 验证
- 添加用户身份验证

### 5. 性能优化
- 连接池管理
- 会话清理机制
- 资源限制

## 架构说明

```
HTTP Request
    ↓
Express Router
    ↓
SessionManager (获取/创建 ChatManager)
    ↓
ChatManager.sendMessage(message, onStream)
    ↓
    ├─ Simple Mode: 直接流式输出
    └─ Orchestrator Mode: OrchestratorStreamHandler
                          ↓
                      事件流转换
                          ↓
                      SSE Response
```

## 注意事项

1. **SSE vs WebSocket**: 当前使用 SSE，但 POST 请求的 SSE 支持有限。考虑使用 WebSocket 或改为 GET 请求。

2. **会话管理**: 当前会话存储在内存中，重启会丢失。考虑使用 Redis 等持久化存储。

3. **并发限制**: 没有限制并发请求数，可能需要添加限流。

4. **资源清理**: 需要定期清理不活跃的会话。

