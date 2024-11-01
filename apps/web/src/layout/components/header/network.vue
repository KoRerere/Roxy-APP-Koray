<script setup lang="ts">
import { useNetworkStore } from '/@/stores/network'

const { setNetworkInfo } = useNetworkStore()

const loading = ref(false)
const proxyInfo = ref({
  city: '',
  ip: '',
})

async function detectNetwork() {
  loading.value = true
  const result = await electronAPI.send('proxy:detectNetwork', 'system').finally(() => {
    loading.value = false
  })
  proxyInfo.value.city = `${result.country_code}/${result.city}`
  proxyInfo.value.ip = result.ip
  setNetworkInfo(result)
  console.log('result', result)
}

window.addEventListener('online', detectNetwork)
window.addEventListener('offline', detectNetwork)
detectNetwork()
</script>

<template>
  <div class="flex items-center gap-1">
    <RxButton icon="base/rx_ic_route" severity="secondary" outlined size="xs" @click="detectNetwork" />
    <template v-if="loading">
      <Skeleton width="4rem" height="12px" />
      <Skeleton width="3rem" height="10px" />
    </template>
    <template v-else>
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
