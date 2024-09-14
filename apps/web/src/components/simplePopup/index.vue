<script setup lang="ts">
import ryForm from '/@/components/ry-form'
import { getFormData } from '/@/utils/index'

const dialogRef = inject<any>('dialogRef')

const loading = ref(false)
const _props = ref()
const _onConfirm = ref()
const _onCancel = ref()

function close() {
  loading.value = false
  dialogRef.value.close()
  _onCancel.value?.()
}

async function confirm() {
  try {
    const formData = getFormData(_props.value.inputs)
    loading.value = true
    await _onConfirm.value?.(formData)
    close()
  }
  catch (error) {
    console.log('🚀 ~ confirm ~ error:', error)
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  const { props, onConfirm, onCancel } = dialogRef.value.data
  _props.value = props
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
})
</script>

<template>
  <div v-if="_props" class="flex flex-col popup">
    <div class="popup-title">
      {{ _props.title }}
    </div>
    <div class="popup-content">
      {{ _props.content }}
    </div>
    <ryForm class="form" :inputs="_props.inputs" />
    <div class="footer">
      <Button label="Cancel" text severity="secondary" autofocus @click="close" />
      <Button label="Confirm" severity="info" :loading="loading" autofocus @click="confirm" />
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

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
