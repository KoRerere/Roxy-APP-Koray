<script setup lang="ts">
import QRCode from 'qrcode'
import { useRoleStore } from '/@/stores/role'
import { useSimpleLocale } from '/@/stores/locale'
import {
  fetchWorkspaceKycUnlockedCached,
  getProxyDownloadBlockTooltip,
  getProxyDownloadBlockVariant,
  isBuyProxy,
  openProxyKycVerification,
} from '../utils/proxy-download-kyc-gate'
import type { ProxyItem } from '../operation'

const { data } = defineProps<{
  data: ProxyItem
}>()

const roleStore = useRoleStore()
const simpleLocale = useSimpleLocale()

const qrcodeList = ref<Array<{ name: string, value: string }>>()
const qrcode = ref<string>()
/** null 表示 KYC 检查中或未触发；true 拦截；false 已放行 */
const kycBlocked = ref<boolean | null>(null)

const blockTooltip = computed(() =>
  getProxyDownloadBlockTooltip(simpleLocale.currentLocale, roleStore.isOwner),
)

const canGoVerify = computed(() =>
  getProxyDownloadBlockVariant(simpleLocale.currentLocale, roleStore.isOwner) === 'owner',
)

const blockedTooltipOptions = computed(() => ({
  value: blockTooltip.value,
  showDelay: 500,
  hideDelay: 300,
  autoHide: false,
  pt: {
    root: '!max-w-sm',
    text: { class: '!whitespace-pre-wrap' },
  },
}))

onMounted(async () => {
  if (data.isDirect)
    return

  if (!isBuyProxy(data)) {
    await genQrCode()
    return
  }

  const unlocked = await fetchWorkspaceKycUnlockedCached()
  kycBlocked.value = !unlocked
  if (unlocked)
    await genQrCode()
})

async function genQrCode() {
  const { isDirect, protocol, host, port, proxyUserName, proxyPassword } = data

  if (isDirect || !proxyUserName || !proxyPassword)
    return

  const protocols = protocol.split('/').map((item: string) => item.toLocaleLowerCase()) || []
  const ports = port.toString().split('/') || []

  qrcodeList.value = await Promise.all(protocols.map(async (protocol: string, index: number) => {
    const btoaStr = btoa(`${proxyUserName}:${proxyPassword}@${host}:${ports[index] || ports[0]}`)
    const qrcodeValue = await QRCode.toDataURL(`${protocol}://${btoaStr}`, { margin: 0 })
    return { name: protocol, value: qrcodeValue }
  }))

  qrcode.value = qrcodeList.value[0].value
}

function onBlockedClick() {
  if (!canGoVerify.value)
    return

  openProxyKycVerification()
}

function onTooltipGoVerify(hide: () => void) {
  openProxyKycVerification()
  hide()
}
</script>

<template>
  <div v-if="data.isDirect" class="flex items-center">
    <SvgIcon name="base/rx_ic_qrcode" color="var(--colors-icon-icon-inactive)" />
  </div>
  <RxTooltip
    v-else-if="kycBlocked && canGoVerify"
    class="flex items-center"
    placement="top"
    :delay="500"
    tooltip-content-class="proxy-kyc-tooltip"
  >
    <template #default>
      <div class="flex items-center kyc-blocked kyc-blocked--owner" @click="onBlockedClick">
        <SvgIcon name="base/rx_ic_qrcode" color="var(--colors-icon-icon-inactive)" />
      </div>
    </template>
    <template #content="{ hide }">
      <div class="proxy-kyc-tooltip__body">
        <p class="proxy-kyc-tooltip__desc">
          {{ blockTooltip }}
        </p>
        <RxButton
          size="sm"
          :label="$t('去认证')"
          @click="onTooltipGoVerify(hide)"
        />
      </div>
    </template>
  </RxTooltip>
  <div
    v-else-if="kycBlocked"
    v-tooltip.top="blockedTooltipOptions"
    class="flex items-center kyc-blocked"
  >
    <SvgIcon name="base/rx_ic_qrcode" color="var(--colors-icon-icon-inactive)" />
  </div>
  <div v-else-if="kycBlocked === null && isBuyProxy(data)" class="flex items-center">
    <SvgIcon name="base/rx_ic_qrcode" color="var(--colors-icon-icon-inactive)" />
  </div>
  <RxTooltip v-else-if="qrcode" class="flex items-center" tooltip-content-class="bg-white">
    <template #default>
      <SvgIcon name="base/rx_ic_qrcode" color="var(--colors-icon-icon-secondary)" />
    </template>
    <template #content>
      <div class="flex flex-col items-center gap-3">
        <RxSelectButton v-if="qrcodeList && qrcodeList.length > 1" v-model="qrcode" :options="qrcodeList" size="xxs" option-label="name" option-value="value" data-key="value" />
        <div class="w-36 pa-3 rounded-1 image">
          <img class="block w-30 aspect-square" :src="qrcode">
        </div>
      </div>
    </template>
  </RxTooltip>
</template>

<style scoped>
.image {
  border: 1px solid var(--colors-border-border-inactive);
}

.kyc-blocked {
  cursor: not-allowed;

  &--owner {
    cursor: pointer;
  }
}
</style>

<style lang="scss">
.proxy-kyc-tooltip {
  max-width: 24rem;
}

.proxy-kyc-tooltip__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.proxy-kyc-tooltip__desc {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  white-space: pre-wrap;
  color: var(--component-tooltip-text-primary);
}

.proxy-kyc-tooltip__body .p-button {
  align-self: flex-end;
}
</style>
