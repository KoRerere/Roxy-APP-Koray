# Proxybrowser Worker隔离问题 - HTTP Transport解决方案

## 问题描述

### 现象
在orchestrator的多worker并行执行中，当两个worker分别连接不同的proxybrowser窗口时，它们会共享browser上下文，导致：
- Worker1看到Worker2的标签页
- Worker2看到Worker1的标签页
- 标签页状态混乱，无法独立操作

### 测试案例
```
Worker1: 连接test2窗口 → 访问Google
Worker2: 连接test4窗口 → 访问Baidu

预期：Worker1只看到Google，Worker2只看到Baidu
实际：两个worker都看到Google和Baidu的标签页
```

### 日志证据
Session: `logs/2025-12-22T07-13-24/`
- Worker1连接到 CDP: `ws://127.0.0.1:55770/...` (test2)
- Worker2连接到 CDP: `ws://127.0.0.1:55774/...` (test4)
- 虽然CDP endpoint不同，但两个worker共享相同的tabs数组

---

## 根本原因分析

### 架构问题

#### 当前架构 (STDIO Transport)
```
Orchestrator启动
  ↓
McpManager.initialize()
  ↓
创建MultiServerMCPClient with STDIO transport
  ↓
启动MCP服务器子进程: node cli.js --roxy-mode
  ↓
mcpServer.start() 调用 factory.create() 一次
  ↓
创建 ONE BrowserServerBackend instance
  ↓
Backend创建 ONE Context instance
  ↓
Context._tabs = [] (共享数组)
  ↓
Worker1调用browser_connect_roxy → 使用这个Context
Worker2调用browser_connect_roxy → 使用同一个Context
  ↓
结果：所有worker共享 _tabs 数组
```

#### 关键代码位置

**1. Orchestrator的STDIO配置** (`src/mcp/McpManager.ts:44-49`):
```typescript
servers[name] = {
    transport: "stdio",  // ← STDIO模式
    command: serverConfig.command,
    args: serverConfig.args,
    env: { ...process.env, ...serverConfig.env }
};
```

**2. MCP服务器的Backend创建** (`roxybrowser-playwright-mcp/src/mcp/server.ts:48-50`):
```typescript
export async function connect(factory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const server = createServer(factory.name, factory.version, factory.create(), runHeartbeat);
  // ↑ STDIO模式下，factory.create() 只调用一次
  await server.connect(transport);
}
```

**3. Context的共享状态** (`roxybrowser-playwright-mcp/src/context.ts`):
```typescript
class Context {
    private _tabs: Tab[] = [];  // ← 所有worker共享这个数组
    private _browserContextPromise: Promise<BrowserContext> | null;
    // ...
}
```

**4. reconnectToCDP不清除状态** (`roxybrowser-playwright-mcp/src/context.ts:177-194`):
```typescript
async reconnectToCDP(cdpEndpoint: string): Promise<void> {
    await this.closeBrowserContext();
    await dynamicFactory.reconnectToCDP(cdpEndpoint);
    await this._ensureBrowserContext();
    // ❌ _tabs 数组没有被清除，导致累积
}
```

### 为什么会共享

**STDIO Transport的特性**：
- 单进程、单连接
- MCP服务器启动时创建一个Backend实例
- 所有tool calls通过同一个Backend处理
- Backend只有一个Context实例
- Context的 `_tabs` 数组被所有worker共享

**问题流程**：
```
1. Worker1: browser_connect_roxy(test2)
   → Context._tabs = [test2的dashboard, ...]

2. Worker2: browser_connect_roxy(test4)
   → reconnectToCDP(test4_endpoint)
   → 切换CDP连接到test4
   → ❌ 但 _tabs 数组没有清除
   → Context._tabs = [test2的tabs, test4的tabs, ...] ← 累积！

3. Worker1再次操作
   → 看到的是累积后的 _tabs 数组
   → 包含Worker2的标签页
```

---

