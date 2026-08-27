<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'
import { useNewUserBenefitStore } from '/@/stores/new-user-benefit'
import { useThemeStore } from '/@/stores/theme'
import { enhanceCountdown, getImage } from '/@/utils'

/** 购买种类，点击后交给上层打开对应购买弹窗 */
type BenefitOfferKind = 'datacenter' | 'residential' | 'window'

/** 福利卡片项：三档购买入口共用同一套布局，差异只在标签/价格/文案 */
interface BenefitOffer {
  /** 购买种类 */
  kind: BenefitOfferKind
  /** 角标文案 */
  tag: string
  /** 角标样式：IP 档青绿、窗口档紫粉 */
  tagClass: 'tag-ip' | 'tag-profile'
  /** 左侧价格或买赠文案 */
  price: string
  /** 价格区样式：IP 档橙色标价，窗口档渐变买赠文案 */
  priceClass: string
  /** 标题 */
  title: string
  /** 副标题 */
  desc: string
  /** 该档资格是否已用完，按钮变灰 */
  used: boolean
}

const emit = defineEmits<{
  close: []
  buy: [kind: BenefitOfferKind]
}>()

const simpleLocale = useSimpleLocale()
const { isDarkTheme } = storeToRefs(useThemeStore())
const { expireAt, datacenterPriceText, residentialPriceText, windowGiftMonths3, benefit } = storeToRefs(useNewUserBenefitStore())

const countdown = ref()
const countdownData = ref()

const imageBgSrc = computed(() => {
  return isDarkTheme.value ? getImage('campaing/new-user/new-user-bg-dark.svg') : getImage('campaing/new-user/new-user-bg-light.svg')
})

const imageSrc = computed(() => {
  return isDarkTheme.value ? getImage('campaing/new-user/new-user-icon-dark.svg') : getImage('campaing/new-user/new-user-icon-light.svg')
})

onMounted(() => {
  if (expireAt.value > Date.now()) {
    initCountdown()
  }
})

onBeforeUnmount(() => {
  countdown.value?.stop()
})

/** 倒计时对准校准后的注册窗口结束时间，到期关弹窗并刷新资格 */
function initCountdown() {
  countdown.value = enhanceCountdown(expireAt.value, (date) => {
    const { days, hours, minutes, seconds } = date
    countdownData.value = [
      { label: $t('天'), value: days.toString().padStart(2, '0') },
      { label: $t('时'), value: hours.toString().padStart(2, '0') },
      { label: $t('分'), value: minutes.toString().padStart(2, '0') },
      { label: $t('秒'), value: seconds.toString().padStart(2, '0') },
    ].slice(days > 0 ? 0 : 1)
  }, {
    alwaysSecondLevel: true,
    onEnd: () => {
      // 资格到期后刷新接口，侧栏与卡片会随 visible 消失
      void useNewUserBenefitStore().fetchBenefit()
      emit('close')
    },
  })
}

/** 三档福利卡片；文案必须用 $t 字面量，语言生成器才能扫到 */
const offers = computed<BenefitOffer[]>(() => [
  {
    kind: 'datacenter',
    tag: $t('新手首选'),
    tagClass: 'tag-ip',
    price: datacenterPriceText.value,
    priceClass: 'text-8 leading-12 font-800 color-[#ff8a00]',
    title: $t('静态机房 IP'),
    desc: $t('30 天不限流量・新用户限购 1 条'),
    used: benefit.value.usage.datacenter,
  },
  {
    kind: 'residential',
    tag: $t('纯净优选'),
    tagClass: 'tag-ip',
    price: residentialPriceText.value,
    priceClass: 'text-8 leading-12 font-800 color-[#ff8a00]',
    title: $t('静态住宅 IP'),
    desc: $t('30 天不限流量・新用户限购 1 条'),
    used: benefit.value.usage.residential,
  },
  {
    kind: 'window',
    tag: $t('多开必备'),
    tagClass: 'tag-profile',
    price: $t('买 {buy} 送 {gift}', { buy: 3, gift: windowGiftMonths3.value }),
    priceClass: 'lang-zh:text-7 lang-ru:text-4 text-5.5 font-800 whitespace-pre-line lang-ru:leading-6 profile',
    title: $t('窗口订阅'),
    desc: $t('窗口订阅 3 个月送 1 个月'),
    used: benefit.value.usage.window,
  },
])

/** 进入购买弹窗 / 订阅页；额度由下单接口校验，按钮始终可点 */
function onBuy(kind: BenefitOfferKind) {
  emit('buy', kind)
}
</script>

