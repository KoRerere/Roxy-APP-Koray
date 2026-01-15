# Worker Isolation Architecture

## Table of Contents
1. [Overview](#overview)
2. [Problem Background](#problem-background)
3. [Architecture Evolution](#architecture-evolution)
4. [Why HTTP Transport is Required](#why-http-transport-is-required)
5. [Implementation Details](#implementation-details)
6. [Configuration Guide](#configuration-guide)
7. [Testing and Verification](#testing-and-verification)
8. [Performance Analysis](#performance-analysis)
9. [Troubleshooting](#troubleshooting)
10. [Future Optimizations](#future-optimizations)

---

## Overview

The Orchestrator implements **per-worker process isolation** for MCP (Model Context Protocol) tools, ensuring complete context separation between parallel workers. This architecture prevents context pollution and enables true parallel task execution.

**Key Features:**
- ✅ Each worker spawns an independent HTTP server subprocess
- ✅ Isolated Backend instances prevent context pollution
- ✅ Dynamic port allocation (starting from 23333)
- ✅ Automatic orphaned process cleanup
- ✅ Graceful shutdown with signal handlers

This document explains why HTTP transport is **required** (not optional) and cannot be reverted to STDIO mode.

---

## Problem Background

### Context Pollution Issue

During parallel worker execution, we discovered a critical issue: **Worker A could see Worker B's browser windows/tabs**.

**Example Scenario:**
```
Worker 1: "Open test.com and get the title"
Worker 2: "Open example.com and get the title"

Expected: Worker 1 sees only test.com, Worker 2 sees only example.com
Actual: Both workers saw both windows (test.com AND example.com)
```

**Root Cause:** Workers were sharing the same Backend instance in the MCP server (roxybrowser-playwright-mcp), causing their browser contexts to overlap.

**Impact:**
- Workers interfered with each other's state
- Results contained data from other workers
- Parallel execution was not truly isolated
- Unreliable multi-agent behavior

---

## Architecture Evolution

### Stage 1: STDIO Single Backend ❌ (Failed)

**Configuration:**
```json
{
  "mcpServers": {
    "roxybrowser-playwright-mcp": {
      "transport": "stdio",
      "command": "node",
      "args": ["cli.js", "--roxy-mode"]
    }
  }
}
```

**Architecture:**
```
┌─────────┐     ┌─────────┐
│Worker 1 │────▶│         │
└─────────┘     │  STDIO  │     ┌──────────────┐
                │Transport│────▶│Single Backend│
┌─────────┐     │         │     │  (Shared!)   │
│Worker 2 │────▶│         │     └──────────────┘
└─────────┘     └─────────┘
```

**Problem:** STDIO transport creates **ONE** Backend instance shared by all workers.

**Why it Failed:**
- `MultiServerMCPClient` with STDIO spawns a single MCP server process
- All workers connect to the same process
- roxybrowser-playwright-mcp reuses the same Backend instance for all connections
- No way to isolate contexts

---

### Stage 2: HTTP Single Subprocess ❌ (Failed)

**Attempt:** Spawn ONE HTTP server and have all workers connect to it.

**Architecture:**
```
┌─────────┐     ┌─────────────┐
│Worker 1 │────▶│             │
└─────────┘     │HTTP :23333  │     ┌──────────────┐
                │             │────▶│Single Backend│
┌─────────┐     │             │     │  (Shared!)   │
│Worker 2 │────▶│             │     └──────────────┘
└─────────┘     └─────────────┘
```

**Problem:** Still shared Backend! HTTP transport alone doesn't guarantee isolation.

**Why it Failed:**
- One HTTP server process = One Backend instance
- Multiple HTTP clients connecting to the same server share the same Backend
- Context pollution persisted

---

### Stage 3: HTTP Multi-Subprocess ✅ (Success)

**Architecture:**
```
┌─────────┐     ┌─────────────┐     ┌──────────────┐
│Worker 1 │────▶│HTTP :23333  │────▶│Backend #1    │
└─────────┘     └─────────────┘     │(Isolated)    │
                                     └──────────────┘

┌─────────┐     ┌─────────────┐     ┌──────────────┐
│Worker 2 │────▶│HTTP :23334  │────▶│Backend #2    │
└─────────┘     └─────────────┘     │(Isolated)    │
                                     └──────────────┘
```

**Key Insight:** **One HTTP server subprocess per worker = One Backend per worker**

**Why it Works:**
- Each worker spawns its own HTTP server process
- Each HTTP server process creates its own Backend instance
- Complete process-level isolation
- No shared state between workers

---

## Why HTTP Transport is Required

### STDIO vs HTTP Comparison

| Feature | STDIO Transport | HTTP Transport (Multi-Process) |
|---------|----------------|-------------------------------|
| **Process Count** | 1 shared process | N independent processes (1 per worker) |
| **Backend Instances** | 1 shared Backend | N isolated Backends |
| **Context Isolation** | ❌ Shared | ✅ Isolated |
| **Worker Interference** | ✅ Yes (context pollution) | ❌ No |
| **Port Usage** | None | 23333, 23334, 23335... |
| **Memory Overhead** | ~50MB | ~50MB × N workers |
| **Startup Time** | Fast (~100ms) | Slower (~500ms per worker) |
| **Can Revert?** | **NO** | Required for isolation |

### Backend Instance Isolation Principle

**How roxybrowser-playwright-mcp Works:**

```typescript
// Inside roxybrowser-playwright-mcp server
class McpServer {
  private backend: Backend;  // ONE Backend per server process

  constructor() {
    this.backend = new Backend();  // Created once at startup
  }

  async handleRequest(request) {
    return this.backend.execute(request);  // All requests share this Backend
  }
}
```

**Key Point:** The Backend is created **once per process**, not per connection.

**STDIO Mode:**
- 1 server process → 1 Backend → All workers share it

**HTTP Multi-Process Mode:**
- Worker 1 → Server process on :23333 → Backend #1
- Worker 2 → Server process on :23334 → Backend #2
- Complete isolation!

### Why Reverting to STDIO is Impossible

**Question:** "Now that we have worker isolation, can we revert HTTP transport?"

**Answer:** **NO.** HTTP transport IS the mechanism that enables worker isolation.

Without HTTP multi-process architecture:
- No way to create multiple Backend instances
- Workers will share state again
- Context pollution will return
- Parallel execution will break

HTTP transport is **fundamental** to the architecture, not optional.

---

## Implementation Details

### McpManager Refactoring

**Key Changes:**
1. **From Singleton to Multi-Instance Management**
2. **Map-Based Storage:**
   ```typescript
   private workerClients: Map<string, MultiServerMCPClient> = new Map();
   private workerTools: Map<string, StructuredTool[]> = new Map();
   private workerHttpServers: Map<string, ChildProcess> = new Map();
   ```
3. **Atomic Port Counter:**
   ```typescript
   private basePort: number = 23333;
   private portCounter: number = 0;  // Atomic increment to avoid race conditions
   ```

**File:** `src/mcp/McpManager.ts`

### Worker Lifecycle

**1. Worker Creation** (`createWorkerClient(workerId)`):

```typescript
async createWorkerClient(workerId: string): Promise<void> {
  // 1. Allocate port atomically
  let port = this.basePort + this.portCounter++;

  // 2. Verify port availability (retry up to 10 times)
  while (!(await this.isPortAvailable(port))) {
    port = this.basePort + this.portCounter++;
  }

  // 3. Spawn HTTP server subprocess
  const child = spawn(serverConfig.command, [
    ...serverConfig.args,
    '--port', port.toString()
  ]);

  // 4. Wait for server to be ready
  await this.waitForHttpServer(`http://localhost:${port}/mcp`);

  // 5. Create isolated MCP client
  const client = new MultiServerMCPClient({
    [name]: { transport: "http", url: `http://localhost:${port}/mcp` }
  });
  await client.initializeConnections();

  // 6. Store client, tools, and subprocess
  this.workerClients.set(workerId, client);
  this.workerTools.set(workerId, await client.getTools());
  this.workerHttpServers.set(workerId, child);
}
```

**2. Worker Execution:**
- Worker calls `mcpManager.getToolsForWorker(workerId)`
- Gets isolated tool instances for this worker only
- Executes tasks with its own Backend

**3. Worker Destruction** (`destroyWorkerClient(workerId)`):

```typescript
async destroyWorkerClient(workerId: string): Promise<void> {
  // 1. Close MCP client
  const client = this.workerClients.get(workerId);
  if (client) {
    await client.close();
    this.workerClients.delete(workerId);
    this.workerTools.delete(workerId);
  }

  // 2. Gracefully kill HTTP server
  const child = this.workerHttpServers.get(workerId);
  if (child && !child.killed) {
    child.kill('SIGTERM');  // Try graceful shutdown

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');  // Force kill after 2s
        resolve();
      }, 2000);

      child.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.workerHttpServers.delete(workerId);
  }
}
```

### Port Management

**Base Port:** 23333 (chosen to avoid common ports like 8080, 3000, etc.)

**Allocation Strategy:**
```typescript
// Atomic counter prevents race conditions in concurrent worker creation
private portCounter: number = 0;

// Worker 1: port = 23333 + 0 = 23333
// Worker 2: port = 23333 + 1 = 23334
// Worker 3: port = 23333 + 2 = 23335
const port = this.basePort + this.portCounter++;
```

**Port Availability Check:**
```typescript
private async isPortAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(1000)
    });
    return false;  // Port occupied (got response)
  } catch (error) {
    return true;   // Port available (connection failed)
  }
}
```

**Retry Mechanism:**
- If port is occupied, try next port (counter++)
- Up to 10 retries
- Prevents failures from orphaned processes

### Orphaned Process Cleanup

**Startup Cleanup** (`cleanupOrphanedProcesses()`):

```typescript
async cleanupOrphanedProcesses(): Promise<void> {
  console.log('[MCP] Checking for orphaned HTTP server processes...');

  for (let port = this.basePort; port < this.basePort + 10; port++) {
    const isAvailable = await this.isPortAvailable(port);
    if (!isAvailable) {
      console.log(`[MCP] Found orphaned process on port ${port}, attempting cleanup...`);

      try {
        // Find process using the port
        const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();

        if (output) {
          const pids = output.split('\n');
          for (const pid of pids) {
            console.log(`[MCP] Killing orphaned process ${pid} on port ${port}`);
            execSync(`kill -9 ${pid}`);
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        if (!error.message?.includes('lsof: no')) {
          console.warn(`[MCP] Failed to cleanup port ${port}:`, error.message);
        }
      }
    }
  }

  console.log('[MCP] Orphaned process cleanup complete');
}
```

**When it Runs:**
- On application startup (`src/index.ts`)
- Before creating any workers
- Scans ports 23333-23343
- Kills any lingering processes from previous crashes

**Graceful Shutdown** (Signal Handlers in `src/index.ts`):

```typescript
const cleanup = async () => {
  console.log("\n\n🧹 Cleaning up...");
  await mcpManager.close();  // Kills all worker HTTP servers
  console.log("✅ Cleanup complete. Goodbye!\n");
  process.exit(0);
};

process.on('SIGINT', cleanup);   // Ctrl+C
process.on('SIGTERM', cleanup);  // kill command
process.on('SIGHUP', cleanup);   // Terminal close
```

---

## Configuration Guide

### mcp-servers.json

**Location:** `/Users/will/Dev/orchestrator/mcp-servers.json`

**Configuration:**
```json
{
  "mcpServers": {
    "roxybrowser-playwright-mcp": {
      "transport": "http",
      "command": "node",
      "args": [
        "/path/to/roxybrowser-playwright-mcp/cli.js",
        "--roxy-mode"
      ],
      "url": "http://localhost:23333/mcp"
    }
  }
}
```

**Important Notes:**

1. **`transport: "http"` is REQUIRED:**
   - Do NOT change to `"stdio"`
   - Worker isolation depends on HTTP transport

2. **`url` field is overridden:**
   - McpManager dynamically allocates ports
   - Worker 1: `http://localhost:23333/mcp`
   - Worker 2: `http://localhost:23334/mcp`
   - Configuration URL is ignored

3. **`--port` argument is overridden:**
   - McpManager injects `--port 23333`, `--port 23334`, etc.
   - Remove any static port from args

4. **Command and args:**
   - Must point to the MCP server executable
   - Use absolute paths or ensure PATH is set

### Environment Variables

**`.env` file:**
```env
# MCP Configuration
MCP_BASE_PORT=23333          # Base port for HTTP servers (default: 23333)
DEBUG=true                   # Enable verbose MCP logging

# Other settings
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.7-sonnet
```

**Variables:**
- `MCP_BASE_PORT`: Base port for worker HTTP servers (default: 23333)
- `DEBUG`: When `true`, shows detailed worker creation/destruction logs

**Future Variables** (not yet implemented):
- `MAX_CONCURRENT_WORKERS`: Limit maximum parallel workers

---

## Testing and Verification

### Basic Isolation Test

**Test Scenario:** Verify workers cannot see each other's browser windows.

**Steps:**
1. Enable DEBUG mode: `DEBUG=true npm start`
2. Send query that spawns 2+ workers:
   ```
   You: "Visit test2.com in one worker and test4.com in another, then tell me what windows each worker sees"
   ```
3. Check worker logs:
   ```
   logs/
   └── 2025-01-15T10-30-45/
       ├── planning.json
       ├── worker_1.log
       ├── worker_2.log
       └── synthesis.json
   ```

**Expected Results:**
- Worker 1 log shows only test2.com window
- Worker 2 log shows only test4.com window
- No cross-contamination

**Verification:**
```bash
# Check worker 1 log
cat logs/latest/worker_1.log | grep "test4.com"
# Should return NOTHING

# Check worker 2 log
cat logs/latest/worker_2.log | grep "test2.com"
# Should return NOTHING
```

### DEBUG Mode

Enable detailed logging:
```bash
DEBUG=true npm start
```

**Expected Output:**
```
[MCP] Checking for orphaned HTTP server processes...
[MCP] Orphaned process cleanup complete
[MCP] Loading config from /Users/will/Dev/orchestrator/mcp-servers.json
[MCP] Config loaded

[DEBUG] ChatManager: Sending message: Compare test2.com and test4.com
[DEBUG] Auto-router routed to: orchestrator
[DEBUG] Starting Orchestrator Flow

[MCP] Creating isolated client for worker worker_1...
[MCP] Allocated port 23333 for worker worker_1
[MCP:worker_1] Starting HTTP server for roxybrowser-playwright-mcp on port 23333...
[MCP] Waiting for HTTP server at http://localhost:23333/mcp...
[MCP] HTTP server ready at http://localhost:23333/mcp
[MCP] Worker worker_1: created client, spawned server on port 23333, loaded 5 tools

[MCP] Creating isolated client for worker worker_2...
[MCP] Allocated port 23334 for worker worker_2
[MCP:worker_2] Starting HTTP server for roxybrowser-playwright-mcp on port 23334...
[MCP] HTTP server ready at http://localhost:23334/mcp
[MCP] Worker worker_2: created client, spawned server on port 23334, loaded 5 tools

[DEBUG] Worker worker_1: Task completed
[DEBUG] Worker worker_2: Task completed

[MCP] Destroying client for worker worker_1...
[MCP:worker_1] HTTP server exited (code: 0, signal: SIGTERM)
[MCP] Worker worker_1: client destroyed

[MCP] Destroying client for worker worker_2...
[MCP:worker_2] HTTP server exited (code: 0, signal: SIGTERM)
[MCP] Worker worker_2: client destroyed
```

### Port Checking

**Check active MCP servers:**
```bash
lsof -i :23333-23343
```

**Expected Output (during execution):**
```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    12345   user   20u  IPv6  0x...      0t0  TCP *:23333 (LISTEN)
node    12346   user   20u  IPv6  0x...      0t0  TCP *:23334 (LISTEN)
```

**Expected Output (after cleanup):**
```
(empty - all processes killed)
```

**Kill orphaned processes manually:**
```bash
lsof -ti :23333-23343 | xargs kill -9
```

---

## Performance Analysis

### Resource Consumption

**Memory Usage:**
- **Base Orchestrator:** ~100MB
- **Per Worker:** +50MB (HTTP server + Backend + Playwright)
- **Example:**
  - 0 workers: 100MB
  - 2 workers: 200MB
  - 5 workers: 350MB

**CPU Usage:**
- Worker creation: Brief spike (~10-20% per worker)
- Idle: Negligible
- Execution: Depends on task (browser operations can be CPU-intensive)

**Disk I/O:**
- Session logs: ~1-10KB per worker
- Playwright cache: First run downloads browsers (~300MB one-time)

### Startup Latency

**Worker Creation Time:**
- Port allocation: <1ms
- HTTP server spawn: ~200ms
- Server ready wait: ~300ms
- MCP client init: ~100ms
- **Total per worker:** ~500-600ms

**Parallel Creation:**
- Workers are created in parallel
- 5 workers: ~500ms total (not 2500ms)
- Acceptable for most use cases

### Scalability Recommendations

**Suitable Scenarios:**
✅ Worker count: 1-10
✅ Memory: >= 8GB RAM
✅ Complex research tasks requiring isolation
✅ Browser automation with parallel browsing

**Not Suitable:**
❌ High-frequency micro-tasks (>100 workers/minute)
❌ Memory-constrained environments (<4GB RAM)
❌ Ultra-low latency requirements (<100ms)
❌ Simple tasks that don't need isolation

**Recommended Limits:**
- **Max concurrent workers:** 10
- **Memory budget:** 1GB (100MB base + 10 × 50MB + buffer)
- **Port range:** 23333-23343 (supports up to 10 workers)

---

## Troubleshooting

### Common Issues

#### Issue 1: Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::23333
```

**Cause:** Orphaned HTTP server process from previous crash or incomplete shutdown.

**Solution:**

**Option A: Restart Application** (Automatic cleanup)
```bash
npm start
# Orchestrator runs cleanupOrphanedProcesses() on startup
```

**Option B: Manual Cleanup**
```bash
# Find process using port
lsof -ti :23333

# Kill it
lsof -ti :23333 | xargs kill -9

# Or kill all MCP servers
lsof -ti :23333-23343 | xargs kill -9
```

**Option C: Change Base Port**
```env
# .env file
MCP_BASE_PORT=24000  # Use different port range
```

---

#### Issue 2: Workers See Each Other's Context

**Symptom:** Worker A sees windows/tabs from Worker B.

**Cause:** MCP configuration is using STDIO transport (shared Backend).

**Diagnosis:**
```bash
# Check mcp-servers.json
cat mcp-servers.json | grep "transport"
```

**Expected:** `"transport": "http"`
**Problem:** `"transport": "stdio"`

**Solution:**
```json
{
  "mcpServers": {
    "roxybrowser-playwright-mcp": {
      "transport": "http",  // ← MUST be "http"
      "command": "node",
      "args": ["/path/to/cli.js", "--roxy-mode"]
    }
  }
}
```

**Verify Fix:**
```bash
DEBUG=true npm start
# Should see: "Allocated port 23333 for worker worker_1"
# Should see: "Allocated port 23334 for worker worker_2"
```

---

#### Issue 3: Worker Creation Timeout

**Symptom:**
```
Error: HTTP server at http://localhost:23333/mcp did not become ready after 6000ms
```

**Possible Causes:**
1. Port is occupied (firewall/other process)
2. MCP server failed to start
3. Network configuration issue

**Diagnosis:**

**Check if port responds:**
```bash
curl -I http://localhost:23333/mcp
```

**Check MCP server logs:**
```bash
DEBUG=true npm start
# Look for stderr output from MCP server
```

**Check process exists:**
```bash
lsof -i :23333
```

**Solutions:**

**If port is occupied:**
```bash
lsof -ti :23333 | xargs kill -9
```

**If MCP server crashes:**
- Check MCP server dependencies (Playwright installed?)
- Verify command path in mcp-servers.json
- Run MCP server manually to see errors:
  ```bash
  node /path/to/cli.js --roxy-mode --port 23333
  ```

**If network issue:**
- Check localhost resolution: `ping localhost`
- Try IPv4 explicitly: `curl http://127.0.0.1:23333/mcp`

---

#### Issue 4: Memory Exhaustion

**Symptom:** Application crashes with `JavaScript heap out of memory`

**Cause:** Too many concurrent workers (each worker = +50MB)

**Diagnosis:**
```bash
# Monitor memory during execution
top -pid $(pgrep -f "node.*orchestrator")
```

**Solutions:**

**Reduce worker count:**
- Use `/mode simple` for simple queries
- Manually limit subtasks in planning

**Increase Node.js memory:**
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

**Future:** Implement MAX_CONCURRENT_WORKERS environment variable

---

#### Issue 5: Orphaned Processes After Crash

**Symptom:** Multiple node processes remain after Ctrl+C or crash

**Check:**
```bash
ps aux | grep roxybrowser-playwright-mcp
lsof -i :23333-23343
```

**Cause:** Signal handlers didn't execute (e.g., force quit, system crash)

**Solution:**

**Manual cleanup:**
```bash
# Kill all orphaned MCP servers
pkill -f "roxybrowser-playwright-mcp"

# Or by port
lsof -ti :23333-23343 | xargs kill -9
```

**Prevention:** Always use Ctrl+C (SIGINT) instead of kill -9

---

## Future Optimizations

### Optimization 1: Process Pool

**Current Behavior:**
- Workers created on-demand (~500ms startup)
- Workers destroyed immediately after task completion

**Proposed:**
- Pre-create 3 idle HTTP server processes at startup
- Workers reuse processes from the pool
- Reduces latency from 500ms to ~50ms

**Implementation:**
```typescript
class McpManager {
  private processPool: ChildProcess[] = [];

  async initializePool(size: number = 3) {
    for (let i = 0; i < size; i++) {
      const child = await this.spawnHttpServer(23333 + i);
      this.processPool.push(child);
    }
  }

  async createWorkerClient(workerId: string) {
    const child = this.processPool.pop() || await this.spawnHttpServer();
    // Use existing process instead of spawning
  }
}
```

**Benefits:**
- Faster worker creation
- Predictable resource usage

**Tradeoffs:**
- Higher baseline memory (3 × 50MB = 150MB)
- Idle resource consumption

---

### Optimization 2: Smart Process Reuse

**Current Behavior:**
- Worker finishes → HTTP server killed immediately

**Proposed:**
- Worker finishes → Keep process alive for 30 seconds
- If new worker requested → Reuse existing process
- After 30s idle → Kill process

**Implementation:**
```typescript
class McpManager {
  private reusableProcesses: Map<number, { child: ChildProcess, timeout: NodeJS.Timeout }> = new Map();

  async destroyWorkerClient(workerId: string) {
    const child = this.workerHttpServers.get(workerId);
    const port = this.getPortForWorker(workerId);

    // Don't kill immediately - mark as reusable
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      this.reusableProcesses.delete(port);
    }, 30000);

    this.reusableProcesses.set(port, { child, timeout });
  }

  async createWorkerClient(workerId: string) {
    // Try to reuse existing process first
    for (const [port, { child, timeout }] of this.reusableProcesses) {
      clearTimeout(timeout);
      this.reusableProcesses.delete(port);
      // Reuse this process
      return;
    }

    // No reusable process - spawn new one
    await this.spawnHttpServer();
  }
}
```

**Benefits:**
- Near-instant worker creation for sequential tasks
- Reduced CPU overhead (no spawn/kill churn)

**Tradeoffs:**
- Slightly higher average memory usage

---

### Optimization 3: Resource Limits

**Current Behavior:**
- No limit on concurrent workers
- Can exhaust memory with large plans

**Proposed:**
- Environment variable: `MAX_CONCURRENT_WORKERS=5`
- Queue workers if limit exceeded
- Execute in batches

**Implementation:**
```typescript
// In orchestrator.ts
export function routeOrchestrator(state: typeof AgentState.State) {
  const maxWorkers = parseInt(process.env.MAX_CONCURRENT_WORKERS || '10', 10);
  const plan = state.plan || [];

  // Batch workers
  const batches = [];
  for (let i = 0; i < plan.length; i += maxWorkers) {
    batches.push(plan.slice(i, i + maxWorkers));
  }

  // Execute first batch
  return batches[0].map(task => new Send("worker", { task }));
}
```

**Benefits:**
- Prevents memory exhaustion
- Graceful degradation
- Configurable resource usage

**Tradeoffs:**
- Slower execution for large plans (batched instead of parallel)

---

## Related Documentation

- **Main README:** [README.md](./README.md)
- **Orchestrator Design:** [doc/ORCHESTRATOR_DESIGN.md](./doc/ORCHESTRATOR_DESIGN.md)
- **MCP Protocol Specification:** [Model Context Protocol](https://modelcontextprotocol.io/)
- **roxybrowser-playwright-mcp:** [GitHub Repository](https://github.com/ruvnet/roxybrowser-playwright-mcp)
- **LangGraph Multi-Agent Patterns:** [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)

---

## Summary

**Key Takeaways:**

1. **HTTP transport is REQUIRED** - Cannot be reverted to STDIO mode
2. **One process per worker** - This is fundamental to isolation
3. **Port range 23333-23343** - Supports up to 10 concurrent workers
4. **Automatic cleanup** - Orphaned processes are cleaned on startup
5. **Graceful shutdown** - Signal handlers ensure proper cleanup
6. **Memory cost: ~50MB per worker** - Plan capacity accordingly
7. **Startup latency: ~500ms per worker** - Acceptable for parallel creation

**Design Principles:**

- **Isolation > Performance** - We chose process isolation over speed
- **Robustness > Efficiency** - Automatic cleanup prevents resource leaks
- **Simplicity > Optimization** - Current design is straightforward, optimizations can be added later

**Next Steps:**

- Monitor memory usage in production
- Collect metrics on worker creation times
- Implement process pool if latency becomes an issue
- Add MAX_CONCURRENT_WORKERS if memory is constrained
