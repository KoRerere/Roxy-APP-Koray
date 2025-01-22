<script setup lang="ts">
const text = ref('')

defineExpose({
  get formData() {
    return text.value
  },
})
</script>

<template>
  <Textarea v-model="text" rows="7" :placeholder="$t('请在此输入内容')" class="w-full text-[15px]" />
</template>
