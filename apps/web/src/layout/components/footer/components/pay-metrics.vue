<script setup lang="tsx">
import PayMetricsCard from './pay-metrics-card.vue'
import PayMetricsList from './pay-metrics-list.vue'
import Usage from '/@/components/usage.vue'
import { RxSvgIcon } from '/@/components/rx-icon';
import { createReusableTemplate } from '@vueuse/core';
import { $t } from '/@/locales';
import { useUserStore } from '/@/stores/user';
import { emitter } from '/@/utils/eventBus';
import { SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay';

const { collapsed } = defineProps<{
  collapsed: boolean
}>()

const [DefineTemplate, ReuseTemplate] = createReusableTemplate()

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())

const opRef = useTemplateRef('op')
const isFree = computed(() => [SubLevelEnum.Free, SubLevelEnum.Trial].includes(userPayInfo.value?.subLevel as SubLevelEnum))
const isExpired = computed(() => userPayInfo.value.subLevel === SubLevelEnum.Expired)

const blockCount = computed(() => {
  if (isFree.value || isExpired.value) {
    return 5
  }
  return 10
})

const badgeBgColor = computed(() => {
  if ([SubLevelEnum.Free, SubLevelEnum.Expired].includes(userPayInfo.value?.subLevel as SubLevelEnum)) {
    return 'var(--pattern-pay-plan-bg-tag-current)'
  }
  return 'linear-gradient(90deg, #8780FE 0%, #C491F1 100%)'
})

const ratio = computed(() => {
  const { useWindowCount, maxWindowCount } = userPayInfo.value
  return useWindowCount / maxWindowCount
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

const actions = computed(() => {
  return [
    {
      label: $t('升级'),
      visible: isFree.value,
      btnText: userPayInfo?.value.isTrial && $t('立即升级'),
      command: () => {
        router.push({ name: 'subscribe-plan' })
      }
    },
    {
      label: $t('续订'),
      visible: !userPayInfo.value?.isAuto && !isFree.value,
      btnText: isExpired.value && $t('立即续订'),
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
      btnText: isExpired.value && $t('前往支付'),
      command: () => {
        router.push({ name: 'wallet', query: { name: 'billing' } })
      }
    }
  ].filter(item => item.visible !== false)
})

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

function toggle(event: Event) {
  opRef.value?.toggle(event);
}
</script>

<template>
  <DefineTemplate>
    <div class="pay-metrics" :class="{ collapsed }">
      <PayMetricsCard class="cursor-pointer" v-for="item in actions" :key="item.label" @click="item.command">
        <div class="pay-metrics-title">
          <div class="pay-metrics-title-badge">{{ SubLevelEnumStr[userPayInfo?.subLevel as SubLevelEnum] }}</div>
          <div class="pay-metrics-title-upgrade" v-if="!item.btnText">
            <span>{{ item.label }}</span>
            <RxSvgIcon name="base/rx_ic_arrow_right_2" size="12" />
          </div>
        </div>

        <Usage :ratio="ratio" :color-level="(percent: number) => getColorLevel(percent, blockCount)" :block-count="blockCount" />

        <div class="inline-flex items-center self-stretch gap-1">
          <PayMetricsList :items="payMetricsItems" />
          <SvgIcon v-tooltip="{ value: infoValue, pt: { root: '!max-w-[fit-content]', text: '!whitespace-pre' } }" class="cursor-pointer" size="14" name="base/rx_ic_info"
            color="var(--colors-icon-icon-note)"></SvgIcon>
        </div>

        <AnimationBorder class="w-full" v-if="item.btnText" bg-color="var(--pattern-sidenav-metrics-btn)"
          :gradient="['var(--pattern-wallet-prime-border-blue)', 'var(--pattern-wallet-prime-border-orange)', 'var(--pattern-wallet-prime-border-purple)']">
          <RxButton class="w-full" severity="secondary" variant="text" size="xs" :label="item.btnText" @click.stop="item.command"></RxButton>
        </AnimationBorder>

        <RxButton v-if="userPayInfo?.isTrial === 0" class="w-full" severity="secondary" variant="outlined" size="xs"
          @click.stop="$router.push({ name: 'subscribe-plan', query: { type: SubLevelEnum.Trial } })">
          <span>🎁</span>
          <span>{{ $t('{day} 天免费试用', { day: 7 }) }}</span>
        </RxButton>
      </PayMetricsCard>
    </div>
  </DefineTemplate>

  <template v-if="!collapsed">
    <ReuseTemplate />
  </template>

  <div v-else class="pay-metrics-collapsed" @click="toggle">
    <Usage :ratio="ratio" :color-level="(percent: number) => getColorLevel(percent, 5)" :block-count="5" shape="circle" />
  </div>

  <Popover ref="op" unstyled appendTo="self">
    <animation-border class="pay-metrics-popover" bgColor="var(--colors-background-bg-overlay)">
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
    border-top: 1px dashed var(--colors-border-border-base, #C7CDD1);
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
      color: var(--colors-text-text-brand, #12A3FC);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;
      cursor: pointer;
    }
  }
}

.pay-metrics-collapsed {
  cursor: pointer;

  .pay-metrics-collapsed-text {
    color: var(--pattern-sidenav-text-active, #3FB6FD);
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
  border-radius: 8px;

  :deep(.pay-metrics-card) {
    background: transparent;
  }
}

// .extend {
//   :deep(.pay-metrics-item-usage) {
//     color: #12A3FC;
//   }
// }</style>
