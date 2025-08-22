<script setup lang="ts">
import { $t } from '/@/locales';
import ListSimple from './list/simple.vue'
import ShopSimple from './shop/simple.vue'
import { ProxyType } from '/@/enums/proxy';

defineOptions({ inheritAttrs: false })

const { data, isBatch } = defineProps<{
  data?: any
  isBatch?: boolean
}>()

const emit = defineEmits(['confirm'])

const attrs = useAttrs()

const tabs = ref([
  {
    title: $t('代理 IP'),
    value: 'list',
    slot: 'list',
  },
  {
    title: $t('已购代理'),
    value: 'shop',
    slot: 'shop',
  },
])

const tabsValue = ref('list')

const listData = computed(() => !isBatch ? data : data?.filter((item: any) => item._type === ProxyType.resource))
const shopData = computed(() => !isBatch ? data : data?.filter((item: any) => item._type === ProxyType.buy))


function listConfirm(data: any) {
  emit('confirm', isBatch ? [...shopData.value, ...data] : data)
}

function shopConfirm(data: any) {
  emit('confirm', isBatch ? [...listData.value, ...data] : data)
}

</script>

<template>
  <div class="flex flex-col h-full w-full">
    <RxTabs class="flex-1 overflow-hidden" v-model:value="tabsValue" :tabs="tabs" head-tabs>
      <template #list>
        <ListSimple v-bind="attrs" :data="listData" :is-batch="isBatch" @confirm="listConfirm" />
      </template>
      <template #shop>
        <ShopSimple v-bind="attrs" :data="shopData" :is-batch="isBatch" @confirm="shopConfirm" />
      </template>
    </RxTabs>
  </div>
</template>

<style scoped></style>