## 解决方案：切换到HTTP Transport

### 为什么选择HTTP Transport

#### HTTP vs STDIO对比

| 特性 | STDIO Transport | HTTP Transport |
|------|----------------|----------------|
| 连接模式 | 单进程、单连接 | 单进程、多会话 |
| Backend实例 | ONE (factory.create()调用1次) | MULTIPLE (每个session调用1次) |
| Context实例 | 共享 | 独立 |
| Worker隔离 | ❌ 不隔离 | ✅ 完全隔离 |
| 资源开销 | 低 | 中等 (每session一个Backend) |
| 扩展性 | 差 | 好 |

#### HTTP Transport的隔离机制

```
Orchestrator启动
  ↓
McpManager.initialize()
  ↓
创建MultiServerMCPClient with HTTP transport
  ↓
启动MCP HTTP服务器: node cli.js --http-server --port 8080
  ↓
MCP服务器监听HTTP请求
  ↓
Worker1发起请求 → 创建Session1 → factory.create() → Backend1 + Context1
Worker2发起请求 → 创建Session2 → factory.create() → Backend2 + Context2
  ↓
Worker1使用Context1 (独立的_tabs数组)
Worker2使用Context2 (独立的_tabs数组)
  ↓
结果：完全隔离 ✅
```

#### 优势

1. **根本解决问题**：每个session有独立的Backend和Context
2. **架构正确**：符合多会话设计模式
3. **扩展性好**：支持未来更多并发worker
4. **代码侵入性适中**：不需要重构，只需配置变更

---

## 实施步骤

### 步骤1：检查MCP服务器是否支持HTTP模式

**1.1 查看cli选项**

```bash
cd roxybrowser-playwright-mcp
node cli.js --help | grep -i http
```

**预期输出**：
应该包含 `--http-server` 或类似选项。

**1.2 查看源码确认**

查看 `roxybrowser-playwright-mcp/src/program.ts`，找到HTTP server相关代码：
```typescript
if (options.httpServer) {
    // HTTP server模式
    await mcpServer.start(factory, config.server);
}
```

**如果不支持**：需要先在MCP服务器中添加HTTP server支持（参考附录A）。

---

### 步骤2：修改MCP服务器配置

**文件**: `/Users/will/Dev/orchestrator/mcp-servers.json`

**当前配置**:
```json
{
    "mcpServers": {
        "roxybrowser-playwright-mcp": {
            "command": "node",
            "args": [
                "/Users/will/Dev/orchestrator/roxybrowser-playwright-mcp/cli.js",
                "--roxy-mode"
            ]
        }
    }
}
```

**修改为HTTP模式**:
```json
{
    "mcpServers": {
        "roxybrowser-playwright-mcp": {
            "transport": "http",
            "url": "http://localhost:8080/sse",
            "command": "node",
            "args": [
                "/Users/will/Dev/orchestrator/roxybrowser-playwright-mcp/cli.js",
                "--roxy-mode",
                "--http-server",
                "--port", "8080"
            ]
        }
    }
}
```

**说明**：
- `transport`: 改为 "http"
- `url`: HTTP endpoint地址
- `--http-server`: 启用HTTP server模式
- `--port 8080`: 指定端口（可自定义）

---

### 步骤3：修改Orchestrator的MCP连接逻辑

**文件**: `src/mcp/McpManager.ts`

#### 3.1 识别transport类型

**当前代码** (lines 40-50):
```typescript
const servers: Record<string, any> = {};

for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    servers[name] = {
        transport: "stdio",  // ← 硬编码为stdio
        command: serverConfig.command,
        args: serverConfig.args,
        env: { ...process.env, ...serverConfig.env }
    };
}
```

