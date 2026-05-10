# 微信 IM 适配器修复说明

## 修复的问题

### 1. 对话一次后不再回复

**根本原因**：
- `get_updates_buf` 游标更新逻辑有缺陷
- 原代码在服务器返回空 cursor 时使用 `previousCursor`，但更新条件 `nextCursor !== this.getUpdatesBuf` 永远不满足
- 导致游标卡在某个位置，无法获取后续消息

**修复方案**：
```typescript
// 修复前：
const nextCursor = typeof response.get_updates_buf === 'string' && response.get_updates_buf.length > 0
  ? response.get_updates_buf
  : previousCursor  // 问题：fallback 到 previousCursor 会导致游标不更新

if (nextCursor && nextCursor !== this.getUpdatesBuf) {
  this.getUpdatesBuf = nextCursor  // 永远不会执行
}

// 修复后：
const responseCursor = response.get_updates_buf || ''

// 始终更新游标（如果服务器返回非空值）
if (responseCursor && responseCursor.length > 0) {
  this.getUpdatesBuf = responseCursor
}
```

### 2. 错误重试时游标被重置

**根本原因**：
- `runLoop` 中每次重试都执行 `this.getUpdatesBuf = ''`
- 导致在网络错误或临时故障后丢失游标位置，可能重复处理或跳过消息

**修复方案**：
```typescript
// 修复前：
private async runLoop(): Promise<void> {
  while (true) {
    try {
      this.getUpdatesBuf = ''  // ❌ 每次重试都重置
      await this.pollUpdatesLoop()
    } catch (err) {
      await sleep(RETRY_INTERVAL_MS)
    }
  }
}

// 修复后：
private async runLoop(): Promise<void> {
  while (true) {
    try {
      // ✅ 保持游标，跨重试持久化
      await this.pollUpdatesLoop()
    } catch (err) {
      console.info(`[Weixin] Retrying in ${RETRY_INTERVAL_MS}ms, current cursor: ${truncateForLog(this.getUpdatesBuf, 60)}`)
      await sleep(RETRY_INTERVAL_MS)
    }
  }
}
```

### 3. Windows 控制台乱码

**根本原因**：
- Windows 控制台默认使用 GBK 编码
- Node.js 输出 UTF-8，导致中文显示为乱码

**修复方案**：
```typescript
// logger.ts 开头添加：
if (process.platform === 'win32') {
  try {
    process.stdout.setDefaultEncoding?.('utf8')
    process.stderr.setDefaultEncoding?.('utf8')
  } catch {
    // Ignore if not supported
  }
}
```

**注意**：如果控制台仍显示乱码，用户需要手动配置 Windows 终端：
- 方法 1：运行 `chcp 65001` 切换到 UTF-8
- 方法 2：使用 Windows Terminal 并设置默认编码为 UTF-8
- 方法 3：查看日志文件（`CHECKPOINT_DIR/logs/`），文件内容始终是正确的 UTF-8

## 新增调试日志

为了更好地诊断问题，添加了以下调试日志：

```typescript
// 每次请求前打印当前 cursor
console.debug(`[Weixin] getupdates request with cursor: ${truncateForLog(previousCursor, 60)}`)

// 每次响应后打印消息数和新 cursor
console.debug(`[Weixin] getupdates response: msgs=${messages.length}, cursor=${truncateForLog(responseCursor, 60)}`)

// Cursor 更新时打印
console.debug(`[Weixin] cursor updated to: ${truncateForLog(responseCursor, 60)}`)

// 消息过滤时打印原因
console.debug(`[Weixin] skipping message: type=${message.message_type}, group=${message.group_id}`)

// 入站消息增加 type 字段
console.info(`[Weixin] inbound message: from=... type=${message.message_type} ...`)
```

## 测试建议

1. **基本功能测试**：
   - 发送第一条消息，确认回复正常
   - 连续发送多条消息（3-5条），确认每条都有回复
   - 等待 1-2 分钟后再发送消息，确认仍能回复

2. **错误恢复测试**：
   - 在对话过程中临时断网，恢复后继续发送消息
   - 重启 agent，确认能继续接收新消息

3. **日志检查**：
   - 检查日志文件（`CHECKPOINT_DIR/logs/YYYY-MM-DD.log`），确认无乱码
   - 检查 cursor 值在每次请求中正确递增
   - 确认没有重复处理相同的 `msg_id`

## 相关文件

- `packages/roxy-agent/src/im/weixin/adapter.ts` - 主适配器文件
- `packages/roxy-agent/src/logger.ts` - 日志系统
- `packages/roxy-agent/src/im/core/IMBridge.ts` - IM 桥接层
