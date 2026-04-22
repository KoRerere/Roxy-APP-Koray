<script setup lang="ts">
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { proxyProviderId, sceneId, country } = defineProps<{
  proxyProviderId: number
  sceneId: number
  country: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'jump'): void
}>()

const [showToast, onlyErrorToast] = useResponseToast()

async function buyExternal() {
  const { code, data, msg } = await API.proxy.userGetProxyVendorJumpInfoList({})
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  onJump(data)
}

async function onJump(_item: any) {
  emit('jump')
  emit('close')

  // 第三方的合作商（使用跳转的方式）
  // if (!item.jumpInfo.isToken) {
  //   window.open(item.jumpInfo.jumpUrl, '_blank')
  //   return
  // }

  // if (item.jumpInfo.apiKey) {
  //   const url = new URL(item.jumpInfo.jumpUrl)
  //   url.searchParams.set('token', item.jumpInfo.apiKey)
  //   window.open(url.toString(), '_blank')
  //   return
  // }

  // const result = await API.proxy.userRegisterProxyProviderUserCreate({ proxyProviderId: item.id })

  // if (result.code === 0) {
  //   const url = new URL(item.jumpInfo.jumpUrl)
  //   url.searchParams.set('token', result.data)
  //   Reflect.set(item.jumpInfo, 'apiKey', result.data)
  //   window.open(url.toString(), '_blank')
  // }
  // else if (result.code === 466) {
  //   window.open(item.jumpInfo.jumpUrl, '_blank')
  //   showToast(466, $t('账号已存在，请联系技术支持！'))
  // }
  // else {
  //   onlyErrorToast(result.code, result.msg)
  // }
}

async function sendNotifyMe() {
  const { code, msg } = await API.proxy.userReportProxyOutOfStockCreate({ proxyProviderId, sceneId, country })
  onlyErrorToast(code, msg)
  if (code === 0) {
    showToast(code, $t('当前代理 IP 补货或上架时，我们将通过站内通知提醒您'), { summary: $t('补货通知登记成功') })
    emit('close')
  }
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 rounded-lg w-105">
    <div class="h-9 flex items-center justify-between">
      <span class="header">{{ $t('当前代理 IP 暂时缺货') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="relative mx-auto flex items-center py-4 gap-2.5">
      <SvgIcon :name="(`country-code/${country}` as any)" size="32" />
      <div class="name">
        Roxy IP
      </div>
    </div>
    <div class="tt-primary text-3.5 leading-normal">
      {{ $t("点击下方按钮加入到货通知名单，代理 IP 补货后我们将第一时间通知您。你也可以通过 Rola-IP 进行选购。") }}
    </div>
    <div class="flex flex-col gap-2">
      <RxButton size="lg" icon="base/rx_ic_cart" :label="$t('通过 Rola-lP 购买')" @click="buyExternal" />
      <RxButton variant="outlined" severity="secondary" size="lg" icon="base/rx_ic_ringbell" :label="$t('补货时通知我')" @click="sendNotifyMe" />
      <RxButton variant="text" severity="secondary" size="lg" :label="$t('取消')" @click="$emit('close')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.name {
  font-family: Archivo;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(93deg, #ffd7aa 1.5%, #c37d15 102.88%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
