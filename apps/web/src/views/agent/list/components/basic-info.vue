<script setup lang="ts">
import { strConcat } from '/@/utils'

defineProps<{
  data: any
}>()

</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="proxy-host">
      <span>{{ strConcat(data.protocol?.toLocaleLowerCase(), '://') }}</span>
      <span>{{ data.host }}</span>
      <span>{{ strConcat(':', data.port) }}</span>
    </div>
    <div class="flex items-center gap-1.5 ip-type">
      <span>{{ data.ipType }}</span>
      <Divider class="!ma-0" layout="vertical" />
      <span>{{ data.proxyUserName }}</span>
    </div>
  </div>
</template>

<style scoped>
.proxy-host {
  color: var(--colors-text-text-primary);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.ip-type {
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
