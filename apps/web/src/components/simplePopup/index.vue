<script setup lang="ts">
import TsForm from '/@/views/lab/components/form/index.vue'
import type { Input } from '/@/views/lab/components/form/type'

interface Props {
  title?: string
  content?: string
  inputs: Input[]
  cancelText?: string
  confirmText?: string
  afterRender?: any
  onConfirm?: (formData: any) => Promise<void> | void
  onCancel?: () => void
}

const { title, content, inputs, cancelText = $t('取消'), confirmText = $t('保存'), onConfirm, onCancel } = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)

onBeforeMount(() => {
  inputs[0] && Reflect.set(inputs[0], 'props', { ...inputs[0].props, autofocus: true })
})

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
  <div class="flex flex-col gap-3 pt-4 pb-6 px-6 w-120 popup">
    <div v-if="title" class="title">{{ title }}</div>
    <div v-if="content" class="content">{{ content }}</div>
    <TsForm id="simpleform" v-focustrap :inputs="inputs" @submit="onSubmit" />
    <component v-if="afterRender" :is="afterRender" />
    <slot name="footer">
      <div class="flex justify-end items-center self-stretch gap-3">
        <RxButton size="sm" text severity="secondary" :label="cancelText" @click="close" />
        <RxButton size="sm" type="submit" form="simpleform" :label="confirmText" :loading="loading" />
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  font-family: Inter;
  font-size: 12px;
  line-height: normal;
}

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
