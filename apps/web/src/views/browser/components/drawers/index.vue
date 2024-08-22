<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import proxyList from './proxy-list.vue'
import proxyCreate from './proxy-create.vue'
import accountList from './account-list.vue'
import accountCreate from './account-create.vue'

defineProps({
  closeDrawer: {
    type: Function,
    default: () => () => { },
  },
})

const type = ref('pl')
</script>

<template>
  <proxy-list v-if="type === 'pl'" @close="() => closeDrawer()" />
  <proxy-create v-if="type === 'pc'" @close="() => closeDrawer()" />
  <account-list v-if="type === 'al'" @close="() => closeDrawer()" />
  <account-create v-if="type === 'ac'" @close="() => closeDrawer()" />
</template>

<style lang="scss" scoped></style>
