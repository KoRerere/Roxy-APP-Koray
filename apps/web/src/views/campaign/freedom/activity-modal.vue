<script setup lang="tsx">
import RedeemCodeRecord from '/@/layout/components/header/profile/components/record.vue'
import { I18nT } from 'vue-i18n'
import { isString } from 'es-toolkit'
import { enhanceCountdown } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
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
const { getOfficialWebsite } = useSimpleLocale()
const [showModal] = useDialog()

const styles = useCssModule()

const countdown = ref()
const stopCountdown = ref()

const imgSrc = computed(() => isDarkTheme.value ? 'url("/images/campaing/freedom/modal_bg_dark.jpg")' : 'url("/images/campaing/freedom/modal_bg.jpg")')
const itemImgBg = computed(() => `url(${isDarkTheme.value ? '/images/campaing/freedom/fs_modal_bg-dark.png' : '/images/campaing/freedom/fs_modal_bg.png'})`)

function showInfo() {
  showToast({
    severity: 'warn',
    summary: $t('操作失败'),
    detail: (
      <I18nT keypath={$t('当前活动仅支持在自己的工作空间参与。{click}', { click: '{click}' })}>
        {{ click: () => (
          <a
            class="cursor-pointer"
            onClick={() => {
              switchDefaultWorkspace()
              emit('close')
            }}
          >
            {$t('返回我的默认工作空间')}
          </a>
        ) }}
      </I18nT>
    ),
    life: 5000,
  })
}

const list = computed(() => [
  {
    title: $t('五一充值专享，三重永久特权解锁'),
    description: $t('开启出海自动化新征程'),
    need: $t('* 活动期间成功充值，即可解锁以上权益'),
    benefits: [
      $t('永久身份标签，锁定 May Freedom 尊享荣誉'),
      $t('账户终身 {value}% 折扣权益', { value: currentActivity.value.discount }),
      $t('获得一年 Beta 版新功能优先内测体验权'),
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
  },
  {
    title: $t('订阅惊喜盲盒，限时自动升舱'),
    description: $t('活动期间订阅即享自动升档，解锁盲盒大奖'),
    benefits: [
      $t('订阅即触发免费升档，100 窗口价格享 200 窗口'),
      $t('5.1% 概率赢专业版 1000 窗口一年权益'),
      $t('活动期间购买任意数量团队成员，额外加送两个席位'),
    ].map(item => isString(item) ? () => item : item),
    btnText: $t('立即订阅'),
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
    title: $t('老友回馈礼 · 专属三枚体验码'),
    description: $t('感谢一路同行，专属礼包助力好友业务高效起步'),
    need: $t('* 仅限部分符合条件的老用户参与'),
    needInfo: $t('仅限 2026 年 4 月 25 日前注册的用户'),
    benefits: [
      $t('获取 3 枚（50窗口）7 天体验码'),
      $t('好友兑换后立享 7 天高级窗口权益'),
      $t('好友购买任意 IP，您立享 25%高额返利'),
    ].map(item => isString(item) ? () => item : item),
    btnText: $t('前往查看'),
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
    title: $t('体验前沿科技，晒图赢取 MacBook Pro'),
    description: $t('智控未来，业务全开，晒出你的 Roxy AI 躺平时刻'),
    content: () => (
      <div class="text-[var(--colors-text-text-primary)]">
        {$t('晒出 Telegram/飞书 操控 RoxyClaw 或 Roxy AI Agent 体验MCP & Skills 运行画面截图, 带话题 #RoxyBrowser 发布至任意社交平台')}
      </div>
    ),
    benefits: [
      $t('截图发给客服，必得团队成员席位，再抽 MacBook Pro，iPhone17 Pro 等好礼'),
    ].map(item => isString(item) ? () => item : item),
    btnText: $t('立即参与'),
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
          <img class="block h-full aspect-square w-9" src="/images/campaing/freedom/palm_tree_icon.svg">
          {{ $t('Roxy 五月自由季') }}
        </div>
        <!-- <div class=" tt-secondary font-[Archivo] text-4.5 leading-normal">
          {{ $t('AI在工作，你在度假 —— 五一躺平，让 AI 帮你操控浏览器继续跑业务') }}
        </div> -->
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
            <!-- <div class="tt-tertiary font-[Archivo] text-3.25 leading-4.5">
              {{ item.description }}
            </div> -->
          </div>

          <div class="flex flex-col gap-3">
            <!-- <div v-if="item.need" class="tt-primary text-3.5 font-500 leading-5">
              <span>{{ $t('活动资格：') }}</span>
              <span>{{ item.need }}</span>
            </div> -->

            <div v-if="item.content" class="flex tt-primary text-3.5 font-500 leading-5">
              <div class="shrink-0 font-700">
                {{ $t('活动内容：') }}
              </div>

              <component :is="item.content" />
            </div>

            <div class="flex tt-primary text-3.5 font-500 gap-2">
              <div class="shrink-0 font-700">
                {{ $t('活动权益：') }}
              </div>
              <div class="flex flex-col gap-2">
                <div v-for="(benefit, index) in item.benefits" :key="index" class="flex gap-1.5">
                  <div class="pt-0.25">
                    <SvgIcon name="base/rx_ic_check_line" size="18" color="var(--colors-icon-icon-success)" />
                  </div>
                  <component :is="benefit" class="font-400" />
                </div>
              </div>
            </div>

          <!-- <div class="pl-18.5 pt-2">

          </div> -->
          </div>
        </div>

        <div class="flex w-full items-center" :class="item.need ? 'justify-between' : 'justify-end'">
          <div v-if="item.need" class="text-[var(--colors-text-text-tertiary)] text-3.5 font-500 leading-5 flex items-center gap-1">
            <div>{{ item.need }}</div>
            <RxTooltip v-if="item.needInfo">
              <SvgIcon name="base/rx_ic_info" color="var(--colors-icon-icon-note)" class="cursor-pointer -mb-0.5" />
              <template #content>
                <span class="text-white">{{ item.needInfo }}</span>
              </template>
            </RxTooltip>
            <!-- <div v-tooltip.top="{ value: item.needInfo }" class="flex items-center">

            </div> -->
          </div>

          <RxButton class="flex-row-reverse btn" size="lg" icon="base/rx_ic_chevron_right" :label="item.btnText" @click="item.btnClick" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.link {
  color: var(--colors-text-text-link);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
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
