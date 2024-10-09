<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { defaultColors } from '/@/utils/constants'

const dialogRef = inject<any>('dialogRef')

const selectdColor = ref()
const tagName = ref('')
const loading = ref(false)
const isEdit = ref(false)
const _onConfirm = ref()
const _onCancel = ref()

function close() {
  loading.value = false
  dialogRef.value.close()
  _onCancel.value?.()
}

async function confirm() {
  loading.value = true
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
  <div class="flex flex-col popup">
    <div class="popup-title">
      Create new tag
    </div>
    <div class="popup-content">
      Select a color and type your new tag name below
    </div>
    <div class="colors">
      <template v-for="color in defaultColors" :key="color">
        <RxSvgIcon v-if="color === selectdColor" name="base/rx_ic_check_line" :size="20" :color="color" />
        <div v-else class="colors-item cursor-pointer" :style="{ backgroundColor: color }"
          @click="selectdColor = color" />
      </template>
    </div>

    <div class="square-container" />
    <InputText v-model="tagName" type="text" placeholder="Tag name" />
    <div class="footer">
      <Button label="Cancel" text severity="secondary" @click="close" />
      <Button :label="isEdit ? 'Modify' : 'Create'" severity="info" :loading="loading" @click="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 400px;
  padding-top: 1.25rem;
  gap: var(--spacing-xl, 12px);

  &-title {
    color: #000;
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  &-content {
    color: var(--Color-neutrals-600, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
  }
}

.colors {
  display: flex;
  align-items: center;
  gap: 20px;

  &-item {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
