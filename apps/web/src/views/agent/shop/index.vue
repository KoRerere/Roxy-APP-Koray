<script setup>
import { RxAlert } from '/@/components/rx-alert'
</script>

<template>
  <div class="flex gap-6 p-10 flex-col">
    <RxAlert type="success" title="标题" content="内容" />
    <RxAlert type="info" title="标题" content="内容" />
    <RxAlert type="warn" title="标题" content="内容" />
    <RxAlert type="error" title="标题" content="内容" />
  </div>
</template>
