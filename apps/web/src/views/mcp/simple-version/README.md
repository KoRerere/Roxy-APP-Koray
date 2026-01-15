# Simple Version - 简化版聊天页面

这是一个简化版本的聊天页面实现，专注于基本的用户消息和 AI 消息交互。

## 功能特性

1. **用户消息显示** - 显示用户发送的消息
2. **AI 消息显示** - 显示 AI 的回复消息
3. **状态显示**：
   - `思考中...` - 当 stream 的 type 不为 'done' 时显示
   - `成功` - 当 type 为 'done' 时显示
   - `失败` - 当 type 为 'error' 时显示
4. **历史记录加载** - 支持从后端加载历史消息
5. **会话管理** - 支持创建、切换、删除会话

## 文件结构

```
simple-version/
├── types.ts                    # 简化的类型定义
├── SimpleMessageHandler.ts    # 消息处理器
├── SimpleMessageList.vue       # 消息列表组件
├── historyLoader.ts           # 历史记录加载工具
└── README.md                  # 说明文档
```

## 核心组件

### SimpleMessageHandler

消息处理器，负责：
- 处理 SSE 事件（content, done, error, user_message_id）
- 管理消息状态
- 累积 AI 消息内容
- 忽略其他复杂的事件类型（planning, worker, synthesis 等）

### SimpleMessageList

消息列表组件，负责：
- 显示用户消息和 AI 消息
- 根据状态显示不同的标签（思考中/成功/失败）
- 保持与 feature.vue 一致的样式

### historyLoader

历史记录加载工具，负责：
- 从后端 API 加载历史记录
- 将事件转换为简化的消息格式
- 根据事件类型确定 AI 消息的状态

## 使用方式

在 `simple.vue` 中导入并使用：

```vue
<script setup lang="ts">
import SimpleMessageList from './simple-version/SimpleMessageList.vue'
import { SimpleMessageHandler } from './simple-version/SimpleMessageHandler'
import { loadSimpleHistory } from './simple-version/historyLoader'

const messageHandler = new SimpleMessageHandler()
// ... 使用 messageHandler 处理事件
</script>

<template>
  <SimpleMessageList
    :messages="messages"
    :avatar="userInfo?.avatar"
    :avatar-color="userInfo?.avatarColor"
    :user-name="userInfo?.userName"
  />
</template>
```

## 事件处理流程

1. **用户发送消息** → 添加用户消息到列表
2. **接收 content 事件** → 创建 AI 消息（状态：思考中），累积内容
3. **接收 done 事件** → 更新 AI 消息状态为"成功"
4. **接收 error 事件** → 更新 AI 消息状态为"失败"

## 与 feature.vue 的区别

| 特性 | feature.vue | simple.vue |
|------|-------------|------------|
| 消息类型 | 支持所有类型（planning, worker, synthesis 等） | 只支持用户消息和 AI 消息 |
| 事件处理 | 复杂的事件路由和处理 | 简化的事件处理 |
| 状态显示 | 详细的阶段状态 | 简单的三种状态（思考中/成功/失败） |
| 组件依赖 | 使用完整的组件系统 | 使用简化的组件 |
| Multi-task | 支持 | 不支持 |
| Worker 详情 | 支持 | 不支持 |

## 注意事项

1. 所有改动都在 `simple-version` 目录中，不影响 `feature.vue` 的功能
2. 样式保持与 `feature.vue` 一致
3. 只处理必要的事件类型，忽略其他事件
4. 历史记录加载时会自动转换为简化格式
