<script setup lang="tsx">
import RxButton from '/@/components/rx-button'
import RedeemCodeRecord from '/@/layout/components/header/profile/components/record.vue'
import { getImage } from '/@/utils/basic'
import { I18nT } from 'vue-i18n'
import { isString } from 'es-toolkit'
import { enhanceCountdown } from '/@/utils'
import { useUserStore } from '/@/stores/user'
// import { useSimpleLocale } from '/@/stores/locale'
import { useCampaignStore } from '/@/stores/campaign'
import { useRoleStore } from '/@/stores/role'
import { useDialog } from '/@/hooks/useDialog'
import { useThemeStore } from '/@/stores/theme'
import { SubLevelEnum } from '/@/enums/pay'
import { useWorkspaceStore } from '/@/stores/workspace'
import { showToast } from '/@/hooks/useResponseToast/handleBusinessCode'

const emit = defineEmits(['close', 'confirm'])

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const { isOwner } = storeToRefs(useRoleStore())
const { switchDefaultWorkspace } = useWorkspaceStore()
const { currentActivity } = storeToRefs(useCampaignStore())
const { isDarkTheme } = storeToRefs(useThemeStore())
// const { getOfficialWebsite } = useSimpleLocale()
const [showModal] = useDialog()

const styles = useCssModule()

const countdown = ref()
const stopCountdown = ref()

const imgSrc = computed(() => isDarkTheme.value ? 'url("/images/campaing/freedom/modal_bg_dark.jpg")' : 'url("/images/campaing/freedom/modal_bg.jpg")')
const itemImgBg = computed(() => `url(${isDarkTheme.value ? getImage('campaing/freedom/fs_modal_bg-dark.png') : getImage('campaing/freedom/fs_modal_bg.png')})`)

