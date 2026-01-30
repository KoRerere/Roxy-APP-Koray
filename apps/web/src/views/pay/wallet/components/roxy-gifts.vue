<script setup lang="tsx">
import { I18nT } from 'vue-i18n'
import { RxSvgIcon } from '/@/components/rx-icon'
import currency from 'currency.js'
import { $t } from '/@/locales'
import { useThemeStore } from '/@/stores/theme'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { useDialog } from '/@/hooks/useDialog'
import { RoxyGiftsType } from '/@/enums/pay'
import { genDriver, safeParseJSON, sleep } from '/@/utils'

const { amount } = defineProps<{
  amount: number
}>()

const { realTheme } = storeToRefs(useThemeStore())
const { currentLocale } = storeToRefs(useSimpleLocale())
const { roxyGifts } = storeToRefs(useCampaignStore())
const { getRoxyGifts } = useCampaignStore()

const [showModal] = useDialog()

const giftType = defineModel()

const driverStatus = safeParseJSON(localStorage.getItem('driverStatus'))
const ruleCss = useCssModule('rule')

const options = computed(() => {
  if (!roxyGifts.value)
    return []
  const count = Math.floor(currency(amount, { precision: 6 }).divide(roxyGifts.value.price).value)
  const ispCount = currency(count).multiply(roxyGifts.value.ispCount).value
  const value = currency(count).multiply(roxyGifts.value.dynamicFlow).value

  return [
    {
      label: $t('动态住宅代理 IP ({value}GB，{days} 天)', { value, days: roxyGifts.value.dynamicDays }),
      desc: $t('可设置任意国家地区，由 ROLA-IP 提供'),
      value: RoxyGiftsType.Rotating,
    },
    {
      label: $t('{count}条 {country} 静态住宅代理 IP ({days} 天)', { count: ispCount, country: roxyGifts.value.country, days: roxyGifts.value.staticDays }),
      value: RoxyGiftsType.ISP,
    },
  ]
})

const gifts = computed(() => {
  if (!roxyGifts.value)
    return {}
  const isOk = amount >= roxyGifts.value.price
  const suffix = currentLocale.value === 'ru' ? 'en' : currentLocale.value

  return {
    isOk,
    image: `/images/campaing/gifts-${suffix}-${realTheme.value}.png`,
    desc: isOk ? $t('选择任意一项作为当前订单的赠品') : $t('消费每满 {amount} 即可获赠代理 IP，多买多送', { amount: currency(roxyGifts.value.price).format() }),
  }
})

onBeforeMount(() => {
  getRoxyGiftsConfig()
})

async function getRoxyGiftsConfig() {
  await getRoxyGifts()
  giftType.value = RoxyGiftsType.Rotating
  driverHighlight()
}

async function driverHighlight() {
  if (!roxyGifts.value?.isValid || driverStatus?.roxyGift)
    return

  await Promise.all([
    sleep(50), // 延迟 50ms 让外部元素加载完成
    nextTick(),
  ])

  const driverObj = genDriver({
    steps: [
      { element: '#gifts', popover: { description: $t('您现在每消费满 {amount}，即可获得我们提供的代理 IP 作为赠品，多买多送。点击「详情」了解更多。', { amount: currency(roxyGifts.value.price).format() }), side: 'left', align: 'center' } },
    ],
    onDestroyed: () => {
      localStorage.setItem('driverStatus', JSON.stringify({ ...driverStatus, roxyGift: true }))
    },
  })

  driverObj.drive()
}

