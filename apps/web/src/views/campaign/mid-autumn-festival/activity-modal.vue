<script setup lang="tsx">
import RxButton from '/@/components/rx-button'
import { format } from 'date-fns'
import { getImage } from '/@/utils/basic'
import { I18nT } from 'vue-i18n'
import { isString } from 'es-toolkit'
import { enhanceCountdown } from '/@/utils'
// import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { useRoleStore } from '/@/stores/role'
// import { SubLevelEnum } from '/@/enums/pay'
import { useWorkspaceStore } from '/@/stores/workspace'
import { showToast } from '/@/hooks/useResponseToast/handleBusinessCode'
import { emitter } from '/@/utils/eventBus'
import { REDIRECT_ACTION } from '/@/constants/search-params-key'
import { formatRechargeBenefitText, useMidAutumnActivity } from './hook'

const emit = defineEmits(['close', 'confirm'])

const router = useRouter()
// const { userPayInfo } = storeToRefs(useUserStore())
const { isOwner } = storeToRefs(useRoleStore())
const { switchDefaultWorkspace } = useWorkspaceStore()
const { currentActivity, maxBonus } = storeToRefs(useCampaignStore())
const { currentLocale } = storeToRefs(useSimpleLocale())
const { getOfficialWebsite } = useSimpleLocale()
const { showLuckyDraw } = useMidAutumnActivity()

const styles = useCssModule()

const countdown = ref()
const stopCountdown = ref()

const imgSrc = computed(() => `url('${getImage('campaing/mid-autumn-festival/modal_bg.jpg')}')`)
/** 标题图按语言切资源，缺语言时回退中文 */
const eventTitleSrc = computed(() => {
  const suffix = ['zh-CN', 'en', 'ru'].includes(currentLocale.value!) ? currentLocale.value : 'zh-CN'
  return getImage(`campaing/mid-autumn-festival/event_title_${suffix}.svg`)
})

const eventRange = computed(() => {
  const start = format(currentActivity.value.start_timestamp, 'MM/dd HH:mm')
  const end = format(currentActivity.value.end_timestamp, 'MM/dd HH:mm')
  return $t('活动时间：{start} - {end}', { start, end })
})

