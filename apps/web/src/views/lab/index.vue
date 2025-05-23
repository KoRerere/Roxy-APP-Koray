<script lang="ts" setup>
import QiYuan from './qiyuan.vue'
import YinHao from './yinhao.vue'
import XiaoZheng from './xiaozheng.vue'

const who = ref(localStorage.getItem('__who') ?? '0')

watch(who, () => {
  localStorage.setItem('__who', who.value)
})
</script>

<template>
  <Tabs v-model:value="who" class="h-full w-full lab-container">
    <TabList>
      <Tab value="0">
        原神
      </Tab>
      <Tab value="1">
        跛豪
      </Tab>
      <Tab value="2">
        小郑
      </Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="0">
        <QiYuan text="原神" />
      </TabPanel>
      <TabPanel value="1">
        <YinHao />
      </TabPanel>
      <TabPanel value="2">
        <XiaoZheng />
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<style lang="scss" scoped>
:deep(.p-tabpanels) {
  flex: 1;
  background: var(--colors-background-bg-page, #FFF);

  .p-tabpanel {
    height: 100%;
  }
}

.lab-container {
  background: var(--colors-background-bg-page, #FFF);
}
</style>
