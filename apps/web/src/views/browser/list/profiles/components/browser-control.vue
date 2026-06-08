<script setup lang="tsx">
import RxTooltip from '/@/components/rx-tooltip'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { SubLevelEnum } from '/@/enums/pay'
import { ProxyExpireStatus } from '/@/enums/proxy'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { windowManager } from '/@/utils/windowManager'
import TrialEnded from '/@/layout/components/header/components/trial-ended.vue'
import { useDialog } from '/@/hooks/useDialog'
import { useSimpleLocale } from '/@/stores/locale'
import type { Driver } from 'driver.js'
import { isDev } from '/@/utils'
import type { SvgNames } from '/@/components/rx-icon'
import { CoreType } from '/@/enums'

interface Props {
  btnId?: string
  disabled?: boolean
  data?: Record<string, any>
  openMessage?: Record<string, any>
  isPublic?: boolean
  text?: string
  icon?: string
  driverObj?: Driver
  driverNext?: () => void
  sendFirstOpenRecord?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  data: () => ({}),
  openMessage: () => ({}),
  isPublic: false,
  text: $t('打开窗口'),
  icon: 'base/rx_ic_chrome',
})

const emits = defineEmits(['open'])

const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()
const router = useRouter()
const simpleLocale = useSimpleLocale()
const { userInfo, userConfig } = storeToRefs(useUserStore())
const { check } = usePermission()

function setOpenMessage(message: Record<string, any>) {
  Reflect.set(props.openMessage as Record<string, any>, props.data.dirId, message)
}

function getLocalizedConnectUrl(connectUrl: string) {
  try {
    const localizedConnectUrl = new URL(connectUrl)
    // 云浏览器前端会优先读取地址栏里的 language 参数来确定文案语言。
    localizedConnectUrl.searchParams.set('language', simpleLocale.currentLocale || 'en')
    return localizedConnectUrl.toString()
  }
  catch {
    return connectUrl
  }
}

const usePeoples = computed(() => {
  const users = props.data.statusInfo.filter((item: any) => item.openUserId !== userInfo.value.id).map((item: any) => item.openUserName)
  if (users.length < 1)
    return ''
  return `${$t('{count} 人正在使用', { count: users.length })}：${users.join(', ')}`
})

const coreInfo = computed(() => {
  return `${props.data.coreType} ${props.data.coreVersion}`
})

