<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'

import { defaultColors } from '/@/utils/constants'

const dialogRef = inject<any>('dialogRef')

const selectdColor = ref()
const tagName = ref('')
const isEdit = ref(false)
const _onConfirm = ref()
const _onCancel = ref()
const requireColorSelection = ref(false)
const canConfirm = computed(() => !requireColorSelection.value || (tagName.value?.trim() && defaultColors.includes(selectdColor.value)))

function close() {
  dialogRef.value.close()
  _onCancel.value?.()
}

async function onConfirm() {
  if (!canConfirm.value) {
    return
  }
  const result = await _onConfirm.value?.({ name: requireColorSelection.value ? tagName.value.trim() : tagName.value, color: selectdColor.value })
  if (result !== false) {
    close()
  }
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  isEdit.value = props?.name !== undefined
  tagName.value = props?.name
  requireColorSelection.value = !!props?.requireColorSelection
  selectdColor.value = props?.color || (requireColorSelection.value ? undefined : defaultColors[1])

  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
})
</script>

<template>
  <div class="w-100 flex flex-col gap-6 pt-5 popup">
    <div class="title">
      {{ isEdit ? $t('编辑标签') : $t('新增标签') }}
    </div>
    <div class="flex flex-col gap-2">
      <span v-if="requireColorSelection" class="text-3 tt-secondary">{{ $t('请选择标签颜色') }}</span>
      <ColorsSelect v-model="selectdColor" :colors="defaultColors" />
    </div>
    <TsFormInputText v-model="tagName" size="md" type="text" :placeholder="$t('请输入标签名')" :aria-label="$t('请输入标签名')" @keydown.enter.prevent="onConfirm" />
    <div class="flex justify-end items-center self-stretch gap-3">
      <RxButton :label="$t('取消')" text severity="secondary" @click="close" />
      <RxButton :label="$t('保存')" :disabled="!canConfirm" @click="onConfirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
}
</style>
