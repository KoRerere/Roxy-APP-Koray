# Orchestrator - Multi-Agent LangChain CLI

[中文文档](./doc/README_CN.md) | **English**

An advanced LangChain CLI application featuring an **Orchestrator-Worker architecture** powered by [LangGraph.js](https://langchain-ai.github.io/langgraphjs/). It intelligently routes between simple chat and multi-agent orchestration for complex tasks, supporting parallel execution, real-time "thinking" visualization, and streaming responses.

## ✨ Core Features

- **🧠 Multi-Agent Orchestration**: Automatically breaks down complex queries into subtasks and executes them in parallel.
- **⚡️ Smart Routing**: Uses a lightweight router to distinguish between simple chat (Fast) and complex research (Deep).
- **👀 Thinking Mode**: Visualizes the LLM's reasoning process in real-time (Gray text) before the final answer.
- **🌊 Streaming Output**: Full token-by-token streaming for both generic chat and complex agent plans.
- **📊 Live Dashboard**: Real-time CLI visualization of parallel worker progress using `listr2`.
- **🔒 Worker Isolation**: Per-worker process isolation for MCP tools ensures complete context separation between parallel workers.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- [OpenRouter](https://openrouter.ai/) API Key

### Installation

1. **Clone and Install**:
   ```bash
   git clone <repo-url>
   cd orchestrator
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to add your keys:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_MODEL=anthropic/claude-3.7-sonnet  # Recommended for best reasoning
   ```

3. **Run**:
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## 🎮 Usage

Once running, interacting is simple.

**Commands:**
- `/mode <auto|orchestrator|simple>`: Switch routing logic.
  - `auto`: Default. Intelligently picks the best path.
  - `orchestrator`: Force complex multi-agent flow.
  - `simple`: Force direct LLM chat.
- `/thinking`: Toggle the display of the model's hidden reasoning process.
- `/clear`: Reset conversation history.

## 🏗️ Architecture Highlight

The system uses a **Router-Orchestrator-Worker** pattern:

1. **Router**: Classifies intent (Simple vs Complex).
2. **Orchestrator**:
   - **Plan**: Generates a JSON plan of subtasks.
   - **Synthesize**: Combines results from workers into a final answer.
3. **Workers**: Independent LLM nodes that execute subtasks in parallel.

### Worker Isolation Architecture

This project implements **per-worker process isolation** for MCP (Model Context Protocol) tools, ensuring complete context separation between parallel workers.

**Key Features:**
- ✅ Each worker spawns an independent HTTP server subprocess
- ✅ Isolated Backend instances prevent context pollution
- ✅ Dynamic port allocation (starting from 23333)
- ✅ Automatic orphaned process cleanup on startup
- ✅ Graceful shutdown with signal handlers

**Why HTTP Transport is Required:**

HTTP transport is **essential** for worker isolation and cannot be reverted to STDIO mode. STDIO transport creates a single shared Backend instance, causing context pollution where workers can see each other's browser windows/tabs. HTTP multi-process architecture ensures each worker gets its own isolated Backend instance.

For detailed architecture documentation, see **[WORKER_ISOLATION.md](./WORKER_ISOLATION.md)**.

## 📂 Project Structure

A simplified, MVP-friendly structure:

```text
src/
├── agent/                  # Core Orchestrator Logic
│   ├── index.ts            # LangGraph definition
│   ├── orchestrator.ts     # Main planning/synthesis node
│   ├── state.ts            # Graph state definition
│   └── workers/            # Worker nodes
├── chat/                   # Chat Management
│   ├── ChatManager.ts      # Main chat controller
│   ├── Router.ts           # intent classification (simple/orchestrator)
│   └── StreamHandler.ts    # Base LLM stream parser
├── cli/                    # CLI Interface
│   ├── Interface.ts        # Readline loop & commands
│   └── orchestrator/       # New streaming UI components
├── lib/                    # Adapters & Utilities
│   ├── OpenRouterChat.ts   # Custom connection to OpenRouter
│   └── MemoryManager.ts    # Conversation history
└── config/                 # Configuration
    └── config.ts           # Environment & LLM setup
```

For a deep dive into the internal design, thinking streaming implementation, and graph state, see **[ORCHESTRATOR_DESIGN.md](./doc/ORCHESTRATOR_DESIGN.md)**.

## ⚙️ MCP Configuration

The orchestrator uses **HTTP transport** for MCP server connections to enable worker isolation. Configuration is in `mcp-servers.json`:

```json
{
  "mcpServers": {
    "roxybrowser-playwright-mcp": {
      "transport": "http",
      "command": "node",
      "args": ["/path/to/roxybrowser-playwright-mcp/cli.js", "--roxy-mode"],
      "url": "http://localhost:23333/mcp"
    }
  }
}
```

**Important Notes:**
- **`transport: "http"` is REQUIRED** for worker isolation. Do not change to `"stdio"` mode.
- Ports are **dynamically allocated** (23333, 23334, 23335...) - the URL in config is overridden at runtime.
- Each worker spawns its own HTTP server subprocess on a unique port.

**Environment Variables:**
- `MCP_BASE_PORT`: Base port for MCP HTTP servers (default: 23333)
- `DEBUG`: Enable debug logging for MCP operations (`DEBUG=true npm start`)

## ❓ FAQ

**Q: Can I use STDIO transport instead of HTTP?**

A: **No.** HTTP transport is essential for worker isolation. STDIO mode shares a single Backend instance, causing context pollution where workers can see each other's state. See [WORKER_ISOLATION.md](./WORKER_ISOLATION.md#why-http-transport-is-required) for technical details.

**Q: Why are there multiple node processes with different ports?**

A: Each worker spawns an independent MCP server subprocess for complete isolation. This is intentional and necessary to prevent workers from interfering with each other's browser contexts.

**Q: How do I clean up orphaned processes?**

A: The orchestrator automatically cleans up orphaned processes on startup by checking ports 23333-23343. You can also manually kill them:
```bash
lsof -ti :23333-23343 | xargs kill -9
```

**Q: What if port 23333 is already in use?**

A: The orchestrator has automatic retry logic - if a port is occupied, it tries the next port (23334, 23335...). You can also change the base port:
```env
# .env file
MCP_BASE_PORT=24000
```

## 🛠️ Tech Stack

- **Framework**: LangChain & LangGraph.js
- **Model Provider**: OpenRouter (Claude 3.7, GPT-4, etc.)
- **CLI**: `readline`, `chalk`, `listr2`
- **Language**: TypeScript

---
*Built for the Agentic Future.*