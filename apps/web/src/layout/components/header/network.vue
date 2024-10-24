<script setup lang="ts">
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
  console.log('result', result)
}

window.addEventListener('online', detectNetwork)
window.addEventListener('offline', detectNetwork)
detectNetwork()
</script>

<template>
  <div class="network">
    <RxButton icon="base/rx_ic_route" outlined size="sm" @click="detectNetwork" />
    <div class="info">
      <template v-if="loading">
        <Skeleton width="4rem" height="12px" />
        <Skeleton width="3rem" height="10px" />
      </template>
      <template v-else>
        <span class="city">{{ proxyInfo.city }}</span>
        <span class="ip">{{ proxyInfo.ip }}</span>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.network {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 4px);

  .info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm, 4px);

    .city {
      color: #000;
      font-family: Inter;
      font-size: 10px;
      font-style: normal;
      font-weight: 500;
      line-height: 12px;
      /* 120% */
    }

    .ip {
      color: rgba(0, 0, 0, 0.4);
      font-family: Inter;
      font-size: 8px;
      font-style: normal;
      font-weight: 500;
      line-height: 10px;
      /* 125% */
    }
  }
}
</style>
