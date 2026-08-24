# mcp

## 1. 模块职责

作为 MCP Client，连接外部 MCP Server（stdio / HTTP），把远端工具统一投影成 `ToolDescriptor{source:"mcp"}` 并并入框架工具表，调用时通过 `callTool` 回传 `ToolResult`。

## 2. 对外暴露的接口

类型来源：`src/core/interfaces.ts`。

- `McpClient implements IMcpClient`（`src/mcp/client.ts`）— `connect` / `disconnect` / `listTools` / `callTool`，只读 `name` 与 `connected`。
- `McpServerRegistry implements IMcpServerRegistry`（`src/mcp/registry.ts`）— `load(configs)` 惰性连接、`tools()` 枚举、`disconnectAll()`。
- `mergeMcpToolsInto(registry)`（`src/mcp/index.ts`）— 把已经按 server name 命名空间化的远端工具并入给定 `ToolRegistry`。

相关契约类型：`McpServerConfig`、`McpTransport`、`IMcpClient`、`IMcpServerRegistry`、`ToolDescriptor`、`ToolResult`、`ToolContext`。

## 3. 数据示例

`McpServerConfig` —— stdio 传输：

```jsonc
{
  "name": "fs-server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  "env": { "NODE_ENV": "production" },
}
```

`McpServerConfig` —— HTTP 传输：

```jsonc
{ "name": "remote-search", "transport": "http", "url": "https://mcp.example.com/sse", "token": "sk-..." }
```

远端工具投影为 `ToolDescriptor{source:"mcp"}`：

```jsonc
{
  "name": "mcp_remote-search__search_web",
  "description": "Search the public web.",
  "inputSchema": { "type": "object", "properties": { "q": { "type": "string" } }, "required": ["q"] },
  "source": "mcp",
  "annotations": { "readOnlyHint": true, "openWorldHint": true },
}
```

`callTool` 返回 `ToolResult`（与本地工具同形）：

```jsonc
{ "toolUseId": "toolu_09", "content": "top 3 results ...", "isError": false }
```

## 4. 调用时序与异常语义

时序：

1. 启动：宿主以 `McpServerConfig[]` 调 `registry.load(configs)`，对每个 server 创建 `McpClient`，并将生成的工具显式注册进其 `IToolRegistry`。
2. `tools()` 汇总所有已连接 client 的 `listTools()` → 统一 `ToolDescriptor[]`（`source:"mcp"`）；每个工具统一暴露为 `mcp_{server-name}__{tool-name}`，再经 `mergeMcpToolsInto` 并入主工具表。
3. 模型调用某 MCP 工具 → executor 把命名空间化名称交给对应 `McpClient.callTool(name, input, ctx, toolUseId)`；client 恢复原始远端 tool name 后发起 `tools/call` → 回 `ToolResult`。
4. 关闭：runtime 调 `registry.disconnectAll()`，逐 client `disconnect()`。

异常语义（v1 契约要点）：

- `callTool` 的最终产物是 `ToolResult`，应遵循与 `ToolExecutor` 一致的“失败不抛、转 `isError`”方向 —— 远端工具报错 / 调用异常 → `{ toolUseId, content:<message>, isError:true }`（具体错误字符串 v1 暂无独立契约测试钉死，与 tool 层保持同一风格）。
- `connect` 网络错误 / server 启动失败：v1 直接 reject（agent 启动期失败冒泡给 runtime 处理，不静默跳过）。
- 与 tool/skill 层不同，`IMcpClient` 本身未强制“永不 reject”接口；稳定失败转 `isError` 的约定落在 `callTool` 实现侧，异常连接/枚举错误仍可抛。

## 5. 协议映射

### 远端 MCP 工具 → `ToolDescriptor{source:"mcp"}`

MCP `tools/list` 返回的每个 tool `{ name, description, inputSchema, annotations }` 映射为：

| MCP tool 字段 | `ToolDescriptor` 字段         | 说明                                                        |
| ------------- | ----------------------------- | ----------------------------------------------------------- |
| `name`        | `name`                        | 统一转换为 `mcp_{server-name}__{tool-name}`                 |
| `description` | `description`                 | 直传                                                        |
| `inputSchema` | `inputSchema`（`JsonSchema`） | MCP 用 JSON Schema，与 `JsonSchema` 子集兼容，直传          |
| `annotations` | `annotations`                 | MCP 标准 ToolAnnotations，直传给 runtime HITL 策略作为 hint |
| —             | `source`                      | 固定 `"mcp"`                                                |

### `callTool` → `ToolResult`

MCP `tools/call` 请求：`{ name, arguments: input }`。响应 `{ content: [{ type:"text", text }] | [...], isError? }` 映射：

- 取文本 content 拼成 `ToolResult.content`（字符串）。
- MCP 响应 `isError === true` 或调用异常 → `ToolResult.isError = true`，content 为错误信息。
- `toolUseId` 由调用点传入并回填（与本地 executor 一致）。
- `ToolContext.signal` 透传到底层传输（stdio 子进程 / HTTP fetch 支持 abort）。

并入主表后，mcp 工具走 `ToolRegistry.toAnthropicTools` 与本地工具同形曝光（`source`/`metadata` 不进 Anthropic 投影）。

## 6. 验收标准

v1 MCP 模块尚无独立契约测试；以下为实现完成后必须满足的行为（与 `interfaces.ts:354-388` 对齐）：

- `McpClient`：
  - `connect()` 后 `connected === true`，`disconnect()` 后 `=== false`。
  - `listTools()` 返回远端工具投影为 `ToolDescriptor[]`，每项 `source === "mcp"`，名称为 `mcp_{server-name}__{tool-name}`。
  - `callTool(name, input, ctx, toolUseId)` 回传 `ToolResult`，`toolUseId` 透传；远端 `isError` → `ToolResult.isError`。
  - 支持 `stdio`（`StdioClientTransport`，用 `command`+`args`+`env`）与 `http`（`StreamableHTTPClientTransport`，用 `url`，`token` 作 Bearer）。
- `McpServerRegistry`：
  - `load(configs)` 惰性连接全部已配置 server。
  - `tools()` 返回所有已连接 server 的工具并集，统一 `source:"mcp"`。
  - `disconnectAll()` 关闭全部 client。
- `mergeMcpToolsInto(registry)`：把 `registry.tools()` 逐个 `registry.add` 并入主 `ToolRegistry`；不同 MCP server 的同名工具因 server name 命名空间而彼此隔离，只有完整名称相同时才走覆盖 + warn。
- 越界 transport 类型视为配置错误（v1 仅 `stdio` / `http`）。

## 7. 边界用例 / 不做清单（v1 out of scope）

- 不做 MCP server 进程自动重启 / 健康探活（连接断了由 runtime 决定是否重连）。
- 不做 MCP `resources` / `prompts` 的暴露（v1 仅消费 `tools`）。
- 不做远端工具的本地 schema 校验兜底（直传 `inputSchema`，校验由 handler/远端负责）。
- 不在 MCP adapter 中写入非标准敏感标记。MCP 工具的 HITL 风险提示来自标准 `annotations`；宿主仍可用 `delegate` 规则按名称前缀（如 `mcp_*`）覆盖默认策略。
- 不做 `http` 之外的自定义传输（WebSocket / SSE 仅在 StreamableHTTP 范围内）。
- 不做并发连接数限流 / 鉴权刷新。
- 不做 server 能力协商后的差异化行为（统一当作提供 tools 的 server）。
