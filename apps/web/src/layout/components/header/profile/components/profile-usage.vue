<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon';
import { useUserStore } from '/@/stores/user';
import { $t } from '/@/locales';
import Usage from '/@/components/usage.vue'

interface Props {
  usageType: 'window' | 'workspace';
  label?: string;
  tooltip?: string;
}

const { usageType } = defineProps<Props>()

const { userInfo } = storeToRefs(useUserStore())

const ratio = computed(() => {
  const { useWindowCount, maxWindowCount } = userInfo.value
  return useWindowCount / maxWindowCount
})

const usage = computed(() => {
  if (usageType === 'window') {
    return `${userInfo.value.useWindowCount}/${userInfo.value.maxWindowCount}`
  } else if (usageType === 'workspace') {
    return `${userInfo.value.useWorkspaceCount}/${userInfo.value.maxWorkspaceCount}`
  }
})

const colorLevelFn = (percent: number) => {
  // 用量少于 50%，绿色
  if (percent <= 5) {
    return {
      normal: '#1CC94D',
      weak: '#70E090'
    }
  }
  // 用量多于50%，少于 80%，橙色
  else if (percent <= 8) {
    return {
      normal: '#FC9D12',
      weak: '#FFCB80'
    }
  }
  // 用量多于 80%，红色，提醒用户如果需要提高额度 则联系技术支持
  else {
    return {
      normal: '#F53838',
      weak: '#FF9191'
    }
  }
}
</script>

<template>
  <div class="profile-usage" @click.stop>
    <div class="profile-usage-header">
      <div class="flex items-center gap-[2px]">
        <span>{{ label }}</span>
        <RxSvgIcon name="base/rx_ic_info" class="tips" size="12px" v-tooltip.top="tooltip" />
      </div>
      <span>{{ usage }}</span>
    </div>
    <template v-if="usageType === 'window'">
      <Usage :ratio="ratio" :color-level="colorLevelFn" :block-count="10" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.profile-usage {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;
}

.profile-usage-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */

  .tips {
    color: #C7CDD1;
  }
}
</style>
