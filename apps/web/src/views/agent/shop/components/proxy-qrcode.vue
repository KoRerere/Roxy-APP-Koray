<script setup lang="ts">
import QRCode from 'qrcode'

const { data } = defineProps<{
  data: any
}>()

const qrcodeList = ref()
const qrcode = ref()

onMounted(() => {
  genQrCode()
})

async function genQrCode() {
  const { isDirect, protocol, host, port, proxyUserName, proxyPassword } = data

  if (isDirect || !proxyUserName || !proxyPassword)
    return

  const protocols = protocol.split('/').map((item: string) => item.toLocaleLowerCase()) || []
  const ports = port.toString().split('/') || []

  qrcodeList.value = await Promise.all(protocols.map(async (protocol: string, index: number) => {
    const btoaStr = btoa(`${proxyUserName}:${proxyPassword}@${host}:${ports[index] || ports[0]}`)
    const qrcode = await QRCode.toDataURL(`${protocol}://${btoaStr}`, { margin: 0 })
    return { name: protocol, value: qrcode }
  }))

  qrcode.value = qrcodeList.value[0].value
}
</script>

<template>
  <RxTooltip class="flex items-center" tooltip-content-class="bg-white">
    <template #default>
      <SvgIcon name="base/rx_ic_qrcode" color="var(--colors-icon-icon-secondary)" />
    </template>
    <template #content>
      <div class="flex flex-col items-center gap-3">
        <RxSelectButton v-if="qrcodeList.length > 1" v-model="qrcode" :options="qrcodeList" size="xxs" option-label="name" option-value="value" data-key="value" />
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
</style>
