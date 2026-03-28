<script setup lang="ts">
import type { FormattedMessage } from '/@/views/mcp/types'
import PlanningBlockVue from './planning-block.vue'
import ThinkingBlockVue from './thinking-block.vue'
import ToolCallBlockVue from './tool-call-block.vue'
import StatusMessage from './status-message.vue'
import { getBlockKey, useMessageItem } from '../composables/useMessageItem'
import { markedParse } from '/@/views/mcp/util'
import PendingAttachments from './pending-attachments.vue'

defineProps<{
  item: FormattedMessage
}>()

const { toggleThinkingExpand, isThinkingExpanded } = useMessageItem()

function isImage(mimeType: string) {
  return mimeType.startsWith('image/')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- 规划 Blocks -->
    <PlanningBlockVue v-if="item.planningState" :planning-state="item.planningState" :planning-text="item.planningText" />

    <!-- Message Blocks (按顺序渲染 thinking, content, tool_call) -->
    <template v-for="block in item.messageBlocks" :key="getBlockKey(block)">
      <!-- Thinking -->
      <ThinkingBlockVue v-if="block.type === 'thinking'" :thinking="block" :expanded="isThinkingExpanded(block.thinkingId)" @toggle="toggleThinkingExpand(block.thinkingId)" />

      <!-- Tool Call -->
      <ToolCallBlockVue v-else-if="block.type === 'tool_call'" :tool="block" :tooltip="$t('调用了 MCP 工具')" />

      <!-- Content 文本 -->
      <div v-else-if="block.type === 'content' && block.text" class="text" :class="mode.content" v-html="markedParse(block.text)" />
    </template>

    <!-- Synthesis 文本 (始终在最后) -->
    <div v-if="item.synthesisText" class="text" :class="mode.content" v-html="item.role === 'user' ? item.synthesisText : markedParse(item.synthesisText)" />

    <!-- 用户消息附件展示 -->
    <div v-if="item.role === 'user' && item.attachments?.length" class="flex flex-wrap gap-2">
      <PendingAttachments :attachments="item.attachments" />
    </div>

    <!-- Error/Interrupt 状态 -->
    <StatusMessage v-if="item.endStatus && item.endStatus !== 'done'" :status="item.endStatus" :message="item.errorMessage" />
  </div>
</template>

<style lang="scss" module="mode">
.content {
  h1 {
    margin: 14px 0;
    font-size: 16px;
  }

  h2 {
    margin: 14px 0;
    font-size: 15px;
  }

  h3,
  h4,
  h5,
  h6 {
    margin: 14px 0;
    font-size: 14px;
  }

  code {
    font-size: 12px;
    font-family: JetBrains Mono;
    color: var(--colors-text-text-tertiary);
    text-wrap: auto;
  }
}
</style>

<style lang="scss" scoped>
.text {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 1.5;
}

.planning {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.msg-attachment {
  &-img {
    max-width: 240px;
    max-height: 180px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--colors-border-border-subtle);
    display: block;
    cursor: pointer;
  }

  &-file {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--colors-border-border-subtle);
    background: var(--colors-background-bg-body);
  }

  &-name {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
