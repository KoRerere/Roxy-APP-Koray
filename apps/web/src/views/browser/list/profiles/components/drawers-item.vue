<script setup lang="ts">
import accountCreate from '/@/views/account/create'
import accountList from '/@/views/account/list/quick.vue'
import proxyCreate from '/@/views/agent/create/quick.vue'
import proxyList from '/@/views/agent/list/quick.vue'

defineProps({
  type: {
    type: String as PropType<any>,
    default: 'proxyList',
  },
  data: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
})
</script>

<template>
  <proxyList v-if="type === 'proxyList'" :data="{ id: data.moduleId }" v-bind="$attrs" />
  <proxyCreate v-if="type === 'proxyForm'" :data="data" v-bind="$attrs" />
  <accountList v-if="type === 'accountList'" :data="data" v-bind="$attrs" />
  <accountCreate v-if="type === 'accountForm'" :show-create-more="false" v-bind="$attrs" />
</template>

<style lang="scss" scoped></style>