<template>
  <div class="flex flex-col gap-1.5 select-none w-660px">
    <RxButton class="relative self-end z-3" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="$emit('close')" />
    <!-- 圆角必须裁在背景图上：覆盖层是透明的裁不到 SVG；父级 overflow-hidden 会把顶部图标一起裁掉 -->
    <div class="relative">
      <img draggable="false" class="block w-full rounded-4" :src="imageBgSrc">
      <img draggable="false" class="absolute top-5 left-1/2 -translate-x-1/2 -translate-y-1/2 w-100 z-1" :src="imageSrc">
      <div class="absolute inset-0 flex flex-col gap-4 pa-6 pt-20 z-2 [transform:rotate(0.1deg)]">
        <div class="flex flex-col gap-2">
          <div class="color-[#ff8a00] tt-primary lang-zh:text-15 text-10 font-700 text-center italic leading-20">
            {{ $t('新人专享福利') }}
          </div>
          <div class="text-4 tt-secondary font-500 text-center leading-6">
            {{ $t('注册后 {days} 天内可领取，错过不再开放', { days: 7 }) }}
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div
            v-for="offer in offers"
            :key="offer.kind"
            class="flex items-center gap-5 py-4 px-5 rounded-3 item"
            @click="onBuy(offer.kind)"
          >
            <div class="relative w-32">
              <span class="tag lang-en:text-3 lang-en:left-50px lang-ru:text-3 lang-ru:left-42px" :class="offer.tagClass">{{ offer.tag }}</span>
              <span :class="offer.priceClass">{{ offer.price }}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="1" height="42" viewBox="0 0 1 42" fill="none">
              <path d="M0.5 0V42" stroke="var(--colors-border-border-base, #6A757C)" stroke-dasharray="2 2" />
            </svg>
            <div class="flex-1 flex flex-col gap-1">
              <div class="tt-primary text-4.5 font-600 leading-6.5 whitespace-nowrap">
                {{ offer.title }}
              </div>
              <div class="tt-tertiary lang-zh:text-3.5 text-3.3 font-500 leading-5">
                {{ offer.desc }}
              </div>
            </div>
            <RxButton class="buy-btn lang-ru:text-3" :class="{ 'is-used': offer.used }" size="lg" severity="warn" icon="base/rx_ic_cart" :label="$t('立即购买')" />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-3.5 tt-primary font-500 text-center leading-5">
            {{ $t('福利结束倒计时') }}
          </div>
          <div class="flex justify-center items-start gap-3.5">
            <template v-for="(item, index) in countdownData" :key="item.label">
              <div v-if="index !== 0" class="h-14.5 flex items-center justify-center tt-brand text-7 font-700">
                :
              </div>
              <div class="flex flex-col items-center gap-1">
                <AnimationBorder :gradient="['rgba(17, 163, 253, 0.80)', 'rgba(17, 163, 253, 0.80)', 'rgba(17, 163, 253, 0.80)']" :animation="false" :deg="110" :border-width="2" :border-radius="10">
                  <div class="w-14.5 h-14.5 flex items-center rounded-2 justify-center tt-brand text-7.5 leading-9 font-700 font-[JetBrains_Mono] bg-[var(--colors-background-bg-page)]">
                    {{ item.value }}
                  </div>
                </AnimationBorder>

                <div class="text-3 tt-primary leading-normal">
                  {{ item.label }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item {
  cursor: pointer;
  background:
    radial-gradient(37.71% 93.02% at 91.22% -10.47%, rgba(17, 163, 253, 0.2) 0%, rgba(17, 163, 253, 0) 100%), #fff;

  // 深色稿：半透明描边 + 更高不透明度蓝光叠在 #292929 上
  [data-theme='dark'] & {
    border-radius: 12px;
    border: 1px solid rgb(255 255 255 / 10%);
    background:
      radial-gradient(37.71% 93.02% at 91.22% -10.47%, rgb(17 163 253 / 50%) 0%, rgb(17 163 253 / 0%) 100%), #292929;
  }
}

.profile {
  background: linear-gradient(90deg, #ff4e50 0%, #f9d423 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tag {
  position: absolute;
  left: 56px;
  top: -19px;
  display: flex;
  padding: 4px 12px;
  justify-content: center;
  align-items: center;
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 14px;
  line-height: normal;
  text-wrap: nowrap;

  &-ip {
    border-radius: 12.5px 12.5px 12.5px 0;
    background: linear-gradient(87deg, #03c1d9 0%, #57da48 107.49%);
  }

  &-profile {
    border-radius: 12.5px 12.5px 12.5px 0;
    background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);
  }
}

.buy-btn {
  // 固定宽度，避免多语言文案长短导致三列按钮不齐
  flex-shrink: 0;
  width: 7.75rem;
  justify-content: center;
  background: #ff9f2e;
  white-space: nowrap;
  // tt-primary 压过 warn 的按钮字色
  color: var(--component-dropdown-text-active) !important;

  &:hover {
    background: #ff8a00 !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  // 该档资格已用完：灰底灰边，压过 warn 的橙色描边和 hover
  &.is-used,
  &.is-used:hover,
  &.is-used:focus,
  &.is-used:active {
    background: var(--component-scrollbar-indicator, #c7d1d6) !important;
    border-color: var(--component-scrollbar-indicator, #c7d1d6) !important;
  }

  :deep(svg) {
    color: var(--component-dropdown-text-active) !important;
  }
}
</style>
