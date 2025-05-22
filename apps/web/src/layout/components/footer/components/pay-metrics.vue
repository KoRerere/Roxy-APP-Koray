<script setup lang="tsx">
import currency from 'currency.js'
import { createReusableTemplate } from '@vueuse/core';
import { RxSvgIcon } from '/@/components/rx-icon';
import Usage from '/@/components/usage.vue'
import { SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay';
import { $t } from '/@/locales';
import { useUserStore } from '/@/stores/user';
import PayMetricsCard from './pay-metrics-card.vue'
import PayMetricsList from './pay-metrics-list.vue'
import { emitter } from '/@/utils/eventBus';

const { collapsed } = defineProps<{
  collapsed: boolean
}>()
const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())

const [DefineTemplate, ReuseTemplate] = createReusableTemplate()
const opRef = useTemplateRef('op')

const badgeBgColor = computed(() => {
  if ([SubLevelEnum.Free, SubLevelEnum.Expired].includes(userPayInfo.value?.subLevel as SubLevelEnum)) {
    return '#90AFC2'
  }
  return 'linear-gradient(90deg, #8780FE 0%, #C491F1 100%)'
})

const isFree = computed(() => [SubLevelEnum.Free, SubLevelEnum.Trial].includes(userPayInfo.value?.subLevel as SubLevelEnum))
const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)

const ratio = computed(() => {
  const { useWindowCount, maxWindowCount } = userPayInfo.value
  return useWindowCount / maxWindowCount
})

const blockCount = computed(() => {
  if (isFree.value || isExpired.value) {
    return 5
  }
  return 10
})

const payMetricsItems = computed(() => {
  const { useWindowCount, maxWindowCount } = userPayInfo.value
  return [
    {
      label: $t('窗口用量'),
      usage: `${useWindowCount} / ${maxWindowCount}`
    },
  ]
})

const payMetricsList = computed(() => {
  const { useMemberCount, maxMemberCount, useWorkspaceCount, maxWorkspaceCount } = userPayInfo.value

  return [
    {
      label: $t('团队成员'),
      usage: `${useMemberCount} / ${maxMemberCount}`
    },
    {
      label: $t('工作空间'),
      usage: `${useWorkspaceCount} / ${maxWorkspaceCount}`
    }
  ]
})

const toggle = (event: Event) => {
  opRef.value?.toggle(event);
}
const actions = computed(() => [
  {
    label: $t('升级'),
    visible: isFree.value,
    command: () => {
      router.push({ name: 'subscribe-plan' })
    }
  },
  {
    label: $t('续费'),
    visible: !userPayInfo.value?.isAuto && !isFree.value,
    command: () => {
      emitter.emit('showRenewalDialog', {
        paySuccess: () => {
          emitter.emit('updateBillList')
        }
      })
    }
  },
  {
    label: $t('详情'),
    visible: !!userPayInfo.value?.isAuto,
    command: () => {
      router.push({ name: 'wallet' })
    }
  }
].filter(item => item.visible !== false))
const infoValue = computed(() => {
  const { totalOpenWindowTimes, totalCreateWindowTimes, openWindowTimes, createWindowTimes } = userPayInfo.value
  return $t('每日可创建数: {num1}\n每日可打开数: {num2}', { num1: `${createWindowTimes}/${totalCreateWindowTimes}`, num2: `${openWindowTimes}/${totalOpenWindowTimes}` })
})

function getColorLevel(percent: number, blockCount: number) {
  return {
    normal: percent > blockCount ? '#EF4444' : '#12A3FC',
    weak: '#7ECCFC'
  }
}

function onExpand() {
  emitter.emit('showExpandDialog', {
    paySuccess: () => {
      emitter.emit('updateBillList')
    }
  })
}
</script>

