<script setup lang="ts">
import TsFormInputTextarea from '/@/views/lab/components/form/m-input-textarea.vue'
import { useThemeStore } from '/@/stores/theme'
import { useProxyStore } from '/@/stores/proxy'
import { useProxy } from '/@/views/agent/hooks'
import { getImage, parseProxyUrl } from '/@/utils/basic'
import { IPType } from '/@/enums'
import { getDictMap } from '/@/utils'

const { isEdit, data, onConfirm } = defineProps<{
  isEdit?: boolean
  data?: { id: any, proxyInfo: string }
  onConfirm: (params?: any) => Promise<void>
}>()

defineEmits(['close'])

const { realTheme } = storeToRefs(useThemeStore())
const { getProxyVendors } = useProxyStore()
const { buyProxy } = useProxy()

const proxies = ref(data?.proxyInfo ?? '')

const bgSrc = computed(() => {
  return realTheme.value === 'light' ? `url('${getImage('browser/quick_create_bg_light.svg')}')` : `url('${getImage('browser/quick_create_bg_dark.svg')}')`
})

async function onBuyProxy() {
  const data = await getProxyVendors()
  if (!data)
    return
  const vendors = data.find((item: any) => item.isJump && item.vendorName === 'Rola-IP')
  if (!vendors)
    return

  const provider = {
    proxyProviderId: vendors.id,
    proxyProviderWebsite: vendors.vendorWebsite,
    proxyProviderIcon: vendors.vendorIcon,
    proxyProviderName: vendors.vendorName,
    autoJump: true,
  }

  await buyProxy({ provider })
}

async function onQuickCreateProfile() {
  if (!isEdit && !proxies.value) {
    await onConfirm()
    return
  }

  const $dict_map = await getDictMap()
  const { host, protocol, ...rest } = parseProxyUrl(proxies.value)

  const ipType = host?.startsWith('[') ? IPType.IPV6 : IPType.IPV4
  const channelKey = ipType === IPType.IPV6 ? 'ipv6-query-channels' : 'checkChannel'
  const checkChannel = $dict_map[channelKey]?.[0]?.value

  const params = {
    ...rest,
    ipType,
    host: host?.replace(/\[|\]/g, ''),
    protocol: protocol || 'SOCKS5',
    proxyCategory: protocol || 'SOCKS5',
    checkChannel,
  }

  await onConfirm(params)
}
</script>

<template>
  <div class="w-180 flex flex-col gap-4 pa-6 pt-4 rounded-2 popup">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('快速创建并打开窗口') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="flex flex-col self-stretch gap-4">
      <div class="tt-primary text-3.5 leading-4">
        {{ $t('建议设置一条代理 IP （建议动态 IP）以确保业务稳定运行。') }}
      </div>

      <RxDivider line-only line-style="dashed" line-color="var(--colors-border-border-base)" />

      <div class="flex items-center justify-between">
        <div class="tt-primary text-3.5 font-600 leading-5">
          {{ $t('代理 IP 配置：') }}
        </div>
        <RxButton size="md" variant="outlined" :label="$t('去 Rola-IP 购买')" icon="base/rx_ic_cart" @click="onBuyProxy" />
      </div>

      <TsFormInputTextarea v-model="proxies" size="md" rows="4"
                           :placeholder="$t('示例（刷新 URL 与备注为选填）:\n192.168.0.1:8000:用户名:密码[刷新 URL]{notes}\n用户名:密码{at}192.168.0.1:8000[刷新 URL]{notes}', { at: '@', notes: `{${$t('备注')}}` })"
      />
    </div>
    <div class="flex items-center justify-end gap-2 pt-4">
      <template v-if="!isEdit">
        <RxButton size="md" variant="text" severity="secondary" :label="$t('跳过并创建窗口')" @click="onConfirm()" />
        <RxButton size="md" icon="base/rx_ic_browser_flash" :label="$t('快速创建窗口')" @click="onQuickCreateProfile" />
      </template>
      <RxButton v-else size="md" icon="base/rx_ic_browser_flash" :label="$t('确认修改')" @click="onQuickCreateProfile" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  position: relative;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--colors-background-bg-page);
  }

  &::before {
    background-image: v-bind(bgSrc);
    background-size: 100% auto;
    background-repeat: no-repeat;
    background-position: 0 0;
    z-index: -1;
  }

  &::after {
    z-index: -2;
  }
}
</style>
