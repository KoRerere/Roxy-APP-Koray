# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orchestrator is a multi-agent LangChain CLI with Router-Orchestrator-Worker architecture powered by LangGraph. It routes between simple chat and multi-agent orchestration for complex tasks, with parallel execution and real-time "thinking" visualization.

## Development Commands

```bash
npm start              # Run the CLI
npm run dev            # Run with auto-reload
npm run build          # Compile TypeScript
```

**Environment Setup**: Copy `.env.example` to `.env`, configure:
- `LLM_PROVIDER`: LLM provider to use - `openrouter` or `siliconflow` (default: `openrouter`)
- `OPENROUTER_API_KEY`: Your OpenRouter API key
- `OPENROUTER_MODEL`: Model to use (e.g., `anthropic/claude-3.7-sonnet:thinking`)
- `SILICONFLOW_API_KEY`: Your SiliconFlow API key (required when using siliconflow)
- `SILICONFLOW_MODEL`: SiliconFlow model (e.g., `deepseek-ai/DeepSeek-V3`)
- `SILICONFLOW_THINKING_BUDGET`: Token limit for reasoning (128-32768, default: 4096)
- `MAX_TURNS`: Tool-calling loop limit (default: 20)
- `CONTEXT_MESSAGE_LIMIT`: Messages for planning/synthesis (default: 15)
- `WORKER_CONTEXT_LIMIT`: Messages for workers (default: 10)
- `PROMPTS_LANGUAGE`: Interface language - `en` or `zh` (default: `en`)

**Debug Mode**: Set `DEBUG=true` in `.env` for verbose logging

## LLM Provider Configuration

Orchestrator supports multiple LLM providers. Configure via `LLM_PROVIDER` environment variable.

### Supported Providers

**OpenRouter** (default):
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-xxx
OPENROUTER_MODEL=anthropic/claude-3.7-sonnet:thinking
```

**SiliconFlow**:
```bash
LLM_PROVIDER=siliconflow
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3
SILICONFLOW_THINKING_BUDGET=4096
```

### Provider Comparison

| Feature | OpenRouter | SiliconFlow |
|---------|-----------|-------------|
| Thinking Mode Parameter | `include_reasoning` | `enable_thinking` |
| Thinking Budget | N/A | `thinking_budget` (128-32768) |
| API Format | OpenAI compatible | OpenAI compatible |
| Reasoning Field | `delta.reasoning` | `delta.reasoning_content` (auto-mapped) |

**Note**: Reasoning fields are automatically mapped to a unified interface, ensuring consistent behavior across providers when using the `/thinking` command.

## Architecture

### Two Execution Paths

```
User Input → ChatManager → Router
                              ↓
         ┌────────────────────┴────────────────────┐
         ↓                                          ↓
    SIMPLE MODE                            ORCHESTRATOR MODE
         ↓                                          ↓
  llm.stream()                          LangGraph StateGraph
         ↓                                          ↓
  StreamHandler                    Plan → Workers (parallel) → Synthesize
```

**Simple Mode**: Direct LLM streaming for casual chat, simple questions
**Orchestrator Mode**: Multi-step workflow for complex research, comparisons

### LangGraph State Flow

```typescript
// State Schema (src/agent/state.ts)
- messages: BaseMessage[]       // Concat reducer
- plan: Subtask[]               // Overwrite reducer
- worker_results: WorkerOutput[] // Concat reducer
- final_answer: string          // Overwrite reducer
```

**Graph Structure** (`src/agent/index.ts`):
```typescript
StateGraph
  .addNode("orchestrator", orchestrator)  // Planner + Synthesizer
  .addNode("worker", generalWorker)       // Task executor
  .addEdge(START, "orchestrator")
  .addConditionalEdges("orchestrator", routeOrchestrator, ["worker", END])
  .addEdge("worker", "orchestrator")
