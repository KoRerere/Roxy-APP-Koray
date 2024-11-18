<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { RxAlert } from '/@/components/rx-alert'

const toast = useToast()

toast.add({ severity: 'success', summary: '标题', detail: '内容', life: 3000 })
toast.add({ severity: 'success', summary: '标题2', detail: '内容2', life: 3000 })
toast.add({ severity: 'success', summary: '标题', detail: '内容', life: 3000 })
</script>

<template>
  <div class="flex gap-6 p-10 flex-col">
    <RxAlert type="success" title="标题" content="内容" />
    <RxAlert type="info" title="标题" content="内容" />
    <RxAlert type="warn" title="标题" content="内容" />
    <RxAlert type="error" title="标题" content="内容" />
  </div>
</template>
