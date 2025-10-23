<script lang="ts" setup>
import SingleProxies from './components/single-proxies.vue';

interface Props {
  data?: Record<string, any>
  showRemark?: boolean
  onConfirm?: (formData: Record<string, any>) => void | Promise<void>
}

const { data, showRemark = false, onConfirm = () => { } } = defineProps<Props>()

async function _onConfirm(params: Record<string, any>[]) {
  await onConfirm(params[0])
}
</script>

<template>
  <div class="min-w-96 h-full pa-4 pb-5">
    <SingleProxies :data="data" :show-remark="showRemark" :onConfirm="_onConfirm"></SingleProxies>
  </div>
</template>

<style lang="scss" scoped></style>
