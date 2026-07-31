<script setup lang="ts">
import type { SvgNames } from '/@/components/rx-icon'
import { SubLevelEnum } from '/@/enums/pay'
import { useUserStore } from '/@/stores/user'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'

const { userPayInfo } = storeToRefs(useUserStore())
const billingLabels = useBillingEntityLabels()

const isLocked = computed(() => [SubLevelEnum.Free, SubLevelEnum.Expired].includes(userPayInfo.value.subLevel as SubLevelEnum))

const advanced = computed(() => [
  {
    icon: 'base/rx_ic_portrait-spark-light',
    text: billingLabels.value.createEntityTemplate,
  },
  {
    icon: 'base/rx_ic_portrait-spark-light',
    text: billingLabels.value.entityTransfer,
  },
  {
    icon: 'base/rx_ic_portrait-spark-light',
    text: billingLabels.value.entitySync,
  },
  {
    icon: 'base/rx_ic_check',
    text: billingLabels.value.unlimitedProjects,
  },
  {
    icon: 'base/rx_ic_check',
    text: $t('频道权限（即将推出）'),
  },
  {
    icon: 'base/rx_ic_check',
    text: isLocked.value
      ? $t('更长的日志保留时长')
      : $t('日志保留时长（{value} 天）', { value: userPayInfo.value?.logDays }),
  },
  {
    icon: 'base/rx_ic_check',
    text: $t('专属技术支持'),
  },
  {
    icon: 'base/rx_ic_check',
    text: isLocked.value
      ? $t('更多的 API 请求次数')
      : $t('API 请求次数（{value}次 / 分钟）', { value: userPayInfo.value?.apiRate }),
  },
])
</script>

<template>
  <div class="flex items-center gap-1.5">
    <!-- <SvgIcon v-if="props.showIcon" :name="isLocked ? 'base/rx_ic_portrait-spark' : 'base/rx_ic_portrait-spark-light'" color="var(--colors-icon-icon-note)"></SvgIcon>
    <span v-if="props.showText" class="desc">{{ isLocked ? $t('成为付费用户，解锁所有 Prime 会员功能') : $t('您已解锁所有会员功能') }}</span> -->
    <RxTooltip class="flex items-center">
      <template #default>
        <SvgIcon class="cursor-pointer" name="base/rx_ic_info" color="#fff" size="14" />
      </template>
      <template #content>
        <div class="w-75 flex flex-col gap-2">
          <div v-for="item in advanced" :key="item.text" class="flex items-center gap-2.5">
            <SvgIcon :name="isLocked ? 'base/rx_ic_lock' : (item.icon as SvgNames)" :color="isLocked ? 'var(--colors-icon-icon-note)' : 'var(--colors-icon-icon-success)'" />
            <div class="text">
              {{ item.text }}
            </div>
          </div>
          <template v-if="!isLocked">
            <RxDivider line-color="var(--component-tooltip-divider)" line-only line-style="dashed" />
            <div class="flex items-start gap-2.5 tip">
              <SvgIcon name="base/rx_ic_portrait-spark" color="var(--colors-icon-icon-note)" />
              <span>{{ $t('带有此图标的功能可以在任何团队中使用，其他功能仅限在自己创建的团队使用。') }}</span>
            </div>
          </template>
        </div>
      </template>
    </RxTooltip>
  </div>
</template>

<style scoped>
.desc {
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  line-height: normal;
}

.text {
  color: var(--component-tooltip-text-secondary);
  font-size: 12px;
  line-height: 16px;
}

.tip {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 18px;
}
</style>
