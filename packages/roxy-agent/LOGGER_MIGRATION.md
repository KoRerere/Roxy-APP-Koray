# File Logger 迁移指南

## 为什么要迁移？

`console.log` 会导致 V8 内存保留，尤其是在记录复杂对象（如 stream chunks）时，会造成内存泄漏和进程卡死。

## 快速开始

### 1. 导入 Logger

```typescript
import { createLogger } from './fileLogger'

// 创建带命名空间的 logger（推荐）
const log = createLogger('Chat')
```

### 2. 替换对照表

| 原代码 | 新代码 |
|--------|--------|
| `console.log('msg')` | `log.info('msg')` |
| `console.log('msg', obj)` | `log.info('msg', obj)` |
| `console.warn('msg')` | `log.warn('msg')` |
| `console.error('msg')` | `log.error('msg')` |
| `console.debug('msg')` | `log.debug('msg')` |

### 3. 关键原则

✅ **可以做：**
```typescript
log.info('Server started')
log.error('Request failed', { error: err.message })
log.debug('User data', { userId: '123' })
```

❌ **不要做（生产环境）：**
```typescript
// ❌ 禁止直接 log stream chunks！
log.debug('rawChunk', rawChunk)

// ❌ 即使是 fileLogger，debug 级别在生产环境也会被过滤
// 但最好还是不要写
```

## 推荐的命名空间

| 模块 | 命名空间 | 示例 |
|------|---------|------|
| server/index.ts | `Server` | `createLogger('Server')` |
| server/chatRoutes.ts | `Chat` | `createLogger('Chat')` |
| deepagents/ | `DeepAgent` | `createLogger('DeepAgent')` |
| llm/ | `LLM` | `createLogger('LLM')` |
| mcpManager.ts | `MCP` | `createLogger('MCP')` |

## 查看日志

```bash
# 日志位置
cd $CHECKPOINT_DIR/logs

# 实时查看
tail -f $(date +%Y-%m-%d).log

# 查看错误
grep ERROR $(date +%Y-%m-%d).log

# 查看特定模块
grep "\[Chat\]" $(date +%Y-%m-%d).log
```

## 已迁移文件清单

- [ ] src/server/index.ts
- [ ] src/server/chatRoutes.ts
- [ ] src/deepagents/index.ts
- [ ] src/llm/index.ts
- [ ] src/index.ts
- [ ] ... 其他文件

