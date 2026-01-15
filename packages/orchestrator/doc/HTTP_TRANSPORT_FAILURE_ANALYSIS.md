# ❌ HTTP Transport方案失败 - 深度根因分析

## 测试结果

- **Session ID**: `2025-12-22T09-36-26`
- **测试时间**: 2025-12-22 17:36-17:43
- **测试任务**: 查询test2和test4窗口的标签页(并行)
- **实施方案**: HTTP Transport + 自动子进程管理
- **测试结果**: **❌ FAILED - Worker隔离仍然失败**

---

## 🚨 关键证据：Context污染仍然存在

### Worker 1 执行时间线 (test2窗口 - 54a888fb46d42e2b7fb9c620bdac6e99)

**目标**: 查询test2窗口的标签页
**CDP连接**: `ws://127.0.0.1:55770/devtools/browser/bdfe3716-1c72-48d6-a326-86c78af1f313`

| Turn | 时间 | 操作 | 结果 | 状态 |
|------|------|------|------|------|
| 0-3 | 09:37:40 - 09:38:32 | 查询窗口列表、获取test2详情 | 找到test2窗口 | ✅ 正常 |
| 4 | 09:38:50 | `browser_connect_roxy(ws://...55770)` | 成功连接test2 | ✅ 正常 |
| 5 | 09:38:58 | `browser_tab_list()` | **显示test2的正确标签页**<br>- Tab 0: Bing<br>- Tab 1: Google | ✅ 正确 |
| 6 | 09:39:05 | `browser_tab_select(1)` | **显示test4的错误标签页！**<br>- Tab 0: 百度搜索 "multilogin"<br>- Tab 1: 工作台 (test4 ID) | ❌ **污染！** |

**证据文件**: `/Users/will/Dev/orchestrator/logs/2025-12-22T09-36-26/worker_1.log`
- Line 172-177: Turn 5 正确结果
- Line 200-204: Turn 6 错误结果

#### Turn 5 详细输出 (正确)

```json
{
  "timestamp": "2025-12-22T09:38:58.513Z",
  "turn": 5,
  "toolName": "browser_tab_list",
  "result": "### Open tabs\n- 0: (current) [Search - Microsoft Bing]\n- 1: [roxybrowser - Google Search]"
}
```

#### Turn 6 详细输出 (错误 - 看到test4内容!)

```json
{
  "timestamp": "2025-12-22T09:39:05.433Z",
  "turn": 6,
  "toolName": "browser_tab_select",
  "args": { "index": 1 },
  "result": "### Open tabs\n- 0: [multilogin_百度搜索] (https://www.baidu.com/s?...wd=multilogin...)\n- 1: (current) [工作台] (http://127.0.0.1:45535/dashboard?id=ac204c88a78201584bfbc45b9a159f5a#/)\n\n### Page state\n- Page URL: ...dashboard?id=ac204c88a78201584bfbc45b9a159f5a... (test4的ID!)\n- Page Snapshot:\n  - generic [ref=e8]: test4"
}
```

**分析**: Worker 1在Turn 5看到正确的test2标签页，但**仅6.9秒后**在Turn 6就看到了test4的内容。Context明显被污染。

---

### Worker 2 执行情况 (test4窗口 - ac204c88a78201584bfbc45b9a159f5a)

**目标**: 查询test4窗口的标签页
**CDP连接**: `ws://127.0.0.1:55774/devtools/browser/a2c3c961-e3e0-4383-a13a-4adfff938e83`

**结果**: ✅ Worker 2始终看到正确的test4标签页内容
- Tab 0: multilogin_百度搜索
- Tab 1: 工作台

**证据文件**: `/Users/will/Dev/orchestrator/logs/2025-12-22T09-36-26/worker_2.log:177`

---

## 根因分析

### HTTP Transport为何失败？

**我们的假设** (基于`PROXYBROWSER_HTTP_TRANSPORT_FIX.md`):
```
HTTP Transport架构:
  每个HTTP请求 → 独立Session → factory.create() → 新Backend实例 → 独立Context
  ✅ Worker 1: Session 1 → Backend 1 → Context 1 (test2)
  ✅ Worker 2: Session 2 → Backend 2 → Context 2 (test4)
  ✅ 完美隔离！
```

**实际观察结果**:
```
❌ Worker 1:
  - Turn 5: 看到test2内容 (Context指向test2)
  - Turn 6: 看到test4内容 (Context被切换到test4!)

⚠️  说明：即使使用HTTP Transport，Context状态仍然被共享或覆盖！
```

