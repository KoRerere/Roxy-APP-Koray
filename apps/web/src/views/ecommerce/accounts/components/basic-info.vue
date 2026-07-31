<script setup lang="ts">
import TsForm from '/@/views/lab/components/form/index.vue'
import FormItem from '/@/views/lab/components/form/item.vue'
import MInputLabel from '/@/views/lab/components/form/m-input-label.vue'
import MInputText from '/@/views/lab/components/form/m-input-text.vue'
import type { EcommerceBasicInfo } from '../ecommerce-window-mode'
import { useEcommerceBasicInfoForm } from '../hooks/useEcommerceBasicInfoForm'

const model = defineModel<EcommerceBasicInfo>({ required: true })

const formRef = useTemplateRef('form')

const {
  inputs,
  isCustomPlatform,
  customPlatformUrl,
  customPlatformUrlError,
  onCustomPlatformUrlUpdate,
  loadPlatformOptions,
  expose,
} = useEcommerceBasicInfoForm(model, formRef)

onMounted(() => {
  loadPlatformOptions()
})

defineExpose(expose)
</script>

<template>
  <section id="ecommerce-basic-info" class="mx-4 mb-4 p-4">
    <h2 class="mb-4 text-4 font-600 leading-5">
      {{ $t('基础信息') }}
    </h2>
    <TsForm ref="form" position="left" :label-props="{ width: '100px' }" :inputs="inputs" :validate-on-value-update="false" validate-on-blur class="gap-4">
      <template #default="{ inputs: formInputs }">
        <template v-for="input in formInputs" :key="input.name">
          <template v-if="input.name !== 'customPlatformUrl'">
            <FormItem :input="input" />
            <div v-if="input.name === 'accountPlatform' && isCustomPlatform" class="custom-platform-url item item--left">
              <div class="item__label text-right shrink-0 pt-1.5" style="width: 100px">
                <MInputLabel :label="$t('平台地址')" required />
              </div>
              <div class="item__content flex-1 min-w-0">
                <MInputText :model-value="customPlatformUrl" :placeholder="$t('请输入平台地址')" :invalid="Boolean(customPlatformUrlError)" fluid @update:model-value="onCustomPlatformUrlUpdate" />
                <Message v-if="customPlatformUrlError" severity="error" size="small" variant="simple">
                  {{ customPlatformUrlError }}
                </Message>
              </div>
            </div>
          </template>
        </template>
      </template>
    </TsForm>
  </section>
</template>

<style lang="scss" scoped>
.item--left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg, 12px);
}
</style>
