<!--
  聊天界面头部组件
-->
<script setup lang="ts">
import { usePopupMenu } from '/@/hooks/usePopupMenu'

const props = defineProps<{
  disableCreateSession?: boolean
  disableDeleteSession?: boolean
}>()

const emit = defineEmits<{
  createSession: []
  showHistory: []
  deleteSession: []
}>()

const { showMenu } = usePopupMenu()

function handleMoreClick(event: MouseEvent) {
  showMenu(event, {
    model: [
      {
        label: $t('清空会话'),
        icon: 'base/rx_ic_bin_1',
        disabled: props.disableDeleteSession,
        command: () => {
          emit('deleteSession')
        },
      },
    ],
  })
}
</script>

<template>
  <div class="header">
    <h1>{{ $t('数字员工') }}</h1>
    <div class="header-actions">
      <!-- <img
        src="/images/mcp-simple/add.svg"
        alt="新建"
        class="header-icon"
        title="新建会话"
        @click="$emit('createSession')"
      >
      <img
        src="/images/mcp-simple/history.svg"
        alt="历史"
        class="header-icon"
        title="历史记录"
        @click="$emit('showHistory')"
      > -->
      <img
        src="/images/mcp-simple/more.svg"
        alt="更多"
        class="header-icon"
        :class="{ disabled: props.disableDeleteSession }"
        title="更多选项"
        @click="!props.disableDeleteSession && handleMoreClick($event)"
      >
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  background: #ffffff;
  color: #111827;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  // border-bottom: 1px solid #e5e7eb;

  h1 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: #111827;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .header-icon {
    width: 24px;
    height: 24px;
    cursor: pointer;
    transition: opacity 0.2s;
    &:nth-child(2) {
      width: 20px;
      height: 20px;
    }

    &:hover:not(.disabled) {
      opacity: 1;
    }

    &.disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>
