<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon';
import { useUserStore } from '/@/stores/user';
import { $t } from '/@/locales';

interface Props {
  usageType: 'window' | 'workspace';
  label?: string;
  tooltip?: string;
}

const { usageType } = defineProps<Props>()

const { userInfo } = storeToRefs(useUserStore())

const percent = computed(() => {
  return Math.ceil(decimal.value)
})

const decimal = computed(() => {
  const { useWindowCount, maxWindowCount } = userInfo.value
  return (useWindowCount / maxWindowCount) * 10
})

const usage = computed(() => {
  if (usageType === 'window') {
    return `${userInfo.value.useWindowCount}/${userInfo.value.maxWindowCount}`
  } else if (usageType === 'workspace') {
    return `${userInfo.value.useWorkspaceCount}/${userInfo.value.maxWorkspaceCount}`
  }
})

const colorLevel = computed(() => {
  // 用量少于 50%，绿色
  if (percent.value <= 5) {
    return {
      normal: '#1CC94D',
      weak: '#70E090'
    }
  }
  // 用量多于50%，少于 80%，橙色
  else if (percent.value <= 8) {
    return {
      normal: '#FC9D12',
      weak: '#FFCB80'
    }
  }
  // 用量多于 80%，红色，提醒用户如果需要提高额度 则联系客服
  else {
    return {
      normal: '#F53838',
      weak: '#FF9191'
    }
  }
})
</script>

<template>
  <div class="usage" @click.stop>
    <div class="usage-header">
      <div class="flex items-center gap-[2px]">
        <span>{{ label }}</span>
        <RxSvgIcon name="base/rx_ic_info" class="tips" size="12px" v-tooltip.top="tooltip" />
      </div>
      <span>{{ usage }}</span>
    </div>
    <div v-if="usageType === 'window'" class="usage-body">
      <div v-for="num in 10" class="color-block"
        :class="{ 'color-level': num <= percent, 'last-item': num === percent && decimal % 1 }"></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.usage {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;
}

.usage-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  color: var(--Colors-Text-text-primary, #171C1F);
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

.usage-body {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  align-self: stretch;

  .color-block {
    height: 8px;
    flex: 1 0 0;
    background: var(--Color-neutrals-200, #E4E8EB);

    &:first-of-type {
      border-radius: 6px 0px 0px 6px;
    }

    &:last-of-type {
      border-radius: 0px 6px 6px 0px;
    }

    &.color-level {
      background-color: v-bind('colorLevel.normal');

      &.last-item {
        background-color: v-bind('colorLevel.weak');
      }
    }
  }
}
</style>