function showInfo() {
  showToast({
    severity: 'warn',
    summary: $t('操作失败'),
    detail: (
      <I18nT keypath={$t('当前活动仅支持在自己的团队参与。{click}', { click: '{click}' })}>
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

const list = computed(() => [
  {
    title: $t('🎁 消费抽盲盒 · 最高赢 MacBook Pro M5'),
    description: $t('升级续费、买 IP、充 AI 积分，笔笔消费都能抽！苹果全家桶等你来拿'),
    benefits: [
      $t('特等奖 MacBook Pro M5 · 一等奖 iPhone 18 Pro Max'),
      $t('二等奖大疆 Pocket 4，三四等奖会员 / IP / AI 积分'),
      $t('三类消费各得 {count} 次抽奖，多买多抽', { count: 1 }),
    ].map(item => isString(item) ? () => item : item),
    btnText: $t('立即充值'),
    btnClick: () => {
      if (isOwner.value) {
        router.push({ name: 'wallet' })
        emit('close')
      }
      else {
        showInfo()
      }
    },

    btnRender: () => {
      return (
        <div class="w-full grid grid-cols-3 gap-2">
          <RxButton class={`flex-row-reverse ${styles.btn}`} size="lg" label={$t('升级窗口')} icon="base/rx_ic_chevron_right" />
          <RxButton class={`flex-row-reverse ${styles.btn}`} size="lg" label={$t('购买代理 IP')} icon="base/rx_ic_chevron_right" />
          <RxButton class={`flex-row-reverse ${styles.btn}`} size="lg" label={$t('购买 AI 积分')} icon="base/rx_ic_chevron_right" />
        </div>
      )
    },
  },
  {
    title: $t('🔍 官网藏彩蛋 · 0 成本领窗口'),
    description: $t('全站隐藏 {count} 个彩蛋，找到就领兑换码，免费扩容不用等', { count: 19 }),
    benefits: [
      $t('玉兔彩蛋：{count} 窗口 · {duration} 个月', { count: 10, duration: 3 }),
      $t('月饼彩蛋：{count} 窗口 · {duration} 个月', { count: 10, duration: 1 }),
      $t('每人限领 {count} 次，先到先得', { count: 1 }),
    ].map(item => isString(item) ? () => item : item),
    btnText: $t('立即开找'),
    btnClick: () => {
      if (isOwner.value) {
        const isSubscribe = [SubLevelEnum.Free, SubLevelEnum.Trial, SubLevelEnum.Expired].includes(userPayInfo.value.subLevel as SubLevelEnum)
        if (isSubscribe) {
          router.push({ name: 'subscribe-plan' })
        }
        else {
          router.push({ name: 'upgrade-plan' })
        }

        emit('close')
      }
      else {
        showInfo()
      }
    },
  },
  {
    title: $t('👥 团队席位 · 买一送一'),
    description: $t('扩容团队不加价！买多少送多少，多买多送不封顶'),
    benefits: [
      $t('买 {count1} 送 {count1}，买 {count2} 送 {count2}', { count1: 1, count2: 5 }),
      $t('赠送席位与购买有效期一致'),
      $t('限时活动，不限购买次数'),
    ].map(item => isString(item) ? () => item : item),
    btnText: $t('马上抢购'),
    btnClick: () => {
      if (isOwner.value) {
        showModal({
          showHeader: false,
          modal: true,
          blockScroll: true,
          slots: {
            container: ({ hideModal }) => <RedeemCodeRecord onClose={hideModal}></RedeemCodeRecord>,
          },
        })
        emit('close')
      }
      else {
        showInfo()
      }
    },
  },
  {
    title: $t('💰 充值返利 · 最高送 {value}%', { value: 40 }),
    description: $t('钱包充值立享返利，充越多送越多，余额即时到账'),
    benefits: [
      $t('最高充 {count} 得 {returnCount} 返利', { count: 1000, returnCount: 400 }),
      $t('四档返利 {value1}% / {value2}% / {value3}% / {value4}%', { value1: 10, value2: 20, value3: 30, value4: 40 }),
      $t('返利即时到账，即充即用'),
    ].map(item => isString(item) ? () => item : item),
    btnText: $t('立即充值'),
    btnClick: () => {
      if (isOwner.value) {
        router.push({ name: 'roxy-claw' })
        emit('close')
      }
      else {
        showInfo()
      }
    },
  },
])

onBeforeMount(() => {
  stopCountdown.value = enhanceCountdown(currentActivity.value.end_timestamp, (time) => {
    countdown.value = Object.entries({
      days: $t('天'),
      hours: $t('小时'),
      minutes: $t('分钟'),
      seconds: $t('秒'),
    }).map(([key, label]) => ({ label, value: time[key as keyof typeof time].toString().padStart(2, '0') }))
  }, { alwaysSecondLevel: true })
})

onBeforeUnmount(() => {
  stopCountdown.value?.stop()
})
</script>

<template>
  <div class="w-270 flex flex-col gap-4 pa-6 pt-7 rounded-3 overflow-hidden content">
    <div class="flex gap-8 items-start">
      <div class="flex-1 flex flex-col gap-0.5">
        <div class="tt-primary font-[Archivo] text-8 font-700 flex items-center gap-2.5 mt-2 ml-2">
          <img class="block h-full aspect-square w-9" :src="getImage('campaing/freedom/palm_tree_icon.svg')">
          {{ $t('中秋狂欢季 · 四重豪礼开抢') }}
        </div>
      </div>
      <div class="flex">
        <div v-for="(item, index) in countdown" :key="item.label" class="flex">
          <div v-if="index !== 0" class="h-14 flex items-center mx-3">
            :
          </div>
          <div class="flex flex-col items-center gap-1.5">
            <div class="size-14 flex items-center justify-center rounded-2 time font-['JetBrains_Mono']">
              {{ item.value }}
            </div>
            <div class="tt-tertiary text-3.25 leading-normal">
              {{ item.label }}
            </div>
          </div>
        </div>
      </div>
      <div class="pa-2 leading-none cursor-pointer" @click="$emit('close')">
        <SvgIcon name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" />
      </div>
    </div>
    <div class="grid gap-3 grid-cols-2">
      <div v-for="item in list" :key="item.title" class="flex flex-col justify-between pa-6 rounded-3 item min-h-260px"
           :style="{ backgroundImage: itemImgBg, backgroundSize: 'cover', backgroundPosition: '50% 100%' }"
      >
        <div class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <div class="tt-primary font-[Archivo] text-5 font-700 leading-6">
              {{ item.title }}
            </div>
            <div class="tt-tertiary font-[Archivo] text-3.25 leading-4.5">
              {{ item.description }}
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex tt-primary text-3.5 font-500 gap-2">
              <div class="flex flex-col gap-2">
                <div v-for="(benefit, index) in item.benefits" :key="index" class="flex gap-1.5">
                  <div class="pt-0.25">
                    <SvgIcon name="base/rx_ic_check_line" size="18" color="var(--colors-icon-icon-success)" />
                  </div>
                  <component :is="benefit" class="font-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex w-full items-center justify-end">
          <component :is="item.btnRender" v-if="item.btnRender" />
          <RxButton v-else class="w-full flex-row-reverse" :class="styles.btn" size="lg" icon="base/rx_ic_chevron_right" :label="item.btnText" @click="item.btnClick" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.btn {
  border: none !important;
  background: linear-gradient(
    91deg,
    var(--campaign-may-freedom-bg-gradient-1, #4096ff) 0%,
    var(--campaign-may-freedom-bg-gradient-2, #01cab3) 100%
  ) !important;
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}
</style>

<style lang="scss" scoped>
.content {
  background-image: v-bind(imgSrc);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}

.item {
  border: 2px solid transparent;
  box-shadow: 0px 0px 0px 1px var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  transition: all 0.2s;

  &:hover {
    border-color: var(--colors-border-border-brand);
    box-shadow: none;
  }
}

.time {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-weight: 700;
  border: 2px solid #619be2;
  background: var(--colors-background-bg-action);
}
</style>
