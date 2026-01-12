<script setup lang="ts">
import ListSimple from './list/simple.vue'
import ShopSimple from './shop/simple.vue'
import { ProxyType } from '/@/enums/proxy'

defineOptions({ inheritAttrs: false })

const { data, isBatch } = defineProps<{
  data?: any
  isBatch?: boolean
}>()

const emit = defineEmits(['confirm'])

const attrs = useAttrs()

const tabs = ref([
  {
    title: $t('已购代理 IP'),
    value: 'shop',
    total: 0,
    slot: 'shop',
  },
  {
    title: $t('代理 IP'),
    value: 'list',
    slot: 'list',
  },
])

const tabsValue = ref('shop')

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
    <RxTabs v-model:value="tabsValue" class="flex-1 overflow-hidden" :tabs="tabs" head-tabs>
      <template #tab="{ data: row }">
        <div class="flex items-center gap-1">
          <div>{{ row.title }}</div>
          <div v-if="row.total" class="flex items-center justify-center w-4 h-4 rounded-full mark">
            {{ row.total }}
          </div>
        </div>
      </template>
      <template #shop>
        <ShopSimple v-bind="attrs" :data="shopData" :is-batch="isBatch" @confirm="shopConfirm" />
      </template>
      <template #list>
        <ListSimple v-bind="attrs" :data="listData" :is-batch="isBatch" @confirm="listConfirm" />
      </template>
    </RxTabs>
  </div>
</template>

<style lang="scss" scoped>
.mark {
  font-size: 12px;
  color: #ffffff;
  background-color: var(--colors-background-bg-error);
}
</style>