**修改为**:
```typescript
const servers: Record<string, any> = {};

for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    // 检查是否配置了HTTP transport
    if (serverConfig.transport === 'http' && serverConfig.url) {
        // HTTP transport配置
        servers[name] = {
            transport: "http",
            url: serverConfig.url,
            // 仍然需要启动子进程（HTTP server）
            command: serverConfig.command,
            args: serverConfig.args,
            env: { ...process.env, ...serverConfig.env }
        };
    } else {
        // 默认STDIO transport
        servers[name] = {
            transport: "stdio",
            command: serverConfig.command,
            args: serverConfig.args,
            env: { ...process.env, ...serverConfig.env }
        };
    }
}
```

#### 3.2 更新TypeScript接口

**文件**: `src/mcp/McpManager.ts` (lines 10-14)

**当前接口**:
```typescript
interface McpServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}
```

**修改为**:
```typescript
interface McpServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
    transport?: 'stdio' | 'http';  // ← 新增
    url?: string;                   // ← 新增 (HTTP模式需要)
}
```

---

### 步骤4：确保MCP HTTP Server正确实现

**检查文件**: `roxybrowser-playwright-mcp/src/mcp/http.ts`

#### 4.1 验证HTTP server创建session

关键代码 (lines 88-91):
```typescript
const transport = new SSEServerTransport('/sse', res);
sessions.set(transport.sessionId, transport);
await mcpServer.connect(serverBackendFactory, transport, false);
```

这里每个HTTP请求都会：
1. 创建新的 `SSEServerTransport`
2. 调用 `mcpServer.connect(serverBackendFactory, transport, false)`
3. `connect` 内部会调用 `factory.create()` 创建新的Backend

#### 4.2 验证program.ts中的HTTP server启动

**文件**: `roxybrowser-playwright-mcp/src/program.ts`

查找HTTP server相关代码：
```typescript
if (options.httpServer) {
    // HTTP模式下，启动HTTP server
    const factory: mcpServer.ServerBackendFactory = {
        name: 'Playwright w/ RoxyBrowser',
        nameInConfig: 'playwright-roxy',
        version: packageJSON.version,
        create: () => {
            const dynamicContextFactory = createDynamicCdpContextFactory(config);
            return new BrowserServerBackend(config, dynamicContextFactory);
        }
    };

    // 启动HTTP server
    await mcpServer.startHttpServer(factory, {
        port: options.port || 8080,
        host: options.host || 'localhost'
    });
    return;
}
```

**如果没有这段代码**，需要添加（参考附录A）。

---

### 步骤5：编译和测试

#### 5.1 编译MCP服务器

```bash
cd roxybrowser-playwright-mcp
npm run build
```

**验证编译成功**：
```bash
ls -la lib/program.js  # 应该显示最新时间戳
```

#### 5.2 测试HTTP server启动

手动测试MCP HTTP server是否能启动：
```bash
node cli.js --roxy-mode --http-server --port 8080
```

**预期输出**：
```
[MCP] Starting HTTP server on http://localhost:8080
[MCP] HTTP server ready
```

**验证端口监听**：
```bash
lsof -i :8080
```

应该看到node进程监听8080端口。

测试完成后 `Ctrl+C` 停止。

#### 5.3 重启Orchestrator

```bash
cd /Users/will/Dev/orchestrator
npm start
```

**预期日志**：
```
[MCP] Loading config from /Users/will/Dev/orchestrator/mcp-servers.json
[MCP] Connecting to servers...
[MCP] Starting MCP server: roxybrowser-playwright-mcp (HTTP mode)
[MCP] Connected.
[MCP] Loaded X LangChain tools.
```

---

### 步骤6：测试验证隔离效果

#### 6.1 执行测试任务

给orchestrator发送任务：
```
请帮我测试两个proxybrowser窗口的隔离性：
1. 打开名为test1的窗口，连接后导航到 https://www.google.com，然后列出所有标签页
2. 打开名为test2的窗口，连接后导航到 https://www.baidu.com，然后列出所有标签页

请并行执行这两个任务，并告诉我每个窗口看到的标签页列表。
```

#### 6.2 验证结果

**预期结果（修复成功）**：

