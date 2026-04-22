<script setup lang="ts">
import { useRouter } from 'vue-router'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { useThemeStore } from '/@/stores/theme'
import StepGuide from './step-guide.vue'
import MInputPassword from '/@/views/lab/components/form/m-input-password.vue'
import { useDialog } from '/@/hooks/useDialog'

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'update:fieldValue': [field: string, value: string]
  'test': [field: string]
  'save': []
  'delete': []
}>()

const themeStore = useThemeStore()
const [showModal] = useDialog()

// 验证状态
const validationErrors = ref<string[]>([])

/**
 * 检查必填字段是否已填写
 */
function validateFields(): boolean {
  const errors: string[] = []

  props.setupFields?.forEach((field) => {
    if (field.required && (!field.value || field.value.trim() === '')) {
      errors.push(field.field)
    }
  })

  validationErrors.value = errors
  return errors.length === 0
}

interface Step {
  number?: number
  text?: string
  component?: any
  [key: string]: any
}

interface SetupField {
  field: string
  label: string
  placeholder?: string
  helperText?: string
  helperTextComponent?: any
  hasTestButton?: boolean
  testButtonText?: string
  onTest?: () => void
  value?: string
  loading?: boolean
  type?: 'text' | 'select' | 'password'
  options?: { label: string, value: string }[]
  required?: boolean
}

interface Props {
  title: string
  icon: string
  bgColor: string
  steps?: Step[]
  setupFields?: SetupField[]
  permissions?: string[]
  step2?: Step[]
  modelValue?: string[]
  isIntegrate?: boolean
}

const router = useRouter()

function handleTest(field: string) {
  emit('test', field)
}

function handleFieldChange(field: string, value: string) {
  emit('update:fieldValue', field, value)
  // 清除该字段的验证错误
  if (validationErrors.value.includes(field)) {
    validationErrors.value = validationErrors.value.filter(f => f !== field)
  }
}

function handleSave() {
  if (validateFields()) {
    emit('save')
  }
  else {
    console.log('Required fields missing:', validationErrors.value)
  }
}

function handleDelete() {
  showModal({
    header: $t('删除配置'),
    modal: true,
    okText: $t('确认删除'),
    okProps: { severity: 'danger' },
    slots: {
      default: () => h('p', {
        class: 'text-[var(--colors-text-text-secondary)] text-[14px] leading-[1.6] my-0',
      }, $t('此操作将清空 {title} 的所有配置，确认继续？', { title: props.title })),
    },
    handleOk: () => {
      emit('delete')
    },
  })
}
</script>

