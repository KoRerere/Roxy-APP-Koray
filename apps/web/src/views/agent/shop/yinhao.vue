<script setup>
import { getDictMap } from '/@/utils'

async function testDict () {
  const dictMap = await getDictMap()
  console.log('🚀 ~ testDict ~ dictMap:', dictMap)
}
</script>

<template>
  <RxButton label="测试字典" @click="testDict" />
</template>
