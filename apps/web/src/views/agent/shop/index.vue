<script lang="ts" setup>
import QiYuan from './qiyuan.vue'
import YinHao from './yinhao.vue'

const who = ref(localStorage.getItem('__who') ?? '0')

watch(who, () => {
  localStorage.setItem('__who', who.value)
})
</script>

<template>
  <Tabs v-model:value="who">
    <TabList>
      <Tab value="0">
        原神
      </Tab>
      <Tab value="1">
        跛豪
      </Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="0">
        <QiYuan />
      </TabPanel>
      <TabPanel value="1">
        <YinHao />
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>
