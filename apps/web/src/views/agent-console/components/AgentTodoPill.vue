<script setup lang="ts">
import type { AgentTodoProgress } from '../types'

const props = defineProps<{
  progress: AgentTodoProgress
}>()

const todos = computed(() => {
  if (props.progress.todos.length)
    return props.progress.todos

  return props.progress.content
    ? [{
        id: props.progress.id,
        content: props.progress.content,
        status: 'in_progress' as const,
      }]
    : []
})
</script>

<template>
  <div class="agent-todo">
    <div class="agent-todo-pill">
      <span class="agent-todo-pill__spinner" aria-hidden="true" />
      <span>{{ $t('第 {current}/{total} 步', { current: progress.current, total: progress.total }) }}</span>
    </div>

    <div v-if="todos.length" class="agent-todo-popover">
      <div class="agent-todo-popover__list">
        <div
          v-for="todo in todos"
          :key="todo.id"
          class="agent-todo-popover__item"
          :class="`agent-todo-popover__item--${todo.status}`"
        >
          <SvgIcon
            v-if="todo.status === 'completed'"
            name="roxy-agent/rx-ic-circle-check"
            color="var(--color-fg-disabled,#A3A3A3)"
            size="18"
          ></SvgIcon>
          <span
            v-else
            class="agent-todo-popover__icon"
            aria-hidden="true"
          ></span>
          <span class="agent-todo-popover__text">{{ todo.content }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.agent-todo {
  position: relative;
  display: inline-flex;
  justify-content: center;
}

.agent-todo-pill {
  display: inline-flex;
  padding: 8px 12px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 40px;
  border: 1px solid var(--color-border-primary);
  color: #000;
  background: #FFF;
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.agent-todo-pill__spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border: 1.5px solid transparent;
  border-top-color: #000;
  border-left-color: #000;
  border-radius: 999px;
  box-sizing: border-box;
  animation: agent-todo-spin 0.9s linear infinite;
}

@keyframes agent-todo-spin {
  to {
    transform: rotate(360deg);
  }
}

.agent-todo-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  z-index: 10;
  display: block;
  width: min(384px, calc(100vw - 32px));
  padding: 12px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 12px;
  color: var(--color-text-primary, var(--color-text-primary));
  background: var(--color-bg-primary, var(--color-bg-primary));
  box-shadow: 0 8px 24px rgba(15, 15, 15, 0.12);
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(4px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
  visibility: hidden;
}

.agent-todo-popover::after {
  position: absolute;
  right: 0;
  bottom: -8px;
  left: 0;
  height: 8px;
  content: '';
}

.agent-todo:hover .agent-todo-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%);
  visibility: visible;
}

.agent-todo-popover__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-todo-popover__item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  box-sizing: border-box;
  color: var(--color-text-primary, var(--color-text-primary));
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.agent-todo-popover__item--completed {
  color: var(--color-text-quaternary, #737373);
}

.agent-todo-popover__icon {
  position: relative;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  box-sizing: border-box;
  animation: agent-todo-spin 0.9s linear infinite;
}

.agent-todo-popover__item--completed .agent-todo-popover__icon {
  color: #a3a3a3;
}

.agent-todo-popover__check {
  position: absolute;
  top: 4px;
  left: 3px;
  width: 8px;
  height: 4px;
  border-bottom: 1.5px solid currentColor;
  border-left: 1.5px solid currentColor;
  transform: rotate(-45deg);
  transform-origin: center;
}

.agent-todo-popover__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
