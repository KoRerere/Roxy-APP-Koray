<script setup lang="ts">
import type { AgentTask, AgentTaskGroup } from '../types'
import type { SvgNames } from '/@/components/rx-icon'
import AgentTooltip from './AgentTooltip.vue'
import TaskStatusBadge from './TaskStatusBadge.vue'

const props = defineProps<{
  group: AgentTaskGroup
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()

const groupTitleRef = useTemplateRef<HTMLElement>('groupTitleRef')
const groupTitleOverflowed = ref(false)
let groupTitleResizeObserver: ResizeObserver | undefined

function measureGroupTitleOverflow() {
  const element = groupTitleRef.value
  groupTitleOverflowed.value = Boolean(element && element.scrollWidth > element.clientWidth + 1)
}

watch(() => props.group.title, () => nextTick(measureGroupTitleOverflow), { flush: 'post' })

onMounted(() => {
  groupTitleResizeObserver = new ResizeObserver(measureGroupTitleOverflow)
  if (groupTitleRef.value)
    groupTitleResizeObserver.observe(groupTitleRef.value)
  measureGroupTitleOverflow()
})

onBeforeUnmount(() => groupTitleResizeObserver?.disconnect())

function getTaskTitle(task: AgentTask): string {
  return task.windowName || task.name
}

function getCountryIcon(task: AgentTask): SvgNames {
  return (task.countryCode ? `country-code/${task.countryCode}` : 'roxy-agent/rx-ic-browser-control') as SvgNames
}
</script>

<template>
  <section class="task-group" :class="{ expanded: group.expanded, idle: group.kind === 'idle' }">
    <AgentTooltip
      :content="group.title"
      :disabled="!groupTitleOverflowed"
      content-class="task-group-title-tooltip"
      placement="top-start"
    >
      <button class="task-group-trigger" type="button" @click="emit('toggle', group.id)">
        <div class="group-copy">
          <SvgIcon name="roxy-agent/rx-ic-browser-control" class="group-icon" size="20" color="var(--color-text-primary)" />
          <div class="group-copy__text">
            <div ref="groupTitleRef" class="group-title">
              {{ group.kind === 'idle' ? $t('空闲中') : group.title }}
            </div>
          </div>
        </div>
        <SvgIcon :name="group.expanded ? 'base/rx_ic_chevron_down' : 'base/rx_ic_chevron_right'" class="chevron" size="16" />
      </button>
    </AgentTooltip>

    <div v-if="group.expanded" class="task-list">
      <article v-for="task in group.tasks" :key="task.id" class="task-card">
        <div class="task-account">
          <SvgIcon :name="getCountryIcon(task)" fallback="base/rx_ic_earth" class="task-flag" size="16" />
          <div class="task-user-info">
            <span class="task-name">{{ getTaskTitle(task) }}</span>
            <span v-if="task.platformUserName" class="task-separator">·</span>
            <span v-if="task.platformUserName" class="task-platform-user">{{ task.platformUserName }}</span>
          </div>
        </div>

        <div v-if="task.events?.length" class="task-current" :title="task.subtitle">
          {{ task.subtitle }}
        </div>
        <TaskStatusBadge :status="task.status" />
      </article>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.task-group {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-bg-primary);
  overflow: hidden;

  &:first-child,
  &.expanded {
    border-color: #3faaf6;
  }

  :deep(.agent-tooltip__trigger) {
    width: 100%;
    min-width: 0;
  }
}

.task-group-trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 16px;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 20px;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: #27272a;
  background: transparent;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: transparent;
  }
}

.group-copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.group-copy__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.group-icon,
.chevron {
  flex: 0 0 auto;
  color: var(--color-text-primary);
}

.group-title,
.task-name {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  border: 0;
  border-radius: 7px;
  background: var(--color-bg-tertiary);
}

.task-account {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.task-flag {
  flex: 0 0 auto;
}

.task-user-info {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.task-platform-user,
.task-separator {
  color: var(--color-text-quaternary);
}

.task-platform-user {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
}

.task-current {
  overflow: hidden;
  color: var(--color-text-quaternary);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.task-group-title-tooltip) {
  max-width: min(420px, calc(100vw - 24px));
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
