<script setup lang="ts">
import { isNotNil } from 'es-toolkit'
import { useNetworkStore } from '/@/stores/network'
import { useUserStore } from '/@/stores/user'

const { setNetworkInfo } = useNetworkStore()
const userStore = useUserStore()

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
    await electronAPI.send('proxy:getSystemProxy')
    const result = await electronAPI.send('proxy:detectNetwork')
    proxyInfo.value.city = `${result.country_code}/${result.city}`
    proxyInfo.value.ip = result.ip
    console.log('detectNetwork result', result, proxyInfo)
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

watch(() => userStore.userConfig?.systemProxySwitch, (val, oldVal) => {
  if (isNotNil(val) && isNotNil(oldVal)) {
    detectNetwork()
  }
})

window.addEventListener('online', detectNetwork)
// window.addEventListener('offline', detectNetwork)
setTimeout(detectNetwork, 2000)
</script>

<template>
  <div class="flex items-center gap-1">
    <RxButton class="shrink-0" :icon="`base/rx_ic_route${proxyInfo.ip ? '' : '_error'}`" :loading="loading" severity="secondary" outlined size="xs" @click="detectNetwork" />
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
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 12px;
}

.ip {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: 12px;
}
</style>
