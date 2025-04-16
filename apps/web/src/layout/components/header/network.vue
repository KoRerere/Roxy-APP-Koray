<script setup lang="ts">
import { useNetworkStore } from '/@/stores/network'

const { setNetworkInfo } = useNetworkStore()

let retryCount = 0
const loading = ref(false)
const defaultProxyInfo = {
  city: '',
  ip: '',
}
const proxyInfo = ref(defaultProxyInfo)

async function detectNetwork() {
  // if (loading.value) {
  //   return
  // }

  loading.value = true
  try {
    await electronAPI.send('proxy:getSystemProxy')
    const result = await electronAPI.send('proxy:detectNetwork')
    proxyInfo.value.city = `${result.country_code}/${result.city}`
    proxyInfo.value.ip = result.ip
    console.log('detectNetwork result', result)
    setNetworkInfo(result)
  } catch (error) {
    proxyInfo.value = defaultProxyInfo
    retryCount++
    if (retryCount < 3) {
      detectNetwork()
    } else {
      proxyInfo.value.ip = ''
    }
  } finally {
    loading.value = false
  }
}

window.addEventListener('online', detectNetwork)
// window.addEventListener('offline', detectNetwork)
requestIdleCallback(detectNetwork)
</script>

<template>
  <div class="flex items-center gap-1">
    <RxButton :icon="`base/rx_ic_route${proxyInfo.ip ? '' : '_error'}`" severity="secondary" outlined size="xs"
      @click="detectNetwork" />
    <template v-if="loading">
      <Skeleton width="4rem" height="12px" />
      <Skeleton width="3rem" height="10px" />
    </template>
    <template v-else-if="proxyInfo.ip">
      <div class="city">
        {{ proxyInfo.city }}
      </div>
      <div class="ip">
        ({{ proxyInfo.ip }})
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.city {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 12px;
}

.ip {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 12px;
}
</style>