const browser = computed(() => {
  const message = props.openMessage[props.data.dirId]

  if (!message) {
    return {
      msg: props.text,
      classes: 'cursor-pointer',
      error: props.data.proxyExpireStatus === ProxyExpireStatus.expired ? $t('您购买的代理 IP 已过期。请在打开窗口前更新代理 IP 信息') : undefined,
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
    error: isFailed ? (message?.message || error?.message) : undefined,
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

  const cloudBrowserDirId = userConfig.value.cloudBrowserActivateInfo?.dirId
  const remainingUsageMs = userConfig.value.cloudBrowserActivateInfo?.remainingUsageMs || 0

  props.driverObj?.destroy()

  // 如果是云浏览器，则直接打开
  if (!globalThis.isElectron && cloudBrowserDirId && isDev) {
    if (cloudBrowserDirId === props.data.dirId) {
      if (remainingUsageMs <= 3000) {
        showModal({
          showHeader: false,
          modal: true,
          blockScroll: true,
          slots: {
            container: ({ hideModal }) => <TrialEnded onClose={hideModal}></TrialEnded>,
          },
        })
        return
      }

      if (windowManager.winMap.value.get(cloudBrowserDirId)) {
        windowManager.open('', props.data.dirId)
        return
      }

      setOpenMessage({
        code: 0,
        pending: false,
        uploading: true,
        data: {
          dirId: props.data.dirId,
          percent: 100,
          message: $t('启动中...'),
          warningMessages: [],
        },
      })

      const { code, data, msg } = await API.window.userGetCloudBrowserInfoList({ windowId: props.data.id })

      if (code === 0 && data.connectUrl) {
        windowManager.open(getLocalizedConnectUrl(data.connectUrl), props.data.dirId)

        // Cloud browser open state should match the launch-process message shape.
        setOpenMessage({
          code,
          pending: false,
          uploading: false,
          data: {
            dirId: props.data.dirId,
            percent: 100,
            message: $t('打开成功'),
            warningMessages: [],
          },
        })
        props.driverNext?.()
        props.sendFirstOpenRecord?.()
      }
      else if (code === 467) {
        showModal({
          showHeader: false,
          modal: true,
          blockScroll: true,
          slots: {
            container: ({ hideModal }) => <TrialEnded onClose={hideModal}></TrialEnded>,
          },
        })
        return
      }
      else {
        onlyErrorToast(-1, msg)
      }
      return
    }
  }

  emits('open', props.data)
}

function onUpgradePlan() {
  const { userPayInfo } = useUserStore()
  const isFree = [SubLevelEnum.Free, SubLevelEnum.Trial].includes(userPayInfo.subLevel as SubLevelEnum)
  const isExpired = userPayInfo.subLevel === SubLevelEnum.Expired

  if (isFree || isExpired) {
    router.push({ name: 'subscribe-plan' })
  }
  else {
    router.push({ name: 'upgrade-plan' })
  }
}

if (!globalThis.isElectron) {
  watch(windowManager.winMap, () => {
    const winMap = windowManager.winMap.value
    const currentWindow = winMap.get(props.data.dirId)

    if (currentWindow && !currentWindow.closed) {
      setOpenMessage({
        code: 0,
        pending: false,
        uploading: false,
        data: {
          dirId: props.data.dirId,
          percent: 100,
          message: $t('打开成功'),
          warningMessages: [],
        },
      })
    }
    else {
      Reflect.deleteProperty(props.openMessage, props.data.dirId)
    }
  }, { immediate: true })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <component :is="check('Cost_Center_all') && !data.openLimitStatus && data.isTransfer ? RxTooltip : 'div'">
      <template #default>
        <div class="control-group flex items-center gap-2">
          <RxButton :id="btnId" class="control" :class="browser.classes" :disabled="!data.openLimitStatus || disabled" size="xxs" outlined severity="secondary" @click.stop="openBrowser">
            <div v-if="!browser.percent || browser.complted" v-tooltip.top="{ value: coreInfo, showDelay: 300 }" class="flex items-center justify-center">
              <SvgIcon class="control-icon pointer-events-none" :name="(icon as SvgNames)" :class="{ firefox: data.coreType === CoreType.Firefox }" />
            </div>
            <CircleProgress v-if="browser.percent && !browser.complted" size="16" :value="browser.percent" />
            <span class="select-none">{{ browser.complted && !browser.uploading ? $t('查看') : browser?.msg }}</span>
          </RxButton>
        </div>
      </template>
      <template #content>
        <i18n-t tag="div" scope="global" class="w-50 error" :keypath="$t('当前临时窗口已过期，请升级窗口用量后继续使用。{link}', { link: '{link}' })">
          <template v-if="!isPublic" #link>
            <span class="cursor-pointer error-link" @click="onUpgradePlan">{{ $t('立即升级') }}</span>
          </template>
        </i18n-t>
      </template>
    </component>
    <RxTooltip v-if="browser?.error || browser?.warning">
      <template #default>
        <SvgIcon name="base/rx_ic_info_fill" :class="[browser?.error ? 'text-red' : 'text-orange']" />
      </template>
      <template #content>
        <i18n-t class="error" tag="div" :keypath="browser.error || browser.warning" scope="global">
          <template v-if="!isPublic" #link>
            {{ $t('要解决此问题，请访问') }}
            <span class="cursor-pointer error-link" @click="router.push({ name: 'agent-list', query: { name: 'shop' } })">{{ $t('代理 IP 页面') }}</span>
          </template>
        </i18n-t>
      </template>
    </RxTooltip>
    <SvgIcon v-if="usePeoples" v-tooltip.top="usePeoples" name="base/rx_ic_user_group" class="text-orange" />
  </div>
</template>

<style lang="scss" scoped>
.control {
  padding: 4px 10px;
  gap: 4px;

  border-radius: 4px;
  border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.control-group:has(.control:not(:disabled)) .control-icon {
  color: #12a3fc;

  &.firefox {
    color: #fd7c12;
  }
}

.error {
  color: var(--component-tooltip-text-primary);
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
