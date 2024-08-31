<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
// @ts-ignore
import proxyList from '/@/views/browser/components/drawers/proxy-list.vue'
import proxyCreate from '/@/views/browser/components/drawers/proxy-create.vue'
import accountList from '/@/views/browser/components/drawers/account-list.vue'
import accountCreate from '/@/views/account/create'

import { type DrawerType, drawerProps } from './props'

defineProps(drawerProps)
</script>

<template>
  <proxyList v-if="type === 'proxyList'" v-bind="$attrs" />
  <proxyCreate v-if="type === 'proxyForm'" v-bind="$attrs" />
  <accountList v-if="type === 'accountList'" v-bind="$attrs" />
  <accountCreate v-if="type === 'accountForm'" v-bind="$attrs" />
</template>

<style lang="scss" scoped></style>
