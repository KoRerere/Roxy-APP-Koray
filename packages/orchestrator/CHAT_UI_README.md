# Orchestrator Chat UI - SSE 对话界面使用说明

## 概述

这是一个基于 Server-Sent Events (SSE) 的实时对话界面，用于与 Orchestrator 项目进行交互。

## 功能特性

- ✅ 实时流式对话（SSE）
- ✅ 支持多种模式：自动、编排器、简单
- ✅ 显示思考过程
- ✅ 支持 MCP 工具
- ✅ 会话管理
- ✅ 美观的现代化 UI

## 快速开始

### 1. 启动服务器

首先，确保你已经配置了环境变量（`.env` 文件）：

```env
OPENROUTER_API_KEY=your-api-key-here
```

然后启动 API 服务器：

```bash
# 开发模式（自动重启）
npm run server:dev

# 或生产模式
npm run server
```

服务器默认运行在 `http://localhost:3000`

### 2. 打开前端界面

直接在浏览器中打开 `chat-ui.html` 文件：

```bash
# Windows
start chat-ui.html

# macOS
open chat-ui.html

# Linux
xdg-open chat-ui.html
```

或者使用任何 HTTP 服务器（如 Python 的简单服务器）：

```bash
# Python 3
python -m http.server 8080

# 然后访问 http://localhost:8080/chat-ui.html
```

### 3. 开始对话

1. 检查右上角的状态指示器，确保显示"已连接到服务器"
2. 配置对话选项：
   - **模式**：选择自动、编排器或简单模式
   - **显示思考过程**：勾选以查看 AI 的推理过程
   - **启用 MCP**：勾选以使用 MCP 工具
3. 在输入框中输入消息，按 Enter 或点击"发送"按钮

## API 端点

### POST /api/chat

发送聊天消息并接收 SSE 流式响应。

**请求体：**
```json
{
  "message": "你的消息",
  "sessionId": "可选的会话ID",
  "thinkingEnabled": true,
  "mcpEnabled": true,
  "mode": "auto"
}
```

**响应：** SSE 事件流

**事件类型：**
- `session`: 会话 ID（首次响应）
- `thinking`: 思考过程
- `content`: 内容片段
- `plan`: 执行计划
- `worker`: Worker 状态
- `synthesis`: 综合结果
- `error`: 错误信息
- `done`: 完成事件

### GET /health

健康检查端点。

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 界面说明

### 状态指示器

- 🟢 **已连接**：服务器正常运行
- 🔴 **未连接**：无法连接到服务器
- ⟳ **加载中**：正在处理请求

### 消息类型

- **用户消息**：紫色气泡，右对齐
- **AI 回复**：灰色气泡，左对齐
- **思考过程**：灰色斜体文本
- **执行计划**：蓝色边框框
- **Worker 状态**：黄色边框框
- **综合结果**：绿色边框框
- **错误信息**：红色边框框

## 故障排除

### 无法连接到服务器

1. 确保服务器正在运行：`npm run server`
2. 检查服务器地址是否正确（默认：`http://localhost:3000`）
3. 检查浏览器控制台是否有错误信息
4. 确保服务器端口没有被其他程序占用

### SSE 流中断

1. 检查网络连接
2. 查看服务器日志是否有错误
3. 尝试刷新页面重新连接

### 会话丢失

会话 ID 会自动保存，但如果刷新页面，会话会丢失。这是正常行为，系统会自动创建新会话。

## 技术细节

- **前端**：纯 HTML + CSS + JavaScript（无依赖）
- **后端**：Express.js + SSE
- **通信协议**：Server-Sent Events (SSE)
- **数据格式**：JSON

## 开发

### 修改服务器端口

在 `.env` 文件中设置：

```env
PORT=3001
```

或在启动时设置环境变量：

```bash
PORT=3001 npm run server
```

### 自定义样式

直接编辑 `chat-ui.html` 中的 `<style>` 标签。

### 添加新的事件类型

1. 在 `src/api/types.ts` 中添加新的事件类型
2. 在 `src/api/streamAdapter.ts` 中添加格式化方法
3. 在 `chat-ui.html` 的 `handleSSEEvent` 函数中添加处理逻辑

## 许可证

与主项目相同。

