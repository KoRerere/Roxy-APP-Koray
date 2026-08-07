<script setup lang="ts">
import type { AgentTaskGroup } from '../types'
import TaskGroupItem from './TaskGroupItem.vue'

defineProps<{
  groups: AgentTaskGroup[]
  maxWidth: number
  minWidth: number
  monitorWidth: number
  runningCount: number
}>()

const emit = defineEmits<{
  close: []
  resizeStart: [event: PointerEvent]
  resizeStep: [delta: number]
  toggleGroup: [id: string]
}>()
</script>

<template>
  <div class="task-monitor-shell">
    <div
      class="task-monitor-resize-handle"
      role="separator"
      aria-orientation="vertical"
      :aria-label="$t('调整窗口监控宽度')"
      :aria-valuemax="maxWidth"
      :aria-valuemin="minWidth"
      :aria-valuenow="monitorWidth"
      tabindex="0"
      @keydown.left.prevent="emit('resizeStep', 16)"
      @keydown.right.prevent="emit('resizeStep', -16)"
      @pointerdown="emit('resizeStart', $event)"
    />

    <aside class="task-monitor">
      <header class="monitor-header">
        <div class="monitor-copy">
          <h2>{{ $t('窗口监控') }}</h2>
        </div>
        <button class="monitor-action" type="button" :title="$t('关闭窗口监控')" :aria-label="$t('关闭窗口监控')" @click="emit('close')">
          <SvgIcon name="roxy-agent/rx-ic-close" size="20" color="var(--color-text-primary)" />
        </button>
      </header>

      <div v-if="groups.length > 0" class="task-groups">
        <TaskGroupItem v-for="group in groups" :key="group.id" :group="group" @toggle="emit('toggleGroup', $event)" />
      </div>

      <div v-else class="task-monitor__empty">
        <p>{{ $t('没有活跃的浏览器任务') }}</p>
      </div>
    </aside>
  </div>
</template>

<style lang="scss" scoped>
.task-monitor-shell {
  position: relative;
  min-width: 0;
  min-height: 0;
  margin: 10px 10px 10px 0;
}

.task-monitor-resize-handle {
  position: absolute;
  z-index: 2;
  top: 16px;
  bottom: 16px;
  left: -5px;
  width: 10px;
  border-radius: 999px;
  cursor: col-resize;
  outline: none;

  &::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 2px;
    border-radius: inherit;
    background: transparent;
    content: '';
    transition: background-color 0.16s ease;
  }

  &:hover::after,
  &:focus-visible::after {
    background: var(--color-border-primary);
  }
}

.task-monitor {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.monitor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.monitor-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}

p {
  margin: 0;
  color: #71717a;
  font-size: 12px;
  line-height: 16px;
}

.monitor-action {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  color: var(--color-text-primary);
  box-shadow: none;
  background: transparent;
  cursor: pointer;
}

.monitor-action:hover {
  background: var(--color-bg-tertiary-hover, var(--color-border-secondary));
}

.monitor-action__x {
  position: relative;
  width: 12px;
  height: 12px;

  &::before,
  &::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 12px;
    height: 1.5px;
    border-radius: 999px;
    background: currentColor;
    content: '';
  }

  &::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  &::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }
}

.task-groups {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.task-monitor__empty {
  display: grid;
  min-height: 120px;
  place-items: center;
}
</style>
