<script lang="ts" setup>
import QiYuan from './qiyuan.vue'
import YinHao from './yinhao.vue'
import XiaoZheng from './xiaozheng.vue'

const who = ref(localStorage.getItem('__who') ?? '0')

const tabs = [
  { title: '原神', value: '0', component: markRaw(QiYuan) },
  { title: '跛豪', value: '1', component: markRaw(YinHao) },
  { title: '小郑', value: '2', component: markRaw(XiaoZheng) },
]

const activeTab = computed(() => tabs.find(tab => tab.value === who.value))

watch(who, () => {
  localStorage.setItem('__who', who.value)
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <RxTabs v-model:value="who" :tabs="tabs" head-tabs only-tabs></RxTabs>
    <div class="flex-1 overflow-hidden">
      <component :is="activeTab?.component" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