const list = computed(() => [
  {
    icon: getImage('campaing/mid-autumn-festival/gift_box.svg'),
    title: $t('笔笔消费抽豪礼！'),
    description: $t('每次升级、续费、购买代理 IP 或充值 AI 积分，均可获得 1 次 Mac / iPhone 抽奖机会。'),
    benefitRender: () => {
      const award = [
        {
          title: $t('特等奖'),
          img: getImage('campaing/mid-autumn-festival/award_1.png'),
          description: $t('MacBook Pro M5 Pro 24GB + 1TB（1台）'),
        },
        {
          title: $t('一等奖'),
          img: getImage('campaing/mid-autumn-festival/award_2.png'),
          description: $t('iPhone 18 Pro Max 512GB（3台）'),
        },
        {
          title: $t('二等奖'),
          img: getImage('campaing/mid-autumn-festival/award_3.png'),
          description: $t('DJI Pocket 4（10台）'),
        },
        {
          title: $t('参与奖'),
          img: getImage('campaing/mid-autumn-festival/award_4.png'),
          description: $t('窗口会员 · 美国原生代理 IP · AI 积分'),
        },
      ]

      return (
        <div class="-mt-1 flex gap-2.5">
          {award.map(item => (
            <div class="flex-1 flex flex-col pa-2 pb-3 items-center gap-2 rounded-2 bg-white/10">
              <div class="text-3.5 font-600 leading-5 color-white">{item.title}</div>
              <img class="w-15" src={item.img} />
              <div class="text-3 leading-4.5 color-white text-center">{item.description}</div>
            </div>
          ))}
        </div>
      )
    },
    btnText: $t('查看我的抽奖机会'),
    btnClick: () => {
      if (isOwner.value) {
        emit('close')
        showLuckyDraw()
      }
      else {
        showInfo()
      }
    },
  },
  {
    icon: getImage('campaing/mid-autumn-festival/discount.svg'),
    title: $t('充值有礼！最高加送 {discount}%', { discount: maxBonus.value }),
    description: $t('充得越多送得越猛，一次充足更划算！'),
    benefits: currentActivity.value.recharge_benefits.map(formatRechargeBenefitText),
    btnText: $t('立即充值'),
    btnClick: () => {
      if (isOwner.value) {
        emit('close')
        router.push({
          name: 'wallet',
          query: {
            name: 'manage',
            [REDIRECT_ACTION]: 'open-wallet-modal',
          },
        })
      }
      else {
        showInfo()
      }
    },
  },
  {
    icon: getImage('campaing/mid-autumn-festival/team_member.svg'),
    title: $t('团队席位 · 买 {count} 送 {count} 不限量', { count: 1 }),
    description: $t('团队、团队成员均参与 · 买多少送多少'),
    benefits: [
      $t('团队：买 {count} 送 {count}，买多少送多少', { count: 1 }),
      $t('团队成员：买 {count} 送 {count}，买多少送多少', { count: 1 }),
      $t('购买及赠送的团队、团队成员均终身有效'),
      $t('优惠自动生效，不限购买次数'),
    ],
    btnText: $t('立即购买'),
    btnClick: () => {
      if (isOwner.value) {
        emit('close')
        emitter.emit('showExpandDialog', {
          paySuccess: () => {
            emitter.emit('updateBillList')
          },
        })
      }
      else {
        showInfo()
      }
    },
    visible: currentActivity.value.team_bogo,
  },
  {
    icon: getImage('campaing/mid-autumn-festival/magnifying_glass.svg'),
    title: $t('全网寻宝！免费兑换会员权益'),
    description: $t('寻找隐藏彩蛋 · 解锁最高 3 个月奖励'),
    benefits: [
      <div class="color-white text-3.5 leading-5">{$t('🐇 玉兔：会员权益 · {month} 个月', { month: 3 })}</div>,
      <div class="color-white text-3.5 leading-5">{$t('🥮 月饼：会员权益 · {month} 个月', { month: 1 })}</div>,
    ],
    tip: $t('每日奖池：玉兔 {count1} 份 · 月饼 {count2} 份，17:00 (北京时间) 重置；活动期间每人限领 1 份', { count1: 2, count2: 18 }),
    btnText: $t('前往官网寻找'),
    btnClick: () => {
      emit('close')
      window.open(getOfficialWebsite(), '_blank')
    },
  },
].filter(item => item.visible !== false))

onBeforeMount(() => {
  stopCountdown.value = enhanceCountdown(currentActivity.value.end_timestamp, (time) => {
    countdown.value = Object.entries({
      days: $t('天'),
      hours: $t('时'),
      minutes: $t('分'),
      seconds: $t('秒'),
    }).map(([key, label]) => ({ label, value: time[key as keyof typeof time].toString().padStart(2, '0') }))
  }, {
    alwaysSecondLevel: true,
    onEnd: () => {
      emit('close')
    },
  })
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})

