<script setup lang="ts">
const DISPLAY_DURATION = 3000

const visible = ref(false)
const notificationKey = ref(0)
let hideTimer: ReturnType<typeof window.setTimeout> | undefined

function clearHideTimer() {
  if (hideTimer === undefined)
    return

  window.clearTimeout(hideTimer)
  hideTimer = undefined
}

function scheduleDismiss() {
  clearHideTimer()
  hideTimer = window.setTimeout(dismiss, DISPLAY_DURATION)
}

function dismiss() {
  clearHideTimer()
  visible.value = false
}

function show() {
  clearHideTimer()
  notificationKey.value += 1
  visible.value = true
}

defineExpose({ show })

onBeforeUnmount(clearHideTimer)
</script>

<template>
  <Teleport to="body">
    <Transition name="agent-copy-notification" @after-enter="scheduleDismiss">
      <div
        v-if="visible"
        :key="notificationKey"
        class="agent-copy-notification"
        role="status"
        aria-live="polite"
      >
        <span class="agent-copy-notification__content">
          <svg class="agent-copy-notification__success-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7.333" />
            <path d="m5 8 2 2 4-4" />
          </svg>
          <span>{{ $t('已复制') }}</span>
        </span>

        <button
          class="agent-copy-notification__close"
          type="button"
          :aria-label="$t('关闭')"
          @click="dismiss"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4.667 4.667 6.666 6.666m0-6.666-6.666 6.666" />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.agent-copy-notification {
  position: fixed;
  z-index: 1500;
  top: 22px;
  left: 50%;
  display: flex;
  min-width: max-content;
  height: 34px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--color-border-secondary, #e5e5e5);
  border-radius: 8px;
  background: var(--color-bg-tertiary, #f5f5f5);
  box-shadow: 0 3px 7px rgb(0 0 0 / 8%);
  box-sizing: border-box;
  color: var(--color-text-primary, #141414);
  transform: translateX(-50%);
}

.agent-copy-notification__content {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.agent-copy-notification__success-icon {
  width: 16px;
  height: 16px;
  flex: none;

  circle {
    fill: var(--color-fg-success-primary, #17b26a);
  }

  path {
    fill: none;
    stroke: var(--color-text-primary-inverse, #fcfcfc);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.2;
  }
}

.agent-copy-notification__close {
  display: grid;
  width: 16px;
  height: 16px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-fg-tertiary, #a3a3a3);
  cursor: pointer;
  place-items: center;
  transition: color 120ms ease-out;

  svg {
    width: 16px;
    height: 16px;
  }

  path {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-width: 1.4;
  }

  &:hover,
  &:focus-visible,
  &:active {
    color: var(--color-text-primary, #141414);
  }

  &:focus-visible {
    outline: 2px solid var(--color-border-primary-hover, #a3a3a3);
    outline-offset: 1px;
  }
}

@keyframes agent-copy-notification-in {
  from {
    opacity: 0;
    transform: translate3d(-50%, -42px, 0) scale(0.72);
  }

  to {
    opacity: 1;
    transform: translate3d(-50%, 0, 0) scale(1);
  }
}

@keyframes agent-copy-notification-out {
  from {
    opacity: 1;
    transform: translate3d(-50%, 0, 0) scale(1);
  }

  to {
    opacity: 0;
    transform: translate3d(-50%, -42px, 0) scale(0.72);
  }
}

@keyframes agent-copy-notification-radius-in {
  from {
    border-radius: 999px;
  }

  84% {
    border-radius: 8px;
  }

  to {
    border-radius: 8px;
  }
}

@keyframes agent-copy-notification-radius-out {
  from {
    border-radius: 8px;
  }

  84% {
    border-radius: 999px;
  }

  to {
    border-radius: 999px;
  }
}

.agent-copy-notification-enter-active,
.agent-copy-notification-leave-active {
  transform-origin: top center;
  will-change: opacity, transform, border-radius;
}

.agent-copy-notification-enter-active {
  animation:
    agent-copy-notification-in 440ms cubic-bezier(0.22, 1, 0.36, 1) both,
    agent-copy-notification-radius-in 370ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.agent-copy-notification-leave-active {
  animation:
    agent-copy-notification-out 300ms cubic-bezier(0.22, 1, 0.36, 1) both,
    agent-copy-notification-radius-out 250ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .agent-copy-notification-enter-active,
  .agent-copy-notification-leave-active {
    animation-duration: 1ms;
  }
}
</style>
