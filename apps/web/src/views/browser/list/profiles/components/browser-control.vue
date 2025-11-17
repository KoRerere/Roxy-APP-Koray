<script setup lang="ts">
import { ProxyExpireStatus } from '/@/enums/proxy'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
  data: {
    type: Object,
    default: () => ({}),
  },
  openMessage: {
    type: Object,
    default: () => ({}),
  },
  isPublic: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: $t('打开'),
  },
  icon: {
    type: String,
    default: 'base/rx_ic_chrome',
  }
})

const emits = defineEmits(['open'])

const router = useRouter()
const userStore = useUserStore()

const usePeoples = computed(() => {
  const count = props.data.statusInfo.filter((item: any) => item.openUserId !== userStore.userInfo.id).length
  if (count < 1) return ''
  return $t('{count} 人正在使用', { count })
})

const browser = computed(() => {
  const message = props.openMessage[props.data.dirId]

  if (!message) {
    return {
      msg: props.text,
      classes: 'cursor-pointer',
      error: props.data.proxyExpireStatus === ProxyExpireStatus.expired ? $t('您购买的代理已过期。请在打开窗口前更新代理信息') : undefined
    }
  }

  const { uploading, pending, code, data, error } = message
  const isFailed = code === 1 || error
  const complted = data?.percent === 100
  const opening = !(isFailed || complted)

  return {
    code,
    pending,
    msg: isFailed ? props.text : data?.message,
    percent: data?.percent || 0,
    error: error?.message || (isFailed ? message?.message : undefined),
    warning: data?.warningMessages?.join('\n'),
    opening,
    uploading,
    complted,
    classes: opening || uploading ? 'cursor-not-allowed' : 'cursor-pointer',
  }
})

async function openBrowser() {
  if (browser.value.pending || browser.value.opening || browser.value.uploading) {
    return
  }
  emits('open', props.data)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <RxButton class="control" :class="browser.classes" :disabled="!data.openLimitStatus || disabled" size="xxs" outlined severity="secondary" @click.stop="openBrowser">
      <CircleProgress v-if="browser.percent && !browser.complted" size="16" :value="browser.percent" />
      <SvgIcon class="control-icon" v-if="!browser.percent && !browser.pending" :name="(icon as any)" />
      <span class="select-none">{{ browser.complted && !browser.uploading ? $t('查看') : browser?.msg }}</span>
    </RxButton>
    <RxTooltip v-if="browser?.error || browser?.warning">
      <template #default>
        <SvgIcon name="base/rx_ic_info_fill" :class="[browser?.error ? 'text-red' : 'text-orange']" />
      </template>
      <template #content>
        <i18n-t class="error" tag="div" :keypath="browser.error || browser.warning" scope="global">
          <template #link v-if="!isPublic">
            {{ $t('要解决此问题，请访问') }}
            <span class="cursor-pointer error-link" @click="router.push({ name: 'agent-list', query: { name: 'shop' } })">{{ $t('代理页面') }}</span>
          </template>
        </i18n-t>
      </template>
    </RxTooltip>
    <SvgIcon v-if="usePeoples" v-tooltip.top="usePeoples" name="base/rx_ic_user_group" class="text-orange" />
  </div>
</template>

<style lang="scss" scoped>
.control {
  padding: var(--spacing-sm, 4px) 10px;
  gap: var(--spacing-sm, 4px);

  border-radius: 4px;
  border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  text-align: center;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &:not(:disabled) {
    .control-icon {
      color: #12A3FC;
    }
  }
}

.error {
  color: var(--component-tooltip-text-primary, #FFF);
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px);

  &-link {
    color: var(--colors-text-text-brand);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
