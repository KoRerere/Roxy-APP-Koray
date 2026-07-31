<script setup lang="ts">
import { strConcat } from '/@/utils'

const { data } = defineProps<{
  data: any
}>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="device-host">
      <span>{{ data.host }}</span>
      <span>{{ strConcat(':', data.port) }}</span>
      <span>{{ strConcat(':', data.proxyUserName) }}</span>
      <span>{{ strConcat(':', data.proxyPassword) }}</span>
    </div>
    <div class="flex items-center gap-1.5 ip-type">
      <span>{{ data.ipType }}</span>
      <template v-if="data.protocol">
        <Divider class="!ma-0" layout="vertical" />
        <span>{{ data.protocol.toLocaleLowerCase() }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.device-host {
  color: var(--colors-text-text-primary);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ip-type {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}
</style>
