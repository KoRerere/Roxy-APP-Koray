<script setup lang="ts">
import AgentConsolePageLayout from '../components/AgentConsolePageLayout.vue'

defineProps<{
  activeConversationId?: string
  routeTitle?: string | symbol
  thinking?: boolean
}>()

defineModel<string>('prompt')

defineEmits<{
  send: []
}>()
</script>

<template>
  <AgentConsolePageLayout
    align-items="center"
    content-display="flex"
    justify-content="center"
    padding="32px"
    mobile-padding="32px 16px"
  >
    <h1>{{ String(routeTitle || '') }}</h1>
  </AgentConsolePageLayout>
</template>

<style lang="scss" scoped>
h1 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
}
</style>
