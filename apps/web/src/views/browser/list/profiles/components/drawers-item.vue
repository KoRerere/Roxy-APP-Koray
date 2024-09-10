<script setup lang="ts">
import accountCreate from '/@/views/account/create'
import accountList from '/@/views/account/list/quick.vue'
import proxyCreate from '/@/views/agent/create/quick.vue'
import proxyList from '/@/views/agent/list/quick.vue'

export type DrawerType =
  | 'proxyList'
  | 'proxyForm'
  | 'accountList'
  | 'accountForm'

defineProps({
  type: {
    type: String as PropType<DrawerType>,
    default: 'proxyList',
  },
})
</script>

<template>
  <proxyList v-if="type === 'proxyList'" v-bind="$attrs" />
  <proxyCreate v-if="type === 'proxyForm'" v-bind="$attrs" />
  <accountList v-if="type === 'accountList'" v-bind="$attrs" />
  <accountCreate v-if="type === 'accountForm'" v-bind="$attrs" />
</template>

<style lang="scss" scoped></style>
