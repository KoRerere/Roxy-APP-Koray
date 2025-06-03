<script setup lang="ts">
import TsForm from '/@/views/lab/components/form/index.vue'

interface Props {
  title?: string
  content?: string
  inputs: any[]
  afterRender?: any
  onConfirm?: (formData: any) => Promise<void> | void
  onCancel?: () => void
}

const { title, content, inputs, onConfirm, onCancel } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)

function close() {
  onCancel?.()
  emit('close')
}

async function onSubmit(formData: any) {
  loading.value = true
  await onConfirm?.(formData)
  loading.value = false
  emit('close')
}

</script>

<template>
  <div class="flex flex-col gap-3 pt-4 pb-6 px-6 w-120">
    <div v-if="title" class="title">{{ title }}</div>
    <div v-if="content" class="content">{{ content }}</div>
    <TsForm id="simpleform" :inputs="inputs" @submit="onSubmit" />
    <component v-if="afterRender" :is="afterRender" />
    <div class="flex justify-end items-center self-stretch gap-3">
      <RxButton size="sm" :label="$t('取消')" text severity="secondary" @click="close" />
      <RxButton size="sm" :label="$t('保存')" type="submit" form="simpleform" :loading="loading" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
}

.content {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 18px;
}
</style>
