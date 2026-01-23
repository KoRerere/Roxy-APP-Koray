<script setup lang="ts">
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'

const { onboardingTaskStatus } = useOnboardingTaskStatus()
const progress = computed(() => {
  const task = [
    onboardingTaskStatus.value?.createProfileStatus,
    onboardingTaskStatus.value?.createProxyStatus,
    onboardingTaskStatus.value?.inviteMemberStatus,
  ]
  return 1 - task.filter(Boolean).length / task.length
})
</script>

<template>
  <svg class="progress" width="20" height="20" viewBox="0 0 36 36">
    <circle class="progress-bg" cx="18" cy="18" r="14" />
    <circle class="progress-value" cx="18" cy="18" r="14" :style="{ '--progress': progress }" />
  </svg>
</template>

<style lang="scss" scoped>
.progress {
  transform: rotate(-90deg);

  &-value {
    fill: none;
    stroke-width: 4.5;
    stroke: var(--colors-background-bg-brand);
    stroke-linecap: round;
    stroke-dasharray: calc(2 * 3.14159 * 14);
    stroke-dashoffset: calc(2 * 3.14159 * 14 * var(--progress));
  }

  &-bg {
    fill: none;
    stroke: var(--pattern-sidenav-indicator);
    stroke-width: 4.5;
  }
}
</style>
