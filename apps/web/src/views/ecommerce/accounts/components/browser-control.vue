<script setup lang="ts">
import RxTooltip from '/@/components/rx-tooltip'
import type { SvgNames } from '/@/components/rx-icon'
import { CoreType, ProxyType } from '/@/enums'
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useProxyShopLabels } from '/@/views/agent/shop/utils/proxy-shop-labels'
import { useRouteContext } from '/@/composables/useRouteContext'
import { buildExpiredBoundDeviceListRoute } from '/@/views/ecommerce/devices/device-operation'
import { hasBoundEcommerceDevice, useEcommerceAccountDeviceBind } from '/@/views/ecommerce/accounts/hooks/useEcommerceAccountDeviceBind'
import type { Driver } from 'driver.js'
import type { ProfileOpenMessage, ProfileRow } from '/@/views/browser/list/profiles/hooks/useProfileOpenState'
import { useBrowserControl } from '/@/views/browser/list/profiles/hooks/useBrowserControl'

interface Props {
  btnId?: string
  disabled?: boolean
  data: ProfileRow
  openMessage?: Record<string, ProfileOpenMessage>
  text?: string
  icon?: string
  driverObj?: Driver
  driverNext?: () => void
  sendFirstOpenRecord?: () => void
}

const {
  btnId,
  disabled = false,
  data,
  openMessage = {},
  text,
  icon = 'base/rx_ic_chrome',
  driverObj,
  driverNext,
  sendFirstOpenRecord,
} = defineProps<Props>()

const emits = defineEmits<{
  open: [data: ProfileRow]
}>()

const router = useRouter()
const { isPublicMember } = useRouteContext()
const profileLabels = useProfileEntityLabels()
const shopLabels = useProxyShopLabels()
const { promptAccountDeviceBind } = useEcommerceAccountDeviceBind()

const openButtonText = computed(() => text ?? profileLabels.value.open)

const {
  browser,
  coreInfo,
  isOpenLimitReached,
  isCrossModeExpired,
  crossModeExpiredTip,
  isButtonDisabled,
  usePeoples,
  showErrorTooltip,
  openBrowser,
} = useBrowserControl({
  data,
  openMessage,
  text: openButtonText,
  driverObj,
  driverNext: () => driverNext?.(),
  sendFirstOpenRecord: () => sendFirstOpenRecord?.(),
  onOpen: row => emits('open', row),
})

/** 电商账号是否已绑定设备 */
const hasBoundDevice = computed(() => hasBoundEcommerceDevice(data))

/** 绑定的是平台购买设备（不可续费，需替换） */
const isBuyBoundDevice = computed(() => data.buyProxyType === ProxyType.buy)

function handleDeviceRenewClick(hide?: () => void) {
  hide?.()
  router.push(buildExpiredBoundDeviceListRoute(data.moduleId))
}

function handleBindDeviceClick(hide?: () => void) {
  promptAccountDeviceBind(data, hide)
}
</script>

<template>
  <div class="flex items-center gap-2" @click.stop>
    <RxTooltip>
      <template #default>
        <div class="control-group flex items-center gap-2" :class="{ 'control-group--limited': isOpenLimitReached }">
          <RxButton :id="btnId" class="control" :class="browser.classes" :disabled="isButtonDisabled || disabled" size="xxs" outlined severity="secondary" @click.stop="openBrowser">
            <div v-if="!browser.percent || browser.completed" v-tooltip.top="{ value: isOpenLimitReached ? undefined : coreInfo, showDelay: 300 }" class="flex items-center justify-center">
              <SvgIcon v-if="isOpenLimitReached" class="control-icon pointer-events-none" name="base/rx_ic_lock" />
              <SvgIcon v-else class="control-icon pointer-events-none" :name="(icon as SvgNames)" :class="{ firefox: data.coreType === CoreType.Firefox }" />
            </div>
            <CircleProgress v-if="browser.percent && !browser.completed" size="16" :value="browser.percent" />
            <span class="select-none">{{ browser.completed && !browser.uploading ? $t('查看') : browser.msg }}</span>
          </RxButton>
        </div>
      </template>
      <template v-if="isOpenLimitReached" #content="{ hide }">
        <div v-if="isCrossModeExpired" class="quota-tooltip">
          {{ crossModeExpiredTip }}
        </div>
        <i18n-t v-else-if="!hasBoundDevice" tag="div" scope="global" class="quota-tooltip" :keypath="$t('当前账号未绑定设备，请{link}', { link: '{link}' })">
          <template #link>
            <span class="cursor-pointer quota-tooltip-link" @click="handleBindDeviceClick(hide)">{{ $t('绑定设备') }}</span>
          </template>
        </i18n-t>
        <div v-else-if="isBuyBoundDevice" class="quota-tooltip">
          {{ $t('当前设备已过期，无法打开账号。若需打开当前账号，请替换其他设备') }}
        </div>
        <i18n-t v-else tag="div" scope="global" class="quota-tooltip" :keypath="$t('当前设备已过期，请{link}', { link: '{link}' })">
          <template #link>
            <span class="cursor-pointer quota-tooltip-link" @click="handleDeviceRenewClick(hide)">{{ $t('续费') }}</span>
          </template>
        </i18n-t>
      </template>
    </RxTooltip>
    <RxTooltip v-if="showErrorTooltip">
      <template #default>
        <SvgIcon name="base/rx_ic_info_fill" :class="[browser.error ? 'text-red' : 'text-orange']" />
      </template>
      <template #content>
        <i18n-t class="error" tag="div" :keypath="browser.error || browser.warning!" scope="global">
          <template v-if="!isPublicMember" #link>
            {{ $t('要解决此问题，请访问') }}
            <span class="cursor-pointer error-link" @click="router.push({ name: 'ecommerce-device-list' })">{{ shopLabels.resourcePageLink }}</span>
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

.control-group--limited .control:disabled {
  pointer-events: none;
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

.quota-tooltip {
  color: var(--component-tooltip-text-secondary, #c7d1d6);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;

  &-link {
    color: var(--colors-text-text-brand, #11a3fd);
    font-weight: 400;
  }
}
</style>
