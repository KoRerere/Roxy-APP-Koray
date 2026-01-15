# CLI 到 API 服务器改造指南

本文档说明如何将 CLI 项目改造成支持 SSE/HTTP/2 流式输出的 API 服务。

## 需要调整的核心部分

### 1. **入口文件改造** (`src/index.ts`)
- ❌ 移除：CLI 交互循环 (`while(true)` 循环)
- ❌ 移除：`CLIInterface` 依赖
- ✅ 添加：HTTP 服务器（Express/Fastify）
- ✅ 添加：SSE 端点
- ✅ 添加：会话管理

### 2. **ChatManager 改造** (`src/chat/ChatManager.ts`)
- ❌ 移除：直接 `console.log` 输出
- ❌ 移除：`chalk` 依赖
- ✅ 添加：流式回调接口
- ✅ 添加：事件发射器（EventEmitter）支持

### 3. **OrchestratorStreamHandler 改造** (`src/cli/orchestrator/index.ts`)
- ❌ 移除：`Listr` UI 输出
- ❌ 移除：`chalk` 格式化
- ✅ 添加：事件流接口
- ✅ 添加：SSE 事件格式转换

### 4. **会话管理**
- ✅ 创建：`SessionManager` 类管理多用户会话
- ✅ 每个会话独立的 `ChatManager` 实例
- ✅ 会话 ID 路由

### 5. **依赖更新**
- ✅ 添加：`express` 或 `fastify`
- ✅ 添加：`cors` 支持
- ✅ 可选：移除 `chalk`, `prompts`, `listr2`（如果不再需要 CLI）

## 架构设计

```
HTTP Request → Express Router
                ↓
            SessionManager (管理 ChatManager 实例)
                ↓
            ChatManager.sendMessage() (流式回调)
                ↓
            SSE Response Stream
```

## API 端点设计

### POST /api/chat
创建新会话并发送消息

### GET /api/chat/:sessionId/stream
SSE 流式输出端点

### POST /api/chat/:sessionId/message
向现有会话发送消息

### DELETE /api/chat/:sessionId
删除会话

### GET /api/chat/:sessionId/history
获取会话历史

## 事件格式

SSE 事件类型：
- `thinking`: 思考过程
- `content`: 响应内容
- `plan`: 规划阶段
- `worker`: Worker 执行状态
- `synthesis`: 综合阶段
- `error`: 错误信息
- `done`: 完成