function giftRule() {
  if (!roxyGifts.value)
    return

  const { price, country, dynamicDays, dynamicFlow, ispCount, staticDays } = roxyGifts.value
  const amount = currency(price).format()

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <div class="w-120 flex flex-col gap-4 pa-6 pt-4">
          <div class="h-9 inline-flex items-center justify-between">
            <div class={ruleCss.title}>{$t('Roxy 赠品规则')}</div>
            <div class="flex items-center cursor-pointer" onClick={hideModal}>
              <RxSvgIcon name="base/rx_ic_delete" size="20" />
            </div>
          </div>
          <div class="flex flex-col gap-3">
            <div class={`font-700 ${ruleCss.desc}`}>{$t('窗口每消费 {amount} 可选下面赠品，赠送无上限：', { amount })}</div>
            <div class={ruleCss.desc}>{$t('选项一： {country} 静态住宅代理 IP，有效期 {days} 天。每满 {amount} 赠送 {count} 条，不设上限。', { country, days: staticDays, amount, count: ispCount })}</div>
            <div class={ruleCss.desc}>
              <I18nT keypath={$t('选项二： 动态住宅代理 IP（由合作伙伴 {link} 提供），有效期 {days} 天。每满 {amount} 赠送 {value}GB，不设上限。', { link: '{link}', days: dynamicDays, amount, value: dynamicFlow })}>
                {{ link: () => <a class={ruleCss.link} href="https://rola-ip.co" target="_blank">rola-ip.co</a> }}
              </I18nT>
            </div>
            <div class={`font-700 ${ruleCss.desc}`}>{$t('活动范围： 仅限于窗口订阅（含升级与续费）、成员购买及空间购买。')}</div>
            <div class={ruleCss.desc}>{$t('消费完成后，对应赠品将会发放至代理 IP 页面中：静态住宅代理 IP 将会在发放至「代理 IP 商店」中，而动态住宅代理 IP 将会发放至「代理 IP 列表」中。')}</div>
            <div class={ruleCss.desc}>{$t('本活动最终解释权归 RoxyBrowser 团队所有。')}</div>
          </div>
        </div>
      ),
    },
  })
}
</script>

<template>
  <div v-if="!!roxyGifts?.isValid" id="gifts" class="relative flex flex-col gap-6 pa-4 rounded-2 overflow-hidden content">
    <SvgIcon class="absolute -top-12 -right-8 opacity-5 -rotate-15 z-0" name="base/rx_ic_gift_2" size="128" color="var(--campaign-giftcard-icon-giftcard)" />
    <div class="relative flex flex-col gap-0.5 z-1">
      <div class="flex items-center justify-between">
        <img class="h-4" draggable="false" :src="gifts.image">
        <div class="flex items-center gap-0.5 cursor-pointer" @click="giftRule">
          <span class="desc">{{ $t('详情') }}</span>
          <SvgIcon class="opacity-40" name="base/rx_ic_info" size="12" color="var(--campaign-giftcard-icon-giftcard)" />
        </div>
      </div>
      <div class="desc">
        {{ gifts.desc }}
      </div>
    </div>
    <div v-if="gifts.isOk" class="relative flex flex-col gap-3 z-1">
      <label v-for="item in options" :key="item.value" class="flex items-start gap-1.5 select-none cursor-pointer" :for="item.value">
        <RadioButton v-model="giftType" class="!hidden" :input-id="item.value" :value="item.value" name="gifts" />
        <div class="radio" :class="{ checked: giftType === item.value }" />
        <div>
          <div class="label">{{ item.label }}</div>
          <div v-if="item.desc" class="desc">{{ item.desc }}</div>
        </div>
      </label>
    </div>
  </div>
</template>

<style module="rule">
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.desc {
  color: var(--colors-text-text-primary);
  font-size: 12px;
}

.link {
  color: var(--colors-text-text-link);
}
</style>

<style lang="scss" scoped>
.content {
  background: var(--campaign-giftcard-bg-giftcard);
}

.title {
  color: var(--colors-text-text-primary);
  font-family: 'Archivo Expanded';
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.desc {
  color: var(--campaign-giftcard-text-giftcard-note);
  font-size: 12px;
  line-height: normal;
}

.radio {
  position: relative;
  width: 16px;
  height: 16px;
  border: 1px solid var(--campaign-giftcard-border-giftcard-select);
  border-radius: 50%;

  &.checked {
    border-width: 2px;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      background: var(--campaign-giftcard-border-giftcard-select);
      border-radius: 50%;
    }
  }
}

.label {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 16px;
}
</style>
