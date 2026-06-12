<script setup lang="ts">
import TsFormInputTextarea from '/@/views/lab/components/form/m-input-textarea.vue'
import { useThemeStore } from '/@/stores/theme'
import { useProxyStore } from '/@/stores/proxy'
import { useUserStore } from '/@/stores/user'
import { useProxy } from '/@/views/agent/hooks'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { getImage, parseProxyUrl } from '/@/utils/basic'
import { IPType } from '/@/enums'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import QuickCreateGuide from '/@/views/browser/create/quick-create-guide.vue'

const { isEdit, data, onConfirm } = defineProps<{
  isEdit?: boolean
  data?: { proxyInfo: string }
  onConfirm: (params?: any) => Promise<void>
}>()

defineEmits(['close'])

const { realTheme } = storeToRefs(useThemeStore())
const { getProxyVendors } = useProxyStore()
const { buyProxy } = useProxy()
const [, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()
const [showModal] = RxUseDialog()

const proxies = ref(data?.proxyInfo ?? '')
const dontShowAgain = ref(false)

const bgSrc = computed(() => {
  return realTheme.value === 'light' ? `url('${getImage('browser/quick_create_bg_light.svg')}')` : `url('${getImage('browser/quick_create_bg_dark.svg')}')`
})

watch(dontShowAgain, (val) => {
  if (val) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      pt: {
        content: '!pa-0',
      },
      slots: {
        container: ({ hideModal }) => h(QuickCreateGuide, {
          onClose: () => {
            hideModal()
          },
          onConfirm: () => {
            hideModal()
          },
        }),
      },
    })
  }
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

async function saveDontShowAgain() {
  if (!dontShowAgain.value)
    return

  const { code, msg } = await API.base.userSetUserConfigCreate({ quickCreateModalSwitch: false } as any)
  onlyErrorToast(code, msg)
  if (code === 0) {
    globalThis.electronAPI.send('app:saveSoftConfig', { quickCreateModalSwitch: false } as never)
    userStore.updateUserConfig()
  }
}

async function onSkipAndCreate() {
  await saveDontShowAgain()
  await onConfirm()
}

async function onQuickCreateProfile() {
  if (!isEdit && !proxies.value) {
    await onSkipAndCreate()
    return
  }

  const { host, protocol, ...rest } = parseProxyUrl(proxies.value)
  const ipType = host?.startsWith('[') ? IPType.IPV6 : IPType.IPV4

  const params = {
    ...rest,
    ipType,
    host: host?.replace(/\[|\]/g, ''),
    protocol: protocol || 'SOCKS5',
    proxyCategory: protocol || 'SOCKS5',
  }

  await saveDontShowAgain()
  await onConfirm(params)
}
</script>

<template>
  <div class="w-180 flex flex-col gap-4 pa-6 pt-4 rounded-2 popup">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('快速创建配置') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="flex flex-col self-stretch gap-4">
      <div class="tt-primary text-3.5 leading-4">
        {{ $t('请您为窗口配置一条代理 IP。') }}
      </div>

      <RxDivider line-only line-style="dashed" line-color="var(--colors-border-border-base)" />

      <div class="flex items-center justify-between">
        <div class="tt-primary text-3.5 font-600 leading-5">
          {{ $t('代理 IP 配置（支持动态 IP 自动刷新）：') }}
        </div>
        <RxButton size="md" variant="outlined" :label="$t('去 Rola-IP 购买')" icon="base/rx_ic_cart" @click="onBuyProxy" />
      </div>

      <TsFormInputTextarea v-model="proxies" size="md" rows="4"
                           :placeholder="$t('示例（刷新 URL为选填）:\n192.168.0.1:8000:用户名:密码[刷新 URL]', { at: '@' })"
      />
    </div>
    <div class="flex items-center pt-4 justify-between">
      <div class="flex items-center gap-1.5">
        <RxCheckbox v-model="dontShowAgain" input-id="dontShowAgain" binary />
        <label for="dontShowAgain" class="select-none text-3 tt-primary font-500 leading-5">{{ $t('不再显示') }}</label>
        <SvgIcon v-tooltip.top="$t('你可以在 设置中心 → 软件设置 中找到快速模板的配置和修改')" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
      </div>
      <div class="flex items-center gap-2">
        <template v-if="!isEdit">
          <RxButton size="md" variant="text" severity="secondary" :label="$t('跳过并创建窗口')" @click="onSkipAndCreate" />
          <RxButton size="md" icon="base/rx_ic_browser_flash" :label="$t('快速创建窗口')" @click="onQuickCreateProfile" />
        </template>
        <RxButton v-else size="md" icon="base/rx_ic_browser_flash" :label="$t('确认修改')" @click="onQuickCreateProfile" />
      </div>
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
