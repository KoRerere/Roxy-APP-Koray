<script setup lang="ts">
import ryForm from '/@/components/ry-form'
import { deepClone, getFormData } from '/@/utils/index'

const emit = defineEmits(['cancel', 'confirm'])

const dialogRef = inject<any>('dialogRef')

const popupProps = ref()
const loading = ref(false)

function close() {
  loading.value = false
  dialogRef.value.close()
}

function confirm() {
  try {
    const formData = getFormData(popupProps.value.inputs)
    loading.value = true
    emit('confirm', [formData, close])
  }
  catch (error) {
    console.log('🚀 ~ confirm ~ error:', error)
  }
}

onMounted(() => {
  popupProps.value = deepClone(dialogRef.value.data)
})
</script>

<template>
  <div v-if="popupProps" class="flex flex-col popup">
    <div class="popup-title">
      {{ popupProps.title }}
    </div>
    <div class="popup-content">
      {{ popupProps.content }}
    </div>
    <ryForm class="form" :inputs="popupProps.inputs" />
    <div class="footer">
      <Button label="Confirm" severity="info" :loading="loading" autofocus @click="confirm" />
      <Button label="Cancel" text severity="secondary" autofocus @click="close" />
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