Worker1的标签页：
```
- Tab 0: test1 dashboard
- Tab 1: Google (https://www.google.com)
```

Worker2的标签页：
```
- Tab 0: test2 dashboard
- Tab 1: Baidu (https://www.baidu.com)
```

**关键验证点**：
- ✅ Worker1不包含baidu.com
- ✅ Worker2不包含google.com
- ✅ 每个worker只看到2个标签页

#### 6.3 检查日志

```bash
# 查看最新session
ls -lt logs/ | head -2

# 检查worker日志
grep -i "google\|baidu" logs/{最新session}/worker_*.log
```

**预期**：
- `worker_1.log` 只包含 "google"
- `worker_2.log` 只包含 "baidu"

---

## 问题排查

### 问题1：HTTP server启动失败

**现象**：
```
Error: Cannot start HTTP server
```

**排查**：
1. 检查端口是否被占用：`lsof -i :8080`
2. 尝试更换端口：`--port 8081`
3. 检查防火墙设置

### 问题2：Orchestrator连接HTTP server失败

**现象**：
```
[MCP] Connection error: ECONNREFUSED
```

**排查**：
1. 确认MCP HTTP server已启动：`ps aux | grep cli.js`
2. 确认端口正确：检查 `mcp-servers.json` 中的url
3. 测试手动连接：`curl http://localhost:8080/sse`

### 问题3：仍然共享context

**现象**：
Worker之间仍然看到对方的标签页

**排查**：
1. 确认使用的是HTTP transport：
   ```bash
   # 检查orchestrator日志
   grep "HTTP mode" logs/latest
   ```

2. 验证每个session创建新Backend：
   在 `browserServerBackend.ts` 的构造函数中添加日志：
   ```typescript
   constructor(config: FullConfig, factory: BrowserContextFactory) {
       console.log(`[DEBUG] Creating new BrowserServerBackend instance`);
       // ...
   }
   ```

   应该看到每个worker请求都创建新实例。

3. 检查MultiServerMCPClient配置：
   确认 `servers[name].transport === "http"`

### 问题4：@langchain/mcp-adapters不支持HTTP

**现象**：
```
Error: Unsupported transport type: http
```

**原因**：
`@langchain/mcp-adapters` 版本可能不支持HTTP transport。

**解决**：
1. 升级依赖：
   ```bash
   npm update @langchain/mcp-adapters
   ```

2. 或者使用原生MCP client（参考附录B）

---

## 回滚方案

如果HTTP Transport方案出现问题，可以快速回滚到STDIO：

### 回滚步骤

1. **恢复mcp-servers.json**:
   ```json
   "roxybrowser-playwright-mcp": {
       "command": "node",
       "args": [
           "/Users/will/Dev/orchestrator/roxybrowser-playwright-mcp/cli.js",
           "--roxy-mode"
       ]
   }
   ```
   （移除 `transport`, `url`, `--http-server`, `--port`）

2. **恢复McpManager.ts**（如果修改了）:
   ```typescript
   servers[name] = {
       transport: "stdio",
       command: serverConfig.command,
       args: serverConfig.args,
       env: { ...process.env, ...serverConfig.env }
   };
   ```

3. **重启orchestrator**:
   ```bash
   npm start
   ```

### 临时缓解方案

如果需要立即解决问题但HTTP方案未完成，使用快速修复：

**修改** `roxybrowser-playwright-mcp/src/context.ts:177-194`:
```typescript
async reconnectToCDP(cdpEndpoint: string): Promise<void> {
    if ('reconnectToCDP' in this._browserContextFactory) {
        const dynamicFactory = this._browserContextFactory as DynamicCdpContextFactory;
        await this.closeBrowserContext();
        this._tabs = [];  // ← 添加这一行清除tabs
        await dynamicFactory.reconnectToCDP(cdpEndpoint);
        await this._ensureBrowserContext();
    }
}
```

然后：
```bash
cd roxybrowser-playwright-mcp && npm run build
cd .. && npm start
```

