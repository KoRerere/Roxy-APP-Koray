import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNetworkStore = defineStore('network', () => {
  const network = ref()

  async function setNetworkInfo(value: any) {
    network.value = value
  }

  const info = computed(() => network.value)

  return { info, setNetworkInfo }
})
