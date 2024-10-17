<script lang="ts" setup>
import { ref } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { ISO639List } from '/@/constants/iso-639'
import { useSimpleLocale } from '/@/stores/locale'

const simpleLocale = useSimpleLocale()

const ISO639 = ref(ISO639List)

const currentLocale = ref(ISO639.value.find(item => item.locale === simpleLocale.currentLocale) || ISO639.value[0])

watch(() => currentLocale.value, (val) => {
  simpleLocale.setSimpleLocale(val.locale)
})
</script>

<template>
  <div class="card flex justify-center">
    <Select v-model="currentLocale" :options="ISO639" class="w-full md:w-56">
      <template #value="slotProps">
        <div class="flex items-center">
          <RxSvgIcon :name="slotProps.value?.icon" class="mr-2" />
          <div>{{ slotProps.value.label }}</div>
        </div>
      </template>
      <template #option="slotProps">
        <div class="flex items-center">
          <RxSvgIcon :name="slotProps.option?.icon" class="mr-2" />
          <div>{{ slotProps.option.label }}</div>
        </div>
      </template>
    </Select>
  </div>
</template>
