<script setup lang="ts">
import { useNetworkStore } from '/@/stores/network'

const { setNetworkInfo } = useNetworkStore()

let retryCount = 0
const loading = ref(true)
const defaultProxyInfo = {
  city: '',
  ip: '',
}
const proxyInfo = ref(defaultProxyInfo)

async function detectNetwork() {
  loading.value = true
  try {
    const softConfig = await globalThis.electronAPI.send('app:getSoftConfig')
    const result = await globalThis.electronAPI.send('proxy:detectNetwork', softConfig.networkMode)
    proxyInfo.value.city = `${result.country_code}/${result.city}`
    proxyInfo.value.ip = result.ip
    console.log('detectNetwork result', result, proxyInfo)
    setNetworkInfo(result)
  }
  catch (error) {
    proxyInfo.value = defaultProxyInfo
    retryCount++
    if (retryCount < 3) {
      detectNetwork()
    }
    else {
      proxyInfo.value.ip = ''
    }
  }
  finally {
    loading.value = false
  }
}

window.addEventListener('online', detectNetwork)
// window.addEventListener('offline', detectNetwork)
setTimeout(detectNetwork, 2000)
</script>

<template>
  <div class="flex items-center gap-1">
    <RxButton v-tooltip.left="{ value: $t('点击刷新'), showDelay: 300 }" class="shrink-0" :icon="proxyInfo.ip ? 'base/rx_ic_location' : 'base/rx_ic_location_error'" severity="secondary" outlined size="xs"
              @click="detectNetwork"
    />
    <template v-if="loading">
      <Skeleton width="4rem" height="12px" />
      <Skeleton width="3rem" height="10px" />
    </template>
    <div v-else-if="proxyInfo.ip" v-tooltip.bottom="{ value: $t('当前网络定位'), showDelay: 300 }" class="flex items-center gap-1">
      <div class="city">
        {{ proxyInfo.city }}
      </div>
      <div class="ip">
        ({{ proxyInfo.ip }})
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.city {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 12px;
}

.ip {
  color: var(--colors-text-text-tertiary, #575d60);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 12px;
}
</style>