```

**Orchestrator Logic** (`src/agent/orchestrator.ts`):
- **Planning**: When `state.plan` is empty → Generate JSON plan with 3-4 subtasks
- **Synthesis**: When `state.worker_results.length === state.plan.length` → Combine results into final answer

**Worker Execution** (`src/agent/workers/general.ts`):
- Parallel execution via `Send` API
- Tagged with `["worker", "worker_{taskId}"]` for event tracking
- Receives conversation history context via `conversationHistory` parameter
- Implements tool-calling loop (MAX_TURNS default: 20) for MCP tool integration

## Key Implementation Details

### Custom OpenRouter Integration (`src/lib/OpenRouterChat.ts`)

Must use custom `OpenRouterChat` class (not standard `ChatOpenAI`) because:
- Overrides `_streamResponseChunks` to extract `delta.reasoning` from OpenRouter's stream
- Injects reasoning into `AIMessageChunk.additional_kwargs.reasoning`
- Standard LangChain doesn't expose OpenRouter's reasoning field

### Streaming Architecture

**Why bypass ConversationChain?**
- `ChatManager` directly calls `llm.stream(messages)` for real streaming
- `ConversationChain.call()` returns complete response as single chunk (no real streaming)
- Manual history management via `MemoryManager`

### Thinking Mode

**Toggle mechanism**:
- Recreates entire LLM instance (not reconfiguration) when toggling
- OpenRouter's `include_reasoning` must be set at initialization
- `StreamHandler` extracts reasoning from multiple fallback paths:
  - `additional_kwargs.reasoning`
  - `additional_kwargs.reasoning_content`
  - `response_metadata.reasoning`

### Request Router (`src/chat/Router.ts`)

**Routing modes** (via `/mode` command):
- `auto` (default): LLM classifies query complexity
- `orchestrator`: Force multi-agent flow
- `simple`: Force direct streaming

**Heuristic**: Queries < 10 chars → simple mode

### Context Management

**Configuration Functions** (from `config.ts`):
- `getContextMessageLimit()`: Returns number of messages for planning/synthesis (env var: `CONTEXT_MESSAGE_LIMIT`, default: 15)
- `getWorkerContextLimit()`: Returns number of messages for worker context (env var: `WORKER_CONTEXT_LIMIT`, default: 10)

**Important Implementation Detail**:
- Always use function calls (`getContextMessageLimit()`, `getWorkerContextLimit()`) instead of importing constants
- Functions read `process.env` at runtime after `dotenv.config()` has loaded .env file
- Legacy constants (`CONTEXT_MESSAGE_LIMIT`, `WORKER_CONTEXT_LIMIT`) are evaluated at module load time and will use default values

**Context Flow**:
- Planning stage includes last N messages (via `getContextMessageLimit()`)
- Workers receive separate context limit (via `getWorkerContextLimit()`)
- Synthesis uses same context window as planning
- Prevents exponential token growth in long conversations
- Setting limit to 0 passes empty context array (task description only)

### MCP (Model Context Protocol) Integration

**Initialization Order** (critical - `src/index.ts`):
1. MCP must initialize BEFORE ChatManager creation
2. `mcpManager.initialize()` reads `mcp-servers.json` and connects to servers
3. `ChatManager` gets tools from initialized manager via `mcpManager.getTools()`
4. Tools are bound to LLM instances in both simple and orchestrator modes

**Tool Calling**:
- Simple mode: ChatManager implements tool-calling loop with MAX_TURNS iterations
- Orchestrator mode: Workers have full tool-calling capability
- Tools are executed sequentially, results added to message history as `ToolMessage`

### Input Handling

**CLI Implementation** (`src/cli/Interface.ts`):
- Uses `prompts` library (not Node.js readline) for proper multi-byte UTF-8 character support
- Critical for CJK character handling (Chinese, Japanese, Korean)
- Ctrl+C gracefully maps to `/exit` command

**Auto-Wrap Rendering Fix**:
- Applied patch to `prompts` library to fix input duplication when text exceeds terminal width
- Original bug: `text.js` line 204 used `erase.line` which only cleared current line
- Fix: Changed to `clear(this.outputText, this.out.columns)` for proper multi-line clearing
- Patch managed via `patch-package` - auto-applies on `npm install`
- Patch file: `patches/prompts+2.4.2.patch`
- If input rendering issues occur, verify patch applied: `grep "clear(this.outputText" node_modules/prompts/lib/elements/text.js`

### Multi-Language Support

**Prompts System** (`src/prompts/`):
- Dynamic prompt loading based on `PROMPTS_LANGUAGE` environment variable
- Supports `en` (English) and `zh` (Chinese) with separate prompt files
- Singleton pattern: `getPrompts()` returns language-specific prompts
- Prompts cover orchestrator planning, routing, synthesis, and worker execution
- Language changes require restart (loaded at initialization)

### Logging System

**Session Logging** (`src/logger/`):
- **SessionManager**: Creates timestamped directories in `logs/` for each orchestrator session
- **WorkerLogger**: Records individual worker execution in JSONL format
- Each session logs:
  - `session.json`: Session metadata
  - `planning.json`: Generated plan with thinking
  - `synthesis.json`: Final answer with thinking
  - `worker_{taskId}.log`: Per-worker execution details (tool calls, thinking, results)
- Useful for debugging complex orchestrator flows and analyzing worker behavior

## Core Module Responsibilities

- **`src/index.ts`**: Main loop, command handling
- **`src/chat/ChatManager.ts`**: Routes between modes, manages LLM/memory
- **`src/chat/Router.ts`**: Classifies queries (simple vs orchestrator)
- **`src/lib/OpenRouterChat.ts`**: Custom OpenRouter integration with reasoning extraction
- **`src/chat/StreamHandler.ts`**: Processes chunks, separates thinking from content
- **`src/lib/MemoryManager.ts`**: BufferMemory for conversation history
- **`src/agent/orchestrator.ts`**: Dual-role planner and synthesizer
- **`src/agent/workers/general.ts`**: Generic worker for subtask execution
- **`src/cli/orchestrator/index.ts`**: OrchestratorStreamHandler for real-time visualization
- **`src/prompts/`**: Multi-language prompt templates (en/zh)
- **`src/logger/`**: Session and worker logging for debugging
- **`src/config/config.ts`**: Environment configuration and LLM factory

## Common Patterns

### Adding Commands
```typescript
// In src/index.ts main loop
if (input === "/command") {
  // Handle command
  continue;
}
```

### Adding Specialized Workers
1. Create `src/agent/workers/coder.ts`
2. Tag with `["worker", "worker_{taskId}"]`
3. Add node to graph in `src/agent/index.ts`
4. Update routing in `src/agent/orchestrator.ts`

### Adding New Language Support
1. Create new prompt file: `src/prompts/fr.ts` (for French)
2. Define prompts following the `AllPrompts` interface from `types.ts`
3. Update `getPromptsLanguage()` in `src/prompts/index.ts` to recognize new language code
4. Add import and case in `loadPrompts()` function
5. Set `PROMPTS_LANGUAGE=fr` in `.env`

### Modifying LLM Configuration
Always use `ChatManager.updateLLM()` to recreate instance (don't modify existing config)

### Working with LangGraph Events
```typescript
graph.streamEvents({ ... }, { version: "v2" })
```

Key events: `on_chain_end`, `on_chat_model_stream`, `on_custom_event`

## Debugging

**Enable verbose logging**: `DEBUG=true` in `.env`

**Orchestrator debugging**:
- Check `[DEBUG] Orchestrator: Plan length X, Results length Y`
- Verify workers tagged: `["worker", "worker_{taskId}"]`
- Confirm `Send` API usage: `return plan.map(task => new Send("worker", { task }))`

**Common issues**:
- Workers not parallel → Verify `Send` API returns array of Send objects
- Plan JSON parsing fails → System auto-falls back to direct response
- Thinking not showing → Check model supports reasoning, verify `include_reasoning: true`
- MCP tools not available → Verify MCP initializes BEFORE ChatManager (check initialization order in `src/index.ts`)
- Chinese characters deleting incorrectly → Verify using `prompts` library, not `readline`
- Workers timing out → Increase `MAX_TURNS` in `.env` for complex multi-step operations
- Session logs not created → Check `logs/` directory permissions and SessionManager initialization
- **Input duplicating on long lines** → Patch already applied; verify with `grep "clear(this.outputText" node_modules/prompts/lib/elements/text.js`
- **Deepseek + MCP context loss** → See "Known Model-Specific Issues" below

## Known Model-Specific Issues

### Deepseek + MCP Tools Context Bug

**Issue**: When using Deepseek model with MCP tools enabled, the model sends ALL response content through the `reasoning` field instead of `content` field, causing context loss in multi-turn conversations.

**Symptoms**:
- First query appears to work but shows `[DEBUG] Final response length: 0`
- Second query has no context from first query
- Only happens with Deepseek + MCP tools enabled
- Works fine with: Kimi, Claude, or Deepseek without MCP

**Fix Applied** (`src/chat/ChatManager.ts:301-336`):
- Fallback logic: When `content` is empty but `thinking` has data, use `thinking` as response for memory storage
- Only triggers for affected models (Deepseek + MCP)
- No impact on other models (they have `content` populated)

**Verification**:
```bash
# Enable debug mode
DEBUG=true