---

## 附录A：添加HTTP Server支持到MCP服务器

如果 `roxybrowser-playwright-mcp` 不支持HTTP server模式，需要添加。

### A.1 检查依赖

确保 `package.json` 包含HTTP相关依赖：
```json
{
    "dependencies": {
        "@modelcontextprotocol/sdk": "^1.18.0",
        // ... 其他依赖
    }
}
```

### A.2 修改program.ts

在 `roxybrowser-playwright-mcp/src/program.ts` 中添加HTTP server选项：

```typescript
import * as mcpHttp from './mcp/http.js';

program
    .option('--http-server', 'Start HTTP server instead of STDIO')
    .option('--port <port>', 'HTTP server port', '8080')
    .option('--host <host>', 'HTTP server host', 'localhost')
    // ... 其他选项

program.action(async (options) => {
    // ... 现有代码

    if (options.httpServer) {
        // HTTP Server模式
        const factory: mcpServer.ServerBackendFactory = {
            name: 'Playwright w/ RoxyBrowser',
            nameInConfig: 'playwright-roxy',
            version: packageJSON.version,
            create: () => {
                const dynamicContextFactory = createDynamicCdpContextFactory(config);
                return new BrowserServerBackend(config, dynamicContextFactory);
            }
        };

        console.log(`[MCP] Starting HTTP server on http://${options.host}:${options.port}`);
        await mcpHttp.startHttpServer(factory, {
            port: parseInt(options.port),
            host: options.host
        });
        return;
    }

    // STDIO模式（现有代码）
    if (options.roxyMode) {
        // ... 现有STDIO代码
    }
});
```

### A.3 确认http.ts存在

检查 `roxybrowser-playwright-mcp/src/mcp/http.ts` 是否存在并包含HTTP server实现。

---

## 附录B：检查MultiServerMCPClient支持

### B.1 查看库文档

```bash
cd node_modules/@langchain/mcp-adapters
cat README.md
```

查找HTTP transport相关说明。

### B.2 查看源码

```typescript
// node_modules/@langchain/mcp-adapters/dist/index.d.ts
export class MultiServerMCPClient {
    constructor(servers: Record<string, ServerConfig>);
    // ...
}

interface ServerConfig {
    transport: 'stdio' | 'http';  // ← 确认是否支持http
    url?: string;                  // ← HTTP模式需要
    command?: string;              // ← STDIO模式需要
    args?: string[];
    env?: Record<string, string>;
}
```

### B.3 如果不支持

考虑使用原生 `@modelcontextprotocol/sdk` client：

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HttpTransport } from '@modelcontextprotocol/sdk/client/http.js';

const client = new Client({
    name: 'orchestrator',
    version: '1.0.0'
});

const transport = new HttpTransport('http://localhost:8080/sse');
await client.connect(transport);
```

---

## 总结

### 优势
✅ 根本解决browser上下文共享问题
✅ 每个worker获得独立的Backend和Context
✅ 符合多会话架构设计
✅ 扩展性好，支持未来更多并发

### 工作量
- MCP配置修改：5分钟
- Orchestrator代码修改：15分钟
- 测试验证：10分钟
- **总计：~30分钟**

### 风险
- 低：主要是配置变更，代码改动小
- 可快速回滚到STDIO模式

### 建议
1. 先在测试环境验证
2. 确保MCP服务器支持HTTP模式
3. 准备回滚方案
4. 完成后运行完整测试套件

---

## 参考文档

- MCP Protocol: https://modelcontextprotocol.io/
- LangChain MCP Adapters: https://github.com/langchain-ai/langgraphjs/tree/main/libs/mcp-adapters
- RoxyBrowser Playwright MCP: `roxybrowser-playwright-mcp/README.md`

---

**文档版本**: 1.0
**创建日期**: 2025-12-22
**最后更新**: 2025-12-22
**作者**: Claude (claude-sonnet-4-5)
