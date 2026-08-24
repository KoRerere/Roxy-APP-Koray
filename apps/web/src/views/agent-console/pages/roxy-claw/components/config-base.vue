<script setup lang="ts">
import { getImage } from '/@/utils/basic'
import { useRouter } from 'vue-router'
import { useThemeStore } from '/@/stores/theme'
import StepGuide from './step-guide.vue'
import { useDialog } from '/@/hooks/useDialog'
import AgentConsolePageLayout from '../../../components/AgentConsolePageLayout.vue'
import { AgentButton, AgentInput, AgentSelect } from '../../../components/form'

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
  notActionButtons?: boolean
  compact?: boolean
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
  <AgentConsolePageLayout :show-profile-monitor-toggle="false" overflow="auto" padding="0" mobile-padding="0">
    <div class="roxy-config-page" :class="{ 'roxy-config-page--compact': props.compact }">
      <!-- Back button -->
      <button class="back-button" type="button" @click="router.back()">
        <SvgIcon name="base/rx_ic_chevron_left" size="18" />
        <span>{{ $t('返回 RoxyClaw') }}</span>
      </button>

      <!-- Content container -->
      <div class="config-shell">
        <!-- Header with icons -->
        <div class="integration-visual">
          <span class="visual-claw">
            <img
              :src="themeStore.realTheme === 'dark' ? getImage('roxy-claw/roxyclaw-dark.png') : getImage('roxy-claw/roxyclaw-light.png')"
              draggable="false"
              alt="RoxyClaw"
              class="w-full"
            >
          </span>
          <span class="visual-line" aria-hidden="true" />
          <span class="visual-target" :class="{ 'visual-target--light': bgColor === '#fff' || bgColor === 'white' }" :style="{ backgroundColor: bgColor }">
            <img :src="icon" draggable="false" alt="">
          </span>
        </div>

        <!-- Main content -->
        <div class="config-content">
          <!-- Step-by-step guidance -->
          <template v-if="props.steps">
            <StepGuide
              :title="$t('操作指引')"
              :steps="props.steps"
              :permissions="props.permissions"
              step-number-bg-color="var(--color-bg-primary-inverse)"
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
            <div class="setup-section">
              <h2>{{ $t('Bot 配置') }}</h2>

              <div
                v-for="field in props.setupFields"
                :key="field.field"
                class="setup-field"
              >
                <label class="field-label">
                  {{ field.label }}
                  <span v-if="field.required">*</span>
                </label>
                <div class="field-body">
                  <div class="field-control-row">
                    <AgentInput
                      v-if="!field.type || field.type === 'text'"
                      :placeholder="field.placeholder"
                      :model-value="field.value"
                      class="flex-[1_0_0]"
                      :invalid="validationErrors.includes(field.field)"
                      @update:model-value="handleFieldChange(field.field, $event)"
                    />
                    <AgentSelect
                      v-if="field.type === 'select'"
                      name="claw"
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
                    <AgentInput
                      v-if="field.type === 'password'"
                      type="password"
                      :placeholder="field.placeholder"
                      :model-value="field.value"
                      class="flex-[1_0_0]"
                      :invalid="validationErrors.includes(field.field)"
                      @update:model-value="handleFieldChange(field.field, $event)"
                    />
                    <AgentButton
                      v-if="field.hasTestButton"
                      class="field-test-button"
                      variant="secondary"
                      :icon="false"
                      :loading="field.loading"
                      :label="$t('测试')"
                      @click="handleTest(field.field)"
                    >
                      <template #icon>
                        <span v-if="field.loading" class="field-test-icon field-test-icon--loading" aria-hidden="true" />
                        <svg
                          v-else
                          class="field-test-icon"
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path d="M12 16C13.1046 16 14 15.1046 14 14C14 12.8954 13.1046 12 12 12C10.8954 12 10 12.8954 10 14C10 15.1046 10.8954 16 12 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M20.0007 20C21.2561 18.3287 22 16.2512 22 14C22 12.5778 21.7031 11.2249 21.1679 10M3.99927 20C2.74389 18.3287 2 16.2512 2 14C2 8.47715 6.47715 4 12 4C13.4222 4 14.7751 4.2969 16 4.83209" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M13.5 12.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </template>
                    </AgentButton>
                  </div>
                  <small v-if="validationErrors.includes(field.field)" class="text-[var(--colors-text-text-error)]">{{ $t('此字段为必填项') }}</small>
                  <div v-if="field.helperText || field.helperTextComponent" class="helper-text">
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
          <div v-if="!notActionButtons" class="action-row">
            <AgentButton
              variant="danger"
              :icon="false"
              :label="$t('删除配置')"
              @click="handleDelete"
            />
            <AgentButton
              variant="primary"
              :icon="false"
              :label="$t('保存配置')"
              @click="handleSave"
            />
          </div>
        </div>
      </div>
    </div>
  </AgentConsolePageLayout>
</template>

<style lang="scss" scoped>
.roxy-config-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 59px 24px 60px;
  background: var(--color-bg-primary, #fcfcfc);
}

.roxy-config-page--compact {
  padding: 32px 24px 28px;

  .config-shell {
    gap: 24px;
    margin-top: 20px;
  }

  .config-content {
    gap: 20px;
  }
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: max(0px, calc((100% - 720px) / 2));
  padding: 0;
  border: 0;
  color: var(--color-text-quaternary, #737373);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;

  &:hover {
    color: var(--color-text-primary, #141414);
  }
}

.config-shell {
  display: flex;
  width: min(100%, 720px);
  flex-direction: column;
  align-items: center;
  gap: 48px;
  margin: 35px auto 0;
}

.integration-visual {
  display: flex;
  width: 218px;
  align-items: center;
  justify-content: space-between;
}

.visual-claw,
.visual-target {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}

.visual-claw {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.visual-line {
  width: 98px;
  border-top: 4px dashed var(--color-border-secondary, #d6d6d6);
}

.visual-target {
  width: 52px;
  height: 52px;
  border-radius: 999px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
  }
}

// .visual-target--light {
//   background: #fff;
// }

.config-content {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-end;
  gap: 32px;
}

.setup-section {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;

  h2 {
    margin: 0;
    color: var(--color-text-primary, #141414);
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
  }
}

.setup-field {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.field-label {
  color: var(--color-text-primary, #141414);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;

  span {
    color: #f04438;
  }
}

.field-body {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.field-control-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
}

.field-test-button {
  min-width: 60px;
  flex: 0 0 auto;
}

.field-test-icon {
  display: inline-block;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.field-test-icon--loading {
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: field-test-icon-spin 0.7s linear infinite;
}

@keyframes field-test-icon-spin {
  to {
    transform: rotate(360deg);
  }
}

.helper-text {
  width: 100%;
  color: var(--color-text-quaternary, #737373);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.action-row {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 760px) {
  .roxy-config-page {
    padding: 48px 16px 40px;
  }

  .back-button {
    margin-left: 0;
  }

  .config-shell {
    gap: 36px;
    margin-top: 32px;
  }

  .field-control-row,
  .action-row {
    align-items: stretch;
    flex-direction: column;
  }

  .field-test-button {
    width: 100%;
  }

  .roxy-config-page--compact {
    padding: 24px 16px 28px;

    .config-shell {
      gap: 20px;
      margin-top: 20px;
    }
  }
}
</style>