### 可能的根本原因

#### 假设1: HTTP Session未真正隔离

**可能性**: @langchain/mcp-adapters的HTTP客户端实现可能有问题
- 多个HTTP请求可能复用同一个session
- `StreamableHTTPServerTransport.sessionIdGenerator`可能未生效
- Backend实例可能被缓存/复用

**验证方法**:
- 在roxybrowser-playwright-mcp的http.ts中添加日志，打印每次`onsessioninitialized`的sessionId
- 检查是否真的创建了2个不同的session

#### 假设2: Context实例被单例化

**可能性**: 即使Backend是独立的，Context可能是全局单例
- 检查`roxybrowser-playwright-mcp/src/context.ts`
- 可能存在隐藏的全局变量或模块级缓存

**关键代码** (`context.ts:177-194`):
```typescript
async reconnectToCDP(cdpEndpoint: string): Promise<void> {
    await this.closeBrowserContext();
    // ⚠️  BUG: _tabs数组未清空！
    await dynamicFactory.reconnectToCDP(cdpEndpoint);
    await this._ensureBrowserContext();
}
```

#### 假设3: dynamicFactory是全局单例

**可能性**: `DynamicCdpContextFactory`可能在模块级别是单例
- `dynamicFactory` (lowercase) 可能是共享实例
- 所有Backend共享同一个factory实例
- Factory内部可能缓存了Context

**证据**: 在`context.ts`中，`dynamicFactory`是小写变量，可能是导入的单例

#### 假设4: CDP连接管理问题

**可能性**: 两个worker操作同一个Backend实例，但通过不同的CDP endpoint
- Worker 1: `reconnectToCDP(55770)` → Context切换到test2
- Worker 2: `reconnectToCDP(55774)` → Context切换到test4
- Worker 1再调用操作 → 看到的是Worker 2的Context状态

---

## 下一步调查计划

### Phase 1: 验证HTTP Session是否真正隔离

**目标**: 确认每个worker请求是否创建了独立的Backend实例

**步骤**:
1. 在`roxybrowser-playwright-mcp/src/mcp/http.ts`的`onsessioninitialized`回调中添加日志:
   ```typescript
   onsessioninitialized: async sessionId => {
       console.log(`[HTTP] New session initialized: ${sessionId}`);
       console.log(`[HTTP] Creating new Backend instance...`);
       await mcpServer.connect(serverBackendFactory, transport, true);
       console.log(`[HTTP] Backend instance created for session ${sessionId}`);
       sessions.set(sessionId, transport);
   }
   ```

2. 在`BrowserServerBackend`构造函数中添加实例ID日志:
   ```typescript
   constructor() {
       this.instanceId = Math.random().toString(36).slice(2);
       console.log(`[Backend] New instance created: ${this.instanceId}`);
   }
   ```

3. 在Context操作中打印当前Backend实例ID

4. 重新运行测试，检查日志是否显示:
   - 2个不同的sessionId
   - 2个不同的Backend instanceId
   - Worker 1操作始终使用同一个Backend ID

**预期结果**:
- ✅ 如果看到2个Backend实例，则Session隔离正常 → 问题在Context层
- ❌ 如果只看到1个Backend实例，则Session未隔离 → HTTP Transport实现有问题

### Phase 2: 检查Context生命周期

**目标**: 确认Context是否是全局单例

**步骤**:
1. 在`Context`类构造函数添加实例ID:
   ```typescript
   constructor() {
       this.contextId = Math.random().toString(36).slice(2);
       console.log(`[Context] New instance created: ${this.contextId}`);
       this._tabs = [];
   }
   ```

2. 在所有Context操作中打印contextId

3. 检查`dynamicFactory`的实现:
   ```bash
   cd roxybrowser-playwright-mcp
   grep -r "export const dynamicFactory" src/
   grep -r "export.*dynamicFactory" src/
   ```

**预期结果**:
- ✅ 如果看到2个Context实例，则问题在Context操作逻辑
- ❌ 如果只看到1个Context实例，则Context是全局单例

### Phase 3: 分析reconnectToCDP的副作用

**目标**: 理解reconnectToCDP如何影响Context状态

**步骤**:
1. 阅读`context.ts`的reconnectToCDP方法源码
2. 检查是否清空_tabs数组
3. 检查是否重置_currentTab
4. 分析dynamicFactory.reconnectToCDP的实现

