<script lang="ts" setup>
import { ref } from 'vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useSimpleLocale } from '/@/stores/locale'

const simpleLocale = useSimpleLocale()

const ISO639 = ref([
  {
    lang: '中文（简体）',
    code: 'zh-CN',
    icon: 'country-code/CN',
  },
  {
    lang: '英语',
    code: 'en',
    icon: 'country-code/US',
  },
  {
    lang: '法语',
    code: 'fr',
    icon: 'country-code/FR',
  },
  {
    lang: '西班牙语',
    code: 'es',
    icon: 'country-code/ES',
  },
  {
    lang: '德语',
    code: 'de',
    icon: 'country-code/DE',
  },
  {
    lang: '日语',
    code: 'ja',
    icon: 'country-code/JP',
  },
  {
    lang: '俄语',
    code: 'ru',
    icon: 'country-code/RU',
  },
  {
    lang: '意大利语',
    code: 'it',
    icon: 'country-code/IT',
  },
  {
    lang: '葡萄牙语',
    code: 'pt',
    icon: 'country-code/PT',
  },
  {
    lang: '韩语',
    code: 'ko',
    icon: 'country-code/KR',
  },
])

const currentLocale = ref(ISO639.value.find(item => item.code === simpleLocale.currentLocale) || ISO639.value[0])

watch(() => currentLocale.value, (val) => {
  simpleLocale.setSimpleLocale(val.code)
})
</script>

<template>
  <div class="card flex justify-center">
    <Select v-model="currentLocale" :options="ISO639" option-label="lang" class="w-full md:w-56">
      <template #value="slotProps">
        <div class="flex items-center">
          <RxSvgIcon :name="slotProps.value?.icon" class="mr-2" />
          <div>{{ slotProps.value.lang }}</div>
        </div>
      </template>
      <template #option="slotProps">
        <div class="flex items-center">
          <RxSvgIcon :name="slotProps.option?.icon" class="mr-2" />
          <div>{{ slotProps.option.lang }}</div>
        </div>
      </template>
    </Select>
  </div>
</template>
