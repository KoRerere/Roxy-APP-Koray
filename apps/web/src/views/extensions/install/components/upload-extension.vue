<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

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
  <div class="flex flex-col popup">
    <div class="popup-title">
      Upload Extension
    </div>
    <div>
      <div class="popup-content">
        Select your extension
      </div>
      <div class="flex items-center gap-4 mt-1">
        <ryButton outlined severity="info" icon="base/rx_ic_export" label="Select a file" />
        <span class="upload-or">OR</span>
        <ryButton outlined severity="secondary" icon="base/rx_ic_folder" label="Select a folder" />
      </div>

      <div class="flex items-center gap-1 mt-1">
        <RxSvgIcon name="base/rx_ic_info_fill" :size="12" color="#A3A9AD" />
        <span class="upload-tip">Zip, CRX file supported, file limited to 50MB max.</span>
      </div>
    </div>

    <div class="guide">
      * Please note that your extension should follow the <span
        class="text-blue decoration-underline cursor-pointer">chrome extension
        guideline</span> in
      order to install in
      our chrome
      kernel.
    </div>

    <div class="footer">
      <Button size="small" label="Cancel" text severity="secondary" autofocus @click="close" />
      <Button size="small" label="Upload and Install" severity="info" :loading="loading" autofocus @click="confirm" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 400px;
  padding-top: 1.25rem;
  gap: var(--spacing-2xl, 16px);

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

.upload-or {
  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
}

.upload-tip {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}

.guide {
  color: var(--Color-neutrals-600, #575d61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
