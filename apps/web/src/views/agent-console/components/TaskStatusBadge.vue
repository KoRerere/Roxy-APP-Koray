<script setup lang="ts">
import type { AgentTaskStatus } from '../types'

defineProps<{
  status: AgentTaskStatus
}>()

const labels = computed<Record<AgentTaskStatus, string>>(() => ({
  running: $t('执行中'),
  idle: $t('空闲中'),
  queued: 'Queued',
  completed: 'Completed',
  failed: 'Failed',
}))
</script>

<template>
  <span class="status-badge" :class="status">
    <span class="status-icon" aria-hidden="true" />
    <span class="status-label">{{ labels[status] }}</span>
  </span>
</template>

<style lang="scss" scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0;
  border-radius: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;

  .status-icon {
    position: relative;
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
  }

  &.running {
    border: 0;
    background: transparent;

    .status-icon {
      width: 12px;
      height: 12px;
      border: 1.5px solid transparent;
      border-right-color: #f359dc;
      border-bottom-color: #f359dc;
      border-left-color: #3faaf6;
      border-radius: 999px;
      animation: task-status-spin 0.8s linear infinite;
    }

    .status-label {
      color: transparent;
      background: var(--agent-gradient);
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }

  &.queued {
    color: #f79009;
    background: transparent;

    .status-icon {
      &::before,
      &::after {
        position: absolute;
        left: 4px;
        width: 8px;
        height: 6px;
        border: 1.4px solid currentColor;
        content: '';
      }

      &::before {
        top: 2px;
        border-bottom: 0;
        transform: skewX(-16deg);
      }

      &::after {
        bottom: 2px;
        border-top: 0;
        transform: skewX(16deg);
      }
    }
  }

  &.idle {
    color: var(--color-text-quaternary);

    .status-icon {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: currentColor;
    }
  }

  &.completed {
    color: #17b26a;
    background: transparent;

    .status-icon {
      border-radius: 999px;

      &::before {
        position: absolute;
        top: 3px;
        left: 5px;
        width: 5px;
        height: 8px;
        border-right: 1.6px solid currentColor;
        border-bottom: 1.6px solid currentColor;
        content: '';
        transform: rotate(45deg);
      }
    }
  }

  &.failed {
    color: #f04438;
    background: transparent;

    .status-icon {
      &::before,
      &::after {
        position: absolute;
        top: 7px;
        left: 3px;
        width: 10px;
        height: 1.6px;
        border-radius: 999px;
        background: currentColor;
        content: '';
      }

      &::before {
        transform: rotate(45deg);
      }

      &::after {
        transform: rotate(-45deg);
      }
    }
  }
}

@keyframes task-status-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-badge.running .status-icon {
    animation: none;
  }
}
</style>
