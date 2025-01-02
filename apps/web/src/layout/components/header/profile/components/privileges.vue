<script setup lang="ts">
import { $t } from '/@/locales';
import { useUserStore } from '/@/stores/user';
import { RxSvgIcon } from '/@/components/rx-icon/'

const props = defineProps<{
  identity?: string,
}>()


const userStore = useUserStore()


const privileges = computed(() => {
  const identity = props.identity || userStore.userInfo.identity
  if (identity === 'old') {
    return [
      $t('专属【创始】身份+徽章'),
      $t('{count}个窗口用量', { count: 100 }),
      $t('{count}个额外工作空间用量', { count: 3 }),
      $t('特权码生成权限（推广计划）'),
    ]
  } else if (identity === 'invited') {
    return [
      $t('专属【特邀】身份+徽章'),
      $t('{count}个窗口用量', { count: 60 }),
      $t('{count}个额外工作空间用量', { count: 2 }),
    ]
  }
  return [
    $t('{count}个窗口用量', { count: '20/30' }),
    $t('{count}个额外工作空间用量', { count: 1 }),
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
