# Orchestrator - 多智能体 LangChain CLI

[English Docs](../README.md) | **中文**

这是一个基于 [LangGraph.js](https://langchain-ai.github.io/langgraphjs/) 的高级 LangChain CLI 应用程序，采用 **Orchestrator-Worker（编排者-工人类）架构**。它能够智能地在简单对话和针对复杂任务的多智能体编排之间进行路由，支持并行执行、实时“思考”过程可视化以及流式响应。

## ✨ 核心功能

- **🧠 多智能体编排**：自动将复杂查询分解为子任务并并行执行。
- **⚡️ 智能路由**：使用轻量级路由器区分简单聊天（快速）和复杂研究（深度）。
- **👀 思考模式**：在给出最终答案之前，实时可视化 LLM 的推理过程（灰色文本）。
- **🌊 流式输出**：支持普通聊天和复杂代理计划的全 Token 级流式输出。
- **📊 实时仪表板**：使用 `listr2` 在 CLI 中实时可视化并行工人的进度。

## 🚀 快速开始

### 前置条件
- Node.js v18+
- [OpenRouter](https://openrouter.ai/) API Key

### 安装

1. **克隆并安装**：
   ```bash
   git clone <repo-url>
   cd orchestrator
   npm install
   ```

2. **配置环境**：
   ```bash
   cp .env.example .env
   ```
   编辑 `.env` 添加你的密钥：
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=anthropic/claude-3.7-sonnet  # 推荐用于最佳推理体验
   ```

3. **运行**：
   ```bash
   npm start
   # 或者开发模式
   npm run dev
   ```

## 🎮 使用指南

运行后，交互非常简单。

**命令：**
- `/mode <auto|orchestrator|simple>`：切换路由逻辑。
  - `auto`：默认。智能选择最佳路径。
  - `orchestrator`：强制使用复杂的多智能体流程。
  - `simple`：强制使用直接 LLM 聊天。
- `/thinking`：切换显示模型隐藏的推理过程。
- `/clear`：重置对话历史。

## 🏗️ 架构亮点

系统采用 **Router-Orchestrator-Worker** 模式：

1. **Router (路由器)**：分类意图（简单 vs 复杂）。
2. **Orchestrator (编排者)**：
   - **Plan (规划)**：生成子任务的 JSON 计划。
   - **Synthesize (综合)**：将工人的结果综合成最终答案。
3. **Workers (工人)**：并行执行子任务的独立 LLM 节点。

深入了解内部设计、思考流式传输的实现以及图状态，请参阅 **[ORCHESTRATOR_DESIGN.md](./ORCHESTRATOR_DESIGN.md)**。


## 📂 项目结构

```text
src/
├── agent/                  # 核心编排逻辑
│   ├── index.ts            # LangGraph 定义
│   ├── orchestrator.ts     # 主规划/综合节点
│   ├── state.ts            # 图状态定义
│   └── workers/            # 工人节点
├── chat/                   # 聊天管理
│   ├── ChatManager.ts      # 主聊天控制器
│   ├── Router.ts           # 意图分类 (简单/编排)
│   └── StreamHandler.ts    # 基础 LLM 流解析器
├── cli/                    # CLI 界面
│   ├── Interface.ts        # Readline 循环与命令
│   └── orchestrator/       # 新的流式 UI 组件
├── lib/                    # 适配器与工具
│   ├── OpenRouterChat.ts   # OpenRouter 自定义连接
│   └── MemoryManager.ts    # 对话历史
└── config/                 # 配置
    └── config.ts           # 环境与 LLM 设置
```

## 🛠️ 技术栈

- **框架**：LangChain & LangGraph.js
- **模型提供商**：OpenRouter (Claude 3.7, GPT-4 等)
- **CLI**：`readline`, `chalk`, `listr2`
- **语言**：TypeScript

---
*Built for the Agentic Future.*