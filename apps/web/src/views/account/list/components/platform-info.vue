<script setup lang="ts">
import PlatformIcon from '/@/views/account/list/components/platform-icon.vue'

defineProps<{
  data: Record<string, any>
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <PlatformIcon v-if="data.platformIcon" :platform-icon="data.platformIcon" :platform-icon-dark="data.platformIconDark" class="w-6" />
    <SvgIcon v-else name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary, #7C8387)" size="24" />
    <div class="flex flex-col flex-1 gap-0.5">
      <div class="flex items-center title">
        {{ data.platformUrl }}
      </div>
      <div class="flex items-center gap-1.5 subtitle">
        <span>{{ data.platformUserName }}</span>
        <SvgIcon v-if="data.platformEfa" class="text-blue" name="base/rx_ic_2fa" :size="16" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  font-size: 12px;
  line-height: 16px;
  color: var(--colors-text-text-primary);
  font-weight: 500;
}

.subtitle {
  font-size: 12px;
  line-height: 16px;
  color: var(--colors-text-text-tertiary);
}
</style>
