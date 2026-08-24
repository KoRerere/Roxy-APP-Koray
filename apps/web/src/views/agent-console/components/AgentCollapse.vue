<script setup lang="ts">
defineProps<{
  expanded: boolean
}>()
</script>

<template>
  <Transition name="agent-collapse">
    <div
      v-if="expanded"
      class="agent-collapse"
      :aria-hidden="!expanded"
      :inert="expanded ? undefined : true"
    >
      <div class="agent-collapse__content">
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.agent-collapse {
  display: grid;
  min-width: 0;
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translateY(0);
}

.agent-collapse-enter-active,
.agent-collapse-leave-active {
  overflow: hidden;
  transition:
    grid-template-rows 200ms cubic-bezier(0.23, 1, 0.32, 1),
    opacity 140ms ease-out,
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

.agent-collapse-leave-active {
  pointer-events: none;
}

.agent-collapse-enter-from,
.agent-collapse-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-2px);
}

.agent-collapse__content {
  min-width: 0;
  min-height: 0;
}

.agent-collapse-enter-active .agent-collapse__content,
.agent-collapse-leave-active .agent-collapse__content {
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .agent-collapse-enter-active,
  .agent-collapse-leave-active {
    transform: none;
    transition: opacity 120ms ease-out;
  }
}
</style>