<template>
  <div class="bg-[var(--colors-background-bg-page,white)] border border-[var(--colors-border-border-inactive,#e2e9ee)] border-solid overflow-y-auto relative rounded-[var(--radius-sm,4px)] size-full">
    <!-- Back button -->
    <div class="sticky top-0 z-10 bg-[var(--colors-background-bg-page)] content-stretch flex gap-[10px] items-center pl-6 py-[10px] border-b-1 border-b-solid border-b-[var(--component-dropdown-divider)] cursor-pointer" @click="router.back()">
      <SvgIcon name="base/rx_ic_chevron_left" size="24" />
      <div class="font-600 justify-center shrink-0 text-[14px] text-[var(--colors-text-text-primary)] ">
        {{ title }}
      </div>
    </div>

    <!-- Content container -->
    <div class="flex flex-col items-center w-full px-6">
      <!-- Header with icons -->
      <div class="content-stretch flex items-end justify-between top-[105px] w-[218px] mt-10 mb-16">
        <img
          :src="themeStore.realTheme === 'dark' ? '/images/roxy-claw/roxyclaw-dark.png' : '/images/roxy-claw/roxyclaw-light.png'"
          class="w-12 object-contain select-none" draggable="false"
          alt="RoxyClaw"
        >
        <div class="w-fit flex gap-1.5 h-52px items-center">
          <div v-for="n in 8" :key="n" class="bg-[var(--colors-border-border-subtle)] w-6px h-5px rounded-full" />
        </div>
        <img :src="icon" class="w-52px translate-y-1 select-none" draggable="false">
      </div>

      <!-- Main content -->
      <div class="content-stretch flex flex-col gap-12 items-end w-[713px] pb-20">
        <!-- Step-by-step guidance -->
        <template v-if="props.steps">
          <StepGuide
            :title="$t('操作指引')"
            :steps="props.steps"
            :permissions="props.permissions"
            :step-number-bg-color="props.bgColor"
            :is-integrate="isIntegrate"
          >
            <template #step-content="{ step }">
              <p class="leading-[1.5] my-0">
                {{ step.text }}
              </p>
            </template>
          </StepGuide>
        </template>

        <!-- Bot setup -->
        <template v-if="props.setupFields">
          <div class="content-stretch flex flex-col gap-4 items-start relative shrink-0 w-full">
            <div class="flex flex-col font-bold justify-center  not-italic relative shrink-0 text-[16px] text-[var(--colors-text-text-primary,#111213)] w-full">
              <p class="leading-[normal] my-0">
                {{ $t('Bot 配置') }}
              </p>
            </div>

            <div
              v-for="field in props.setupFields"
              :key="field.field"
              class="content-stretch flex flex-col gap-2 items-start relative shrink-0 w-full"
            >
              <div class="flex relative text-[14px] text-[var(--colors-text-text-primary)] w-full gap-1">
                <span v-if="field.required" class="text-[var(--colors-text-text-error)]">*</span>
                {{ field.label }}
              </div>
              <div class="content-stretch flex flex-col gap-1 items-start relative shrink-0 w-full">
                <div class="content-stretch flex gap-3 items-center relative shrink-0 w-full">
                  <RxInputText
                    v-if="!field.type || field.type === 'text'"
                    size="md"
                    :placeholder="field.placeholder"
                    :model-value="field.value"
                    class="flex-[1_0_0]"
                    :invalid="validationErrors.includes(field.field)"
                    @update:model-value="handleFieldChange(field.field, $event)"
                  />
                  <RxInputSelect
                    v-if="field.type === 'select'"
                    size="md"
                    :placeholder="field.placeholder"
                    :model-value="field.value"
                    :options="field.options"
                    option-label="label"
                    option-value="value"
                    class="!w-240px"
                    :filter="false"
                    :invalid="validationErrors.includes(field.field)"
                    @update:model-value="handleFieldChange(field.field, $event)"
                  />
                  <MInputPassword
                    v-if="field.type === 'password'"
                    size="md"
                    :placeholder="field.placeholder"
                    :model-value="field.value"
                    class="flex-[1_0_0]"
                    :invalid="validationErrors.includes(field.field)"
                    @update:model-value="handleFieldChange(field.field, $event)"
                  />
                  <RxButton
                    v-if="field.hasTestButton"
                    v-model:loading="field.loading"
                    severity="secondary"
                    size="md"
                    outlined
                    icon="base/rx_ic_speed_test"
                    :label="$t('测试连接')"
                    @click="handleTest(field.field)"
                  />
                </div>
                <small v-if="validationErrors.includes(field.field)" class="text-[var(--colors-text-text-error)]">{{ $t('此字段为必填项') }}</small>
                <div v-if="field.helperText || field.helperTextComponent" class="flex flex-col  font-normal justify-center  not-italic relative shrink-0 text-[12px] text-[var(--colors-text-text-inactive,#7d8387)] w-full">
                  <component :is="field.helperTextComponent" v-if="field.helperTextComponent" />
                  <p v-else class="leading-[18px] my-0">
                    {{ field.helperText }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>
        <slot />

        <!-- Action buttons -->
        <div class="content-stretch flex justify-end gap-2.5 relative shrink-0 w-full mt-4">
          <RxButton
            severity="danger"
            size="md"
            :label="$t('删除配置')"
            @click="handleDelete"
          />
          <RxButton
            severity="primary"
            size="md"
            :label="$t('保存配置')"
            @click="handleSave"
          />
        </div>
      </div>
    </div>
  </div>
</template>
