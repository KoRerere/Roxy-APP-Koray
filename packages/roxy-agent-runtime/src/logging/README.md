# logging

## 1. 模块职责

提供带 scope 的结构化日志接口与可插拔 sink——通用运行信息记录，与轨迹（observability）互补。

## 2. 对外暴露的接口

契约定义在 `src/core/interfaces.ts`：

- `LogLevel` `"trace" | "debug" | "info" | "warn" | "error"`。
- `ILogger` — `child(scope)`；`trace` / `debug` / `info` / `warn` / `error`，每方法签名 `(msg, meta?)`。

实现文件：

- `logger.ts` → `ILogger` 实现（桩）。
- `sinks.ts` → `ILogSink` `{ write(level, scope, msg, meta) }`；`createConsoleSink()` / `createFileSink(path)`（桩）。

## 3. 数据示例

### 3.1 一条结构化日志（JSON 行）

```json
{
  "level": "info",
  "scope": "runtime",
  "msg": "tool executed",
  "meta": { "toolUseId": "tu_1", "name": "ls", "isError": false }
}
```

### 3.2 scope 继承

```ts
logger.child("runtime").child("graph").info("node entered", { node: "tools" });
// scope: "runtime:graph"
```

## 4. 调用时序与异常语义

- `child(scope)` 返回带前缀的子 logger，不污染父级。
- `meta` 为可选自由结构 `Record<string, unknown>`，透传给 sink。
- sink 的 `write` 同步接收已格式化的 `(level, scope, msg, meta)`；sink 自身不得抛错中断流程。
- 日志为旁路信息，**绝不影响 turn 执行**。

## 5. 协议映射 / 关键约定

- 宿主在构造 `ILogger` 时决定最低输出级别与 sink；runtime 不读取 observability 配置。
- 与 trajectory 互补：trajectory = 生命周期事件流，logging = 通用运行信息。
- 各模块通过 `AgentGraphDeps.logger`（runtime）或直接构造获得 `ILogger`。

## 6. 验收标准

- `child(scope)` 产生独立 scope 子 logger。
- 五个 level 方法透传 `(msg, meta?)` 到 sink。
- `ILogSink.write` 接收 `(level, scope, msg, meta)` 四参。
- `createConsoleSink()` / `createFileSink(path)` 返回实现 `ILogSink` 的对象。

## 7. 边界用例 / 不做清单（out of scope）

- 桩 sink 目前 `write` 抛 `NotImplementedError`。
- 禁用 pino / winston（见 ARCHITECTURE 依赖约束）；自研轻量实现。
- 不做日志聚合 / 远程上报 / 自动采样。
