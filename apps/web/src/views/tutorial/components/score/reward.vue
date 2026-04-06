<script setup lang="tsx">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { executeSomethingByBackToSelfWorkspace } from '/@/hooks/useResponseToast/handleBusinessCode'

const emit = defineEmits(['close'])

const router = useRouter()
const [_, onlyErrorToast] = useResponseToast()
const { mixpanelTrack } = useUserStore()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()

const step = ref<'choose' | 'success'>('choose')
const externalUrl = ref()

async function checkResult() {
  mixpanelTrack('review_redeem_gift')
  const { code, msg } = await API.base.userGetRatingRewardCreate({ platformType: 1, externalUrl: externalUrl.value })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  mixpanelTrack('review_ip_success')
  step.value = 'success'
  updateOnboardingTaskStatus({ ratingStatus: true })
}

function toProxyList() {
  emit('close')
  executeSomethingByBackToSelfWorkspace(() => {
    router.push({ name: 'agent-list', query: { name: 'shop' } })
  })()
}
</script>

<template>
  <div v-if="step === 'choose'" class="relative w-120 inline-flex flex-col pa-6 pt-10 rounded-2 select-none popup">
    <SvgIcon class="absolute top-5 right-5 cursor-pointer" name="base/rx_ic_delete" size="20" @click="$emit('close')" />

    <div class="mb-8 flex flex-col gap-2.5">
      <div class="subtitle">
        {{ $t('感谢您的好评，我们为您准备了以下礼品:') }}
      </div>

      <div class="relative h-14 flex justify-between items-center pa-3 rounded-1.5 gift">
        <div class="flex items-center gap-3">
          <img draggable="false" class="w-8 h-8" src="/images/score-proxy.svg">
          <div class="gift-title">
            {{ $t('美国静态住宅代理 IP x {count}', { count: 1 }) }}
          </div>
        </div>
        <div class="gift-desc">
          {{ $t('{day} 天有效期，无限流量', { day: 5 }) }}
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div class="subtitle">
        {{ $t('两步即可获得我们提供的 IP 礼品: ') }}
      </div>

      <i18n-t tag="div" class="terms" :keypath="$t('1.在 Trustpilot 网站留下 RoxyBrowser 的五星评价: {link}', { link: '{link}' })">
        <template #link>
          <a href="https://uk.trustpilot.com/evaluate/roxybrowser.com" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 terms-link"
             @click="mixpanelTrack('review_redirect_trustpilot')"
          >
            {{ $t('去评论') }}
            <SvgIcon name="base/rx_ic_outlink" />
          </a>
        </template>
      </i18n-t>
      <div class="flex flex-col gap-2">
        <div class="terms">
          {{ $t('2.请粘贴评论成功页的链接:') }}
        </div>
        <TsFormInputText v-model="externalUrl" size="lg" pre-icon="base/rx_ic_link" :placeholder="$t('粘贴链接')" />
      </div>
      <RxButton size="lg" :label="$t('提交审核并兑换礼品')" :disabled="!externalUrl" @click="checkResult" />

      <div class="flex flex-col gap-1">
        <div class="help">
          {{ $t('* 链接应该类似: {example}', { example: 'https://trustpilot.com/submitted/review?correlationid=' }) }}
        </div>
        <div class="help">
          {{ $t('* 您可在右下角帮助中心随时找到当前奖励弹窗') }}
        </div>
      </div>
    </div>
  </div>

  <div v-if="step === 'success'" class="w-130 inline-flex flex-col pa-6 pt-10 gap-6 rounded-2 select-none popup">
    <div class="flex flex-col gap-2 items-center">
      <div class="thanks">
        🎉
      </div>
      <div class="title">
        {{ $t('IP 已发放成功') }}
      </div>
      <div class="text-center desc">
        {{ $t('5 天静态住宅 IP 1 条 已自动添加至您的已购代理 IP 列表') }}
      </div>
    </div>
    <div class="w-full flex flex-col gap-3">
      <RxButton size="lg" :label="$t('查看已购代理 IP 列表')" @click="toProxyList" />
      <RxButton size="lg" variant="outlined" severity="secondary" :label="$t('关闭')" @click="$emit('close')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  background-color: var(--colors-background-bg-page);
  background-image: url('/images/score-bg.png');
  background-size: 100% auto;
  background-repeat: no-repeat;
}

.thanks {
  font-size: 58.667px;
  font-weight: 600;
  line-height: 80px;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-style: normal;
  font-weight: 700;
  line-height: 36px;
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.gift {
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-action);

  &-title {
    color: var(--colors-text-text-primary);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    font-weight: 700;
  }

  &-desc {
    color: var(--colors-text-text-inactive);
    font-size: 12px;
  }
}

.desc {
  color: var(--colors-text-text-placeholder);
  font-size: 13px;
  line-height: 18px;
}

.terms {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: normal;

  &-link {
    color: var(--colors-text-text-brand);
    font-weight: 700;
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: auto;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}

.help {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: normal;
}
</style>
