# MCP 模块

Roxy Browser 的 AI Agent 对话界面模块，提供与 AI  agent 交互的完整前端能力，包括流式对话、工具调用可视化、MCP 配置管理等功能。

## 目录结构

```
mcp/
├── index.vue                  # 入口页：会话列表、侧边栏管理
├── types.ts                   # 全局类型定义（消息、附件、Worker 状态等）
├── agent-api.ts               # Agent API 封装（会话/消息 CRUD）
├── util.ts                    # 桶导出文件，保持旧引用路径兼容

├── chat/                      # 聊天视图
│   ├── chat-view.vue          # 聊天主视图
│   ├── chat-input.vue         # 消息输入组件
│   ├── agent-example.vue      # 示例提示词
│   └── components/            # 聊天子组件
│       ├── message-item.vue   # 消息条目
│       ├── thinking-block.vue # 思考过程展示
│       ├── tool-call-block.vue# 工具调用展示
│       ├── planning-block.vue # 计划阶段展示
│       ├── orchestrator-item.vue  # Orchestrator 模式条目
│       ├── status-message.vue # 状态消息
│       ├── hitl-interrupt.vue # 人机交互中断
│       ├── generated-image-preview-modal.vue  # 生成图片预览
│       ├── pending-attachments.vue  # 待发送附件
│       ├── loading.vue        # 加载状态
│       └── empty.vue          # 空状态

├── settings/                  # 设置页
│   ├── settings-view.vue      # 设置主视图
│   ├── mcp-settings.vue       # MCP 服务端配置
│   ├── skills-settings.vue    # Skills 配置
│   └── components/            # 设置子组件

├── scripts/                   # 脚本管理
│   └── scripts-view.vue       # 脚本列表与管理

├── skills-store/              # Skills 市场
│   └── skills-store-view.vue  # Skills 浏览与安装

├── hooks/                     # Vue Composables
│   └── useMessageItem.ts      # 消息条目逻辑复用

├── pinia-store/               # Pinia 状态管理
│   ├── useChatStreamStore.ts  # 聊天流状态（SSE 流、消息、附件等）
│   └── mcp-data-store.ts      # MCP 数据状态（Skills 市场数据）

└── utils/                     # 工具函数
    ├── index.ts               # 统一导出
    ├── sse.ts                 # SSE 事件解析与处理
    ├── markdown.ts            # Markdown 渲染
    ├── message-viewer.ts      # 消息查看器
    └── fetch.ts               # HTTP 请求封装
```

## 核心概念

### 输入场景（Input Scene）

模块支持两种使用场景，通过 `InputScene` 类型区分，由 `useChatStreamStore.inputScene` 控制：

- **网页自动化（automation）**：Agent 操控浏览器完成网页操作任务。对话以工具调用为主，消息流中展示 thinking → tool_call → content 的完整链路。
- **生素材（asset）**：AI 生成图片/素材。输入框提供生图参数配置（宽高比、画质、数量），消息流中包含 `ImageBlock` 类型的图片生成结果，支持占位状态（`isPending`）和 `generated-image-preview-modal` 预览。

### 自动化模式的 Agent 运行方式

自动化场景下，Agent 有以下两种运行模式：

- **Simple 模式**：单 Agent 迭代式工具调用，消息以 `message-item` 展示。
- **Orchestrator 模式**：多 Agent 协作，包含 Planning → Execution → Synthesis 三阶段，通过 `orchestrator-item` + `planning-block` 展示。

### 数据流

```
chat-input.vue → useChatStreamStore (Pinia) → agent-api.ts → SSE → sse.ts 解析 → 消息列表渲染
```

- `useChatStreamStore` 是核心状态枢纽，管理消息列表、SSE 流连接、附件上传、中断决策等。
- `agent-api.ts` 封装后端 API 调用（会话列表、消息历史、删除等）。
- `utils/sse.ts` 负责 SSE 事件流的解析与分块处理。

### 设置与配置

- `settings/mcp-settings.vue`：管理 MCP Server 的连接与参数配置。
- `settings/skills-settings.vue`：管理已安装 Skills 的启用/禁用。
- `skills-store/`：浏览和安装新的 Skills。
