<script setup>
import { onMounted, ref } from 'vue'
import { isEmptyValue, isFunction } from '/@/utils'

const props = defineProps({
  tableRequest: Function,
  dataKey: {
    type: String,
    default: 'id',
  },
  data: {
    type: Object,
    default: () => ({}),
  },
})
const dataList = ref()

const { selection, 'onUpdate:selection': onUpdateSelection } = toRefs(reactive(useAttrs()))

const hasOuterSelection = isFunction(onUpdateSelection?.value)
const innerSelection = ref()

const selectedProduct = computed({
  get () {
    return hasOuterSelection ? selection.value : innerSelection.value
  },
  set (value) {
    console.log('🚀 ~ set ~ value:', value)
    if (hasOuterSelection) {
      onUpdateSelection?.value(value)
    }
    else {
      innerSelection.value = value
    }
  },
})

onMounted(() => {
  props.tableRequest().then((data) => {
    dataList.value = data.data.rows
  })
})
</script>

<template>
  <div class="card">
    <DataTable v-model:selection="selectedProduct" :value="dataList" :data-key="dataKey" table-style="min-width: 50rem">
      <Column selection-mode="single" header-style="width: 3rem" />
      <Column field="code" header="Code" />
      <Column field="name" header="Name" />
      <Column field="category" header="Category" />
      <Column field="quantity" header="Quantity" />
    </DataTable>
  </div>
</template>
