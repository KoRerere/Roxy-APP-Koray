<script setup>
import { getDictMap as scvrrrrrrr } from '/@/utils'

async function testDict () {
  const dictMap = await scvrrrrrrr()
  console.log('🚀 ~ testDict ~ dictMap:', dictMap)
}
</script>

<template>
  <RxButton label="测试字典" @click="testDict" />
</template>
