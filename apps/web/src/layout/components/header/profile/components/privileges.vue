<script setup lang="ts">
;
import { useUserStore } from '/@/stores/user';
import { RxSvgIcon } from '/@/components/rx-icon/'

import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'

const props = defineProps<{
  identity?: string,
}>()


const userStore = useUserStore()
const profileLabels = useProfileEntityLabels()


const privileges = computed(() => {
  const entityUsage = (count: number) => profileLabels.value.entityUsageCount(count)
  const identity = props.identity || userStore.userInfo.identity
  if (identity === 'old') {
    return [
      $t('专属【创始】身份+徽章'),
      entityUsage(100),
      $t('{count}个额外团队用量', { count: 3 }),
      $t('特权码生成权限（推广计划）'),
    ]
  } else if (identity === 'invited') {
    return [
      $t('专属【特邀】身份+徽章'),
      entityUsage(60),
      $t('{count}个额外团队用量', { count: 2 }),
    ]
  } else if (identity === 'agent') {
    return [
      $t('专属【合作】身份+徽章'),
      entityUsage(1000),
      $t('{count}个额外团队用量', { count: 10 }),
      $t('特权码生成权限（推广计划）'),
    ]
  }
  return [
    entityUsage(userStore.userInfo.maxWindowCount),
    $t('{count}个额外团队用量', { count: 1 }),
  ]
})
</script>

<template>
  <div class="privileges">
    <template v-for="privilege in privileges" :key="privilege">
      <div class="privilege-item">
        <RxSvgIcon name="base/rx_ic_check_fill" color="#1CC94D" size="14px" />
        <span>{{ privilege }}</span>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.privileges {
  display: flex;
  padding: 0px 12px;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;

  .privilege-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg, 8px);
    align-self: stretch;
  }
}
</style>
