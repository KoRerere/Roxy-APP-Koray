<script setup lang="ts">
import accountCreate from '/@/views/account/create'
import accountList from '/@/views/account/list/quick.vue'
import proxyCreate from '/@/views/agent/create/quick.vue'
import proxyList from '/@/views/agent/list/quick.vue'

const props = defineProps({
  type: {
    type: String as PropType<any>,
    default: 'proxyList',
  },
  data: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
})

const proxykey = ['host', 'ipType', 'port', 'protocol', 'proxyCategory', 'proxyPassword', 'proxyUserName', 'refreshUrl']
const proxyData = reactive({
  id: props.data.moduleId,
  ...Object.fromEntries(proxykey.map(key => [key, props.data[key]])),
})
</script>

<template>
  <proxyList v-if="type === 'proxyList'" :data="proxyData" v-bind="$attrs" />
  <proxyCreate v-if="type === 'proxyForm'" :data="proxyData" v-bind="$attrs" />
  <accountList v-if="type === 'accountList'" :data="data" v-bind="$attrs" />
  <accountCreate v-if="type === 'accountForm'" :show-remark="false" :show-create-more="false" v-bind="$attrs" />
</template>

<style lang="scss" scoped></style>
