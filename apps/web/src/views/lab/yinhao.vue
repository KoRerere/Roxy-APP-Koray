<script lang="ts" setup>
import { $t } from '/@/locales'
import { getDictMap } from '/@/utils'
import rxInputMultiSelect from '../../components/ry-form/rx-input-multiselect.vue'

const input = ref<any>(
  {
    type: 'multiSelect',
    label: $t('浏览器版本'),
    placeholder: $t('无指定版本，默认使用严格模式'),
    name: 'disableSslList',
    value: [],
    maxSelectedLabels: 1,
    selectedItemsLabel: $t('已选择了 {count} 个浏览器版本', { count: '{()}' }),
  },
)

onBeforeMount(async () => {
  const $dict_map = await getDictMap()
  input.value.options = $dict_map.coreVersion
})
</script>

<template>
  <div class="w-80">
    <rxInputMultiSelect v-model="input.value" v-bind="input" />
  </div>
</template>