<template>
  <DefineTemplate>
    <div class="pay-metrics" :class="{ collapsed }">
      <PayMetricsCard class="cursor-pointer" v-for="item in actions" :key="item.label" @click="item.command">
        <div class="pay-metrics-title">
          <div class="pay-metrics-title-badge">{{ SubLevelEnumStr[userPayInfo?.subLevel as SubLevelEnum] }}</div>
          <div class="pay-metrics-title-upgrade">
            <span>{{ item.label }}</span>
            <RxSvgIcon name="base/rx_ic_arrow_right_2" size="12" />
          </div>
        </div>
        <Usage :ratio="ratio" :color-level="(percent: number) => getColorLevel(percent, blockCount)"
          :block-count="blockCount" />
        <div class="inline-flex items-center self-stretch gap-1">
          <PayMetricsList :items="payMetricsItems" />
          <SvgIcon v-tooltip="{ value: infoValue, pt: { root: '!max-w-[fit-content]', text: '!whitespace-pre' } }"
            class="cursor-pointer" size="14" name="base/rx_ic_info" color="#C7CDD1"></SvgIcon>
        </div>
        <!-- 七天免费使用 -->
        <div v-if="userPayInfo?.isTrial === 0" class="pay-metrics-free-usage"
          @click.stop="$router.push({ name: 'trial-plan' })">
          🎁
          {{ $t('{day} 天免费试用', { day: 7 }) }}
        </div>
      </PayMetricsCard>
      <div v-if="collapsed" class="pay-metrics-divider"></div>
      <PayMetricsCard class="extend cursor-pointer" @click="onExpand">
        <PayMetricsList :items="payMetricsList" />
      </PayMetricsCard>
    </div>
  </DefineTemplate>

  <template v-if="!collapsed">
    <ReuseTemplate />
  </template>

  <div v-else class="pay-metrics-collapsed" @click="toggle">
    <Usage :ratio="ratio" :color-level="(percent: number) => getColorLevel(percent, 5)" :block-count="5"
      shape="circle" />
    <!-- <div class="pay-metrics-collapsed-text" v-for="item in actions" :key="item.label" @click.stop="item.command">
      {{ item.label }}
    </div> -->
  </div>

  <Popover ref="op" unstyled appendTo="self">
    <animation-border class="pay-metrics-popover">
      <ReuseTemplate />
    </animation-border>
  </Popover>
</template>

<style lang="scss" scoped>
.pay-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);
  white-space: nowrap;
  overflow: hidden;

  &.collapsed {
    gap: 0;
  }

  .pay-metrics-divider {
    margin: 0 10px;
    border-top: 1px dashed var(--Colors-Border-border-container, #C7CDD1);
  }

  .pay-metrics-title {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .pay-metrics-title-badge {
      display: inline-flex;
      padding: 2px 8px;
      justify-content: center;
      align-items: center;
      gap: 10px;
      border-radius: var(--radius-full, 9999px);
      background: v-bind(badgeBgColor);
      color: #FFF;
      font-family: "DingTalk JinBuTi";
      font-size: 12px;
      line-height: normal;
    }

    .pay-metrics-title-upgrade {
      display: flex;
      padding: 2px 0px 2px 4px;
      align-items: center;
      gap: 4px;
      color: var(--Colors-Text-text-brand, #12A3FC);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;
      cursor: pointer;
    }
  }
}

.pay-metrics-free-usage {
  display: flex;
  min-width: 64px;
  padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);
  border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #C7CDD1);
  background: var(--Component-Colors-Buttons-Secondary-bg, #FFF);
  box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  color: var(--Component-Colors-Buttons-Secondary-text, #171C1F);
  text-align: center;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
  cursor: pointer;
}

.pay-metrics-collapsed {
  cursor: pointer;

  .pay-metrics-collapsed-text {
    color: var(--Color-blue-300, #12A3FC);
    text-align: center;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }
}

.pay-metrics-popover {
  width: 226px;
  padding: 6px;
  background-color: white;
  border-radius: 8px;
}

// .extend {
//   :deep(.pay-metrics-item-usage) {
//     color: #12A3FC;
//   }
// }</style>
