<script setup lang="ts">
import PlatformIcon from '/@/views/account/list/components/platform-icon.vue'

defineProps<{
  data: Record<string, any>
  readonly?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <div v-tooltip.top="readonly ? undefined : { value: $t('点击编辑/查看详情'), showDelay: 500 }" class="platform-info-cell" :class="{ 'platform-info-cell--readonly': readonly }" @click.stop="!readonly && emit('click')">
    <PlatformIcon v-if="data.platformIcon" :platform-icon="data.platformIcon" :platform-icon-dark="data.platformIconDark" class="w-6 shrink-0" />
    <SvgIcon v-else name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary, #7C8387)" size="24" />
    <div class="flex flex-col flex-1 gap-0.5 min-w-0">
      <div class="platform-info-cell__title" :title="data.platformUrl">
        {{ data.platformUrl || '--' }}
      </div>
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="platform-info-cell__subtitle" :title="data.platformUserName">{{ data.platformUserName || '--' }}</span>
        <SvgIcon v-if="data.platformEfa" class="text-blue shrink-0" name="base/rx_ic_2fa" :size="16" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.platform-info-cell {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: pointer;
  width: fit-content;

  &--readonly {
    cursor: default;
  }

  &__title {
    font-size: 12px;
    line-height: 16px;
    color: var(--colors-text-text-primary);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__subtitle {
    font-size: 12px;
    line-height: 16px;
    color: var(--colors-text-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
