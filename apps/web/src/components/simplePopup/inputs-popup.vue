<script setup lang="ts">
import ryForm from '/@/components/ry-form'
import { getFormData } from '/@/utils/index'

const emit = defineEmits(['cancel', 'save'])

const dialogRef = inject<any>('dialogRef')
const popupData = ref<any>({})

function close() {
  dialogRef.value.close()
}

function save() {
  emit('save', [getFormData(popupData.value.inputs), close])
}

onMounted(() => {
  popupData.value = dialogRef.value.data
})
</script>

<template>
  <div class="content">
    <div class="header">
      <div class="header-title">
        {{ popupData.title }}
      </div>
      <div class="header-description">
        {{ popupData.description }}
      </div>
    </div>
    <ryForm class="form" :inputs="popupData.inputs" />
    <div class="footer">
      <Button label="Save" severity="info" autofocus @click="save" />
      <Button label="Cancel" text severity="secondary" autofocus @click="close" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  width: 300px;
  padding-top: 1.25rem;
}

.header {
  margin-bottom: var(--spacing-md, 6px);
  color: #000;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;

  &-description {
    margin-top: var(--spacing-xl, 12px);
    color: var(--Color-neutrals-600, #575d61);
    font-weight: 400;
    line-height: 18px;
  }
}

.form {
  margin-bottom: var(--spacing-2xl, 16px);
}

.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
</style>