# Test with Deepseek + MCP
OPENROUTER_MODEL=deepseek/deepseek-v3.2

# Should see debug log:
# [DEBUG] ChatManager - Content empty but thinking present
# [DEBUG] Using thinking content as response (deepseek+MCP workaround)
```

**Testing**: See `DEEPSEEK_FIX_VERIFICATION.md` for detailed test cases

**Log Analysis**:
- Worker logs: `logs/{timestamp}/worker_{taskId}.log` - JSONL format for easy parsing
- Planning phase: `logs/{timestamp}/planning.json` - See generated plan and thinking
- Synthesis phase: `logs/{timestamp}/synthesis.json` - Final answer generation process

## Data Flow Examples

### Simple Mode with Tool Calling
```
User: "Use calculator to add 5+3"
  → Router: < 10 chars heuristic OR LLM classification → "simple"
  → ChatManager.sendMessage()
    → llm.stream([...history, HumanMessage])
    → LLM returns AIMessage with tool_calls array
    → Loop: Execute tools, add ToolMessage results
    → LLM generates final answer from tool results
  → Save to MemoryManager
```

### Orchestrator Mode Flow
```
User: "Compare TypeScript vs Python and analyze performance"
  → Router: LLM classification → "orchestrator"
  → runOrchestratorWithStreamHandler()
    → Orchestrator Planning: Generates JSON plan
      ["Research TypeScript", "Research Python", "Analyze performance"]
    → routeOrchestrator: Sends 3 tasks via Send API
    → 3 Workers run in PARALLEL (each can use MCP tools)
    → Results accumulate in state.worker_results
    → Orchestrator Synthesis: Combines all findings
    → Returns final_answer → END
  → OrchestratorStreamHandler displays real-time progress
```
