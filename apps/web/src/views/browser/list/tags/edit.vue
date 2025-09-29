<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { $t } from '/@/locales'
import { defaultColors } from '/@/utils/constants'

const dialogRef = inject<any>('dialogRef')

const selectdColor = ref()
const tagName = ref('')
const isEdit = ref(false)
const _onConfirm = ref()
const _onCancel = ref()

function close() {
  dialogRef.value.close()
  _onCancel.value?.()
}

async function onConfirm() {
  await _onConfirm.value?.({ name: tagName.value, color: selectdColor.value })
  close()
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  isEdit.value = props?.name !== undefined
  tagName.value = props?.name
  selectdColor.value = props?.color || defaultColors[1]

  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
})
</script>

<template>
  <div class="w-100 flex flex-col gap-6 pt-5 popup">
    <div class="title">{{ isEdit ? $t('编辑标签') : $t('新增标签') }}</div>
    <ColorsSelect v-model="selectdColor" :colors="defaultColors" />
    <TsFormInputText v-model="tagName" size="md" type="text" :placeholder="$t('请输入标签名')" />
    <div class="flex justify-end items-center self-stretch gap-3">
      <RxButton :label="$t('取消')" text severity="secondary" @click="close" />
      <RxButton :label="$t('保存')" @click="onConfirm" />
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