function showInfo() {
  showToast({
    severity: 'warn',
    summary: $t('操作失败'),
    detail: (
      <I18nT keypath={$t('当前活动仅支持在自己的团队参与。{click}', { click: '{click}' })} scope="global">
        {{
          click: () => (
            <a
              class="cursor-pointer"
              onClick={() => {
                switchDefaultWorkspace()
                emit('close')
              }}
            >
              {$t('返回我的默认团队')}
            </a>
          ),
        }}
      </I18nT>
    ),
    life: 5000,
  })
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-1.5 overflow-hidden">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="$emit('close')" />
    <div class="flex-1 min-h-0 w-270 grid rounded-3 overflow-hidden content">
      <RxMaskScroll class="flex flex-col gap-4 pa-6 pt-7">
        <div class="flex gap-8 items-center">
          <div class="flex-1 flex flex-col gap-1.5">
            <div>
              <img class="h-5" :src="eventTitleSrc">
            </div>
            <div class="title">
              {{ $t('金秋狂欢季 · 四重豪礼享不停') }}
            </div>
            <div class="flex items-center gap-2 color-white/80 text-4 leading-5.5">
              <span>{{ $t('官网寻隐藏惊喜') }}</span>
              <span class="text-3.25">|</span>
              <span>{{ $t('APP 三重福利同步开启') }}</span>
              <RxTooltip class="flex items-center" :content="eventRange">
                <SvgIcon class="cursor-pointer" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
                <template #content>
                  <span class="color-white text-3.5">{{ eventRange }}</span>
                </template>
              </RxTooltip>
            </div>
          </div>
          <div class="flex">
            <div v-for="(item, index) in countdown" :key="item.label" class="flex">
              <div v-if="index !== 0" class="h-14 flex items-center mx-3 text-8 leading-none color-white/80">
                :
              </div>
              <div class="flex flex-col items-center gap-1.5">
                <div class="size-14 flex items-center justify-center time">
                  {{ item.value }}
                </div>
                <div class="color-white text-3.25 leading-normal">
                  {{ item.label }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="grid gap-3 grid-cols-10">
          <div v-for="(item, index) in list" :key="item.title" class="min-h-65 flex flex-col justify-between pa-4 rounded-3 item"
               :class="index === 0 ? 'col-span-6' : index === 1 ? 'col-span-4' : 'col-span-5'"
          >
            <div class="flex flex-col gap-4 pb-5">
              <div class="flex flex-col gap-2">
                <div class="flex items-start gap-2">
                  <img :src="item.icon" class="size-6">
                  <div class="color-white text-5 font-700 leading-6">
                    {{ item.title }}
                  </div>
                  <div v-if="index === 0" class="rewards">
                    {{ $t('100% 中奖') }}
                  </div>
                </div>
                <div class="color-white text-3.5 leading-4.5">
                  <component :is="isString(item.description) ? () => item.description : item.description" />
                </div>
              </div>

              <component :is="item.benefitRender" v-if="item.benefitRender" />

              <div v-else class="flex gap-2">
                <div class="shrink-0 color-white text-3.5 font-700 leading-5">
                  {{ $t('奖项设置') }}:
                </div>
                <div class="flex flex-col gap-2">
                  <div v-for="(benefit, idx) in item.benefits" :key="idx" class="flex items-start gap-1.5">
                    <component :is="benefit" v-if="!isString(benefit)" />
                    <template v-else>
                      <SvgIcon class="mt-0.25" name="base/rx_ic_check_line" size="18" color="var(--colors-icon-icon-success)" />
                      <div class="color-white text-3.5 leading-5">
                        {{ benefit }}
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <div v-if="item.tip" class="whitespace-pre-line color-white/80 text-3 leading-4.5">
                {{ item.tip }}
              </div>
            </div>
            <div class="flex w-full items-center justify-end">
              <RxButton class="w-full flex-row-reverse" :class="styles.btn" size="lg" icon="base/rx_ic_chevron_right" :label="item.btnText" @click="item.btnClick" />
            </div>
          </div>
        </div>
      </RxMaskScroll>
    </div>
  </div>
</template>

<style lang="scss" module>
.discount {
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 14px;
  font-weight: 600;
  line-height: 140%;
}

.btn {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: none !important;
  border-radius: var(--radius-lg, 8px);
  background: linear-gradient(94deg, #7743ef 0.24%, #8e61f7 100.24%) !important;
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);

  /* 渐变无法直接插值，用叠层透明度过渡 hover 色 */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: linear-gradient(94deg, #662ced 0.24%, #7c47f5 100.24%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }

  &:not(:disabled):hover::before {
    opacity: 1;
  }
}
</style>

<style lang="scss" scoped>
.content {
  background-image: v-bind(imgSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: top center;
  /* 活动弹窗始终深色底，滚动遮罩需贴合背景而非主题 overlay */
  --colors-background-bg-overlay: #1a2744;
}

.title {
  font-family: Archivo;
  font-size: 32px;
  font-weight: 700;
  line-height: 150%;
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.time {
  color: #fff;
  font-family: 'JetBrains Mono';
  font-size: 24px;
  font-weight: 700;
  line-height: 150%;
  border-radius: 8px;
  border: 2px solid #fbd99b;
  background: var(--colors-alpha-alpha-black-10, rgba(0, 0, 0, 0.1));
  backdrop-filter: blur(6px);
}

.item {
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: #273247;
  backdrop-filter: blur(10px);
}

.rewards {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 10000px;
  background: linear-gradient(90deg, #b5cefe 0%, #d0b4fc 100%);
  color: #272e3b;
  font-family: 'DingTalk JinBuTi';
  font-size: 14px;
  line-height: 140%;
}
</style>
