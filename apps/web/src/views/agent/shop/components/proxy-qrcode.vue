<script setup lang="ts">
import QRCode from 'qrcode'
import { useRoleStore } from '/@/stores/role'
import { useSimpleLocale } from '/@/stores/locale'
import {
  fetchWorkspaceKycUnlockedCached,
  getProxyDownloadBlockTooltip,
  getProxyDownloadBlockVariant,
  isBuyProxy,
  isDirectExportBlocked,
  openProxyKycVerification,
  resolveProxyDownloadRow,
} from '../utils/proxy-download-kyc-gate'
import type { ProxyItem } from '../operation'

const { data, mode = 'trigger' } = defineProps<{
  data: ProxyItem
  /** trigger：快捷栏图标 + Tooltip；panel：子菜单内嵌展示 */
  mode?: 'trigger' | 'panel'
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

const directExportBlocked = computed(() => isDirectExportBlocked(data))

onMounted(async () => {
  if (directExportBlocked.value) {
    return
  }

  if (!isBuyProxy(data)) {
    await genQrCode()
    return
  }

  kycBlocked.value = null
  const unlocked = await fetchWorkspaceKycUnlockedCached()
  kycBlocked.value = !unlocked
  if (unlocked) {
    await genQrCode()
  }
})

async function genQrCode() {
  const { protocol } = data

  if (directExportBlocked.value || !protocol) {
    return
  }

  const { host, port, username, password } = await resolveProxyDownloadRow(data)

  if (!host || !port || !username || !password) {
    return
  }

  const protocols = protocol.split('/').map((item: string) => item.toLocaleLowerCase())
  const ports = port.toString().split('/')

  qrcodeList.value = await Promise.all(protocols.map(async (protocolItem: string, index: number) => {
    const btoaStr = btoa(`${username}:${password}@${host}:${ports[index] || ports[0]}`)
    const qrcodeValue = await QRCode.toDataURL(`${protocolItem}://${btoaStr}`, { margin: 0 })
    return { name: protocolItem, value: qrcodeValue }
  }))

  qrcode.value = qrcodeList.value[0].value
}

function onBlockedClick() {
  if (!canGoVerify.value) {
    return
  }

  openProxyKycVerification()
}

function onTooltipGoVerify(hide: () => void) {
  openProxyKycVerification()
  hide()
}

function onPanelGoVerify() {
  openProxyKycVerification()
}
</script>

<template>
  <!-- panel：二级子菜单内嵌展示，无需外层 Tooltip -->
  <div v-if="mode === 'panel'" class="proxy-qrcode-panel" @click.stop>
    <div v-if="kycBlocked && canGoVerify" class="proxy-kyc-panel__body">
      <p class="proxy-kyc-panel__desc">
        {{ blockTooltip }}
      </p>
      <RxButton
        size="sm"
        :label="$t('去认证')"
        @click="onPanelGoVerify"
      />
    </div>
    <p v-else-if="kycBlocked" class="proxy-kyc-panel__desc proxy-kyc-panel__desc--only">
      {{ blockTooltip }}
    </p>
    <div v-else-if="kycBlocked === null && isBuyProxy(data)" class="proxy-qrcode-panel__loading">
      <SvgIcon name="base/rx_ic_qrcode" color="var(--colors-icon-icon-inactive)" />
    </div>
    <div v-else-if="qrcode" class="flex flex-col items-center gap-3 ">
      <RxSelectButton v-if="qrcodeList && qrcodeList.length > 1" v-model="qrcode" :options="qrcodeList" option-label="name" option-value="value" data-key="value" />
      <div class=" py-4.5 rounded-1">
        <img class="block w-36 aspect-square" :src="qrcode">
      </div>
    </div>
  </div>

  <!-- trigger：图标 + Tooltip（快捷栏等场景） -->
  <template v-else>
    <div v-if="directExportBlocked" class="flex items-center">
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
          <RxSelectButton v-if="qrcodeList && qrcodeList.length > 1" v-model="qrcode" :options="qrcodeList" option-label="name" option-value="value" data-key="value" />
          <div class="py-4.5 rounded-1">
            <img class="block w-36 aspect-square" :src="qrcode">
          </div>
        </div>
      </template>
    </RxTooltip>
  </template>
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

.proxy-qrcode-panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.proxy-kyc-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 12px;
  max-width: 16rem;
}

.proxy-kyc-panel__desc {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  white-space: pre-wrap;
  color: var(--colors-text-text-secondary);

  &--only {
    padding: 10px 12px;
    max-width: 16rem;
  }
}

.proxy-kyc-panel__body .p-button {
  align-self: flex-end;
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
