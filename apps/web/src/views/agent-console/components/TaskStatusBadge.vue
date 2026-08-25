<script setup lang="ts">
import type { AgentTaskStatus } from '../types'
import GridLoaderIcon from '/@/assets/icons/roxy-agent/grid-loader.svg?component'

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
    <GridLoaderIcon v-if="status === 'running'" class="status-icon" aria-hidden="true" />
    <span v-else class="status-icon" aria-hidden="true" />
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
      width: 10px;
      height: 10px;
      color: var(--color-text-primary);
    }

    .status-label {
      --status-shimmer-solid: #141414;
      --status-shimmer-fade: rgb(20 20 20 / 45%);

      color: transparent;
      background: linear-gradient(
        90deg,
        var(--status-shimmer-solid) 0%,
        var(--status-shimmer-solid) 30%,
        var(--status-shimmer-fade) 45%,
        var(--status-shimmer-fade) 55%,
        var(--status-shimmer-solid) 70%,
        var(--status-shimmer-solid) 100%
      );
      background-size: 300% 100%;
      background-clip: text;
      font-size: 13px;
      font-weight: 500;
      line-height: 18px;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: status-label-shine 2.25s cubic-bezier(0.25, 0.1, 0.25, 1) infinite;
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

:global(html[data-theme='dark'] body.agent-console-window .status-badge.running .status-label),
:global(html.app-dark body.agent-console-window .status-badge.running .status-label),
:global(body.agent-console-window[data-theme='dark'] .status-badge.running .status-label) {
  --status-shimmer-solid: #fcfcfc;
  --status-shimmer-fade: rgb(252 252 252 / 45%);
}

@keyframes status-label-shine {
  0%,
  18% {
    background-position: 100% 0;
  }

  82%,
  100% {
    background-position: 0% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-badge.running .status-label {
    color: var(--color-text-primary);
    background: none;
    -webkit-text-fill-color: currentColor;
    animation: none;
  }
}
</style>