**关键问题**:
- reconnectToCDP是否会影响其他Backend的Context？
- _tabs数组是否在切换CDP endpoint时被清空？
- 是否存在race condition？

### Phase 4: 实施修复

根据Phase 1-3的发现，选择修复方案:

#### 方案A: 修复Context单例问题 (如果是单例)

**修改位置**: `roxybrowser-playwright-mcp/src/context.ts`

1. 确保每个Backend创建独立的Context实例
2. 移除任何模块级的单例模式
3. 修改`reconnectToCDP`以确保状态隔离:
   ```typescript
   async reconnectToCDP(cdpEndpoint: string): Promise<void> {
       await this.closeBrowserContext();
       // ✅ 清空旧状态
       this._tabs = [];
       this._currentTab = undefined;
       await dynamicFactory.reconnectToCDP(cdpEndpoint);
       await this._ensureBrowserContext();
   }
   ```

#### 方案B: 修复HTTP Session隔离问题 (如果Session未隔离)

**修改位置**: `roxybrowser-playwright-mcp/src/mcp/http.ts` 或 `/Users/will/Dev/orchestrator/src/mcp/McpManager.ts`

1. 确保每个HTTP请求创建新session
2. 检查@langchain/mcp-adapters的HTTP客户端配置
3. 可能需要为每个worker创建独立的HTTP client

#### 方案C: 强制创建独立Backend (终极方案)

如果以上都不行，考虑在orchestrator层面隔离:

1. 每个worker spawn独立的roxybrowser-playwright-mcp子进程
2. 使用不同的端口 (8080, 8081, 8082...)
3. 完全物理隔离Backend实例

---

## 技术债务

### 已完成但无效的工作

✅ McpManager HTTP子进程管理 - 实现完成，编译通过
✅ waitForHttpServer健康检查 - 工作正常
✅ 优雅关闭逻辑 - 实现完成
❌ **Worker隔离** - 仍然失败

### 需要回滚的内容

如果最终解决方案不是HTTP Transport:
- 可能需要回退mcp-servers.json到STDIO模式
- 可能需要回退McpManager.ts的HTTP子进程代码
- 或者，保留HTTP架构，但修复roxybrowser-playwright-mcp的Bug

---

## 关键文件

### 问题证据
- `/Users/will/Dev/orchestrator/logs/2025-12-22T09-36-26/worker_1.log:172-204` - Context污染证据
- `/Users/will/Dev/orchestrator/logs/2025-12-22T09-36-26/worker_2.log:177` - Worker 2正常执行

### 需要调查的代码
- `/Users/will/Dev/orchestrator/roxybrowser-playwright-mcp/src/mcp/http.ts` - HTTP session管理
- `/Users/will/Dev/orchestrator/roxybrowser-playwright-mcp/src/context.ts` - Context生命周期
- `/Users/will/Dev/orchestrator/roxybrowser-playwright-mcp/src/backend.ts` - Backend实例化
- `/Users/will/Dev/orchestrator/roxybrowser-playwright-mcp/src/cdp/factory.ts` - dynamicFactory实现

### 已修改(可能需要调整)
- `/Users/will/Dev/orchestrator/mcp-servers.json` - HTTP transport配置
- `/Users/will/Dev/orchestrator/src/mcp/McpManager.ts` - 自动子进程管理

---

## 下一步行动

### 立即执行

1. **选择调查方法**: 用户需要决定是:
   - A. 深入调试roxybrowser-playwright-mcp源码 (添加日志，理解架构)
   - B. 尝试方案C: 每个worker独立子进程 (最简单但资源占用高)
   - C. 重新审视STDIO模式，看是否有其他修复方法

2. **添加调试日志**:
   - 在http.ts添加session创建日志
   - 在Backend添加实例ID
   - 在Context添加实例ID
   - 重新测试，分析日志

3. **验证假设**:
   - 运行Phase 1测试，确认HTTP Session是否隔离
   - 运行Phase 2测试，确认Context是否单例

### 需要用户决策

**问题**: HTTP Transport方案已被证实无效。下一步应该:
1. 继续调试HTTP Transport的根本问题？(深入roxybrowser-playwright-mcp源码)
2. 切换到更激进的隔离方案？(每worker独立子进程)
3. 重新考虑其他架构方案？(Context池化、锁机制等)

请用户选择方向。
