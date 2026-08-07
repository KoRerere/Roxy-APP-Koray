<script setup lang="ts">
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'
import type { Ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useAgentConsoleApi } from '../../api'
import {
  getFeedbackErrorMessage,
  MAX_FEEDBACK_IMAGES,
  readFeedbackSubmission,
  readFeedbackUpload,
  resolveFeedbackPlatform,
  selectFeedbackImages,
} from '../../feedback'
import { useUserStore } from '/@/stores/user'
import { useThemeStore } from '/@/stores/theme'
import AgentButton from '../form/AgentButton.vue'
import AgentFormField from '../form/AgentFormField.vue'
import AgentInput from '../form/AgentInput.vue'
import AgentTextarea from '../form/AgentTextarea.vue'
import './agent-dialog.scss'

interface SelectedFeedbackImage {
  file: File
  id: string
  previewUrl: string
}

const dialogRef = inject<Ref<DynamicDialogInstance>>('dialogRef')
const agentApi = useAgentConsoleApi()
const userStore = useUserStore()
const { realTheme } = storeToRefs(useThemeStore())
const feedbackQrSrc = computed(() => `/images/agent-console/feedback-consultant-qr-${realTheme.value}.svg`)
const toast = useToast()
const contact = ref('')
const content = ref('')
const images = ref<SelectedFeedbackImage[]>([])
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')
const submitting = ref(false)
const showValidation = ref(false)
const formError = ref('')
const imageSelectionMessage = ref('')
let nextImageId = 0

const contactInvalid = computed(() => showValidation.value && !contact.value.trim())
const contentInvalid = computed(() => showValidation.value && !content.value.trim())
const canAddImages = computed(() => images.value.length < MAX_FEEDBACK_IMAGES && !submitting.value)
const formValid = computed(() => Boolean(contact.value.trim() && content.value.trim()))

function closeDialog() {
  if (!submitting.value)
    dialogRef?.value.close()
}

function chooseImages() {
  if (canAddImages.value)
    fileInputRef.value?.click()
}

function removeImage(imageId: string) {
  if (submitting.value)
    return

  const index = images.value.findIndex(image => image.id === imageId)
  if (index === -1)
    return

  URL.revokeObjectURL(images.value[index].previewUrl)
  images.value.splice(index, 1)
  imageSelectionMessage.value = ''
}

function handleImageSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const candidates = Array.from(input.files ?? [])
  input.value = ''

  const selection = selectFeedbackImages(images.value.map(image => image.file), candidates)
  images.value.push(...selection.accepted.map(file => ({
    file,
    id: `feedback-image-${nextImageId++}`,
    previewUrl: URL.createObjectURL(file),
  })))

  const messages: string[] = []
  if (selection.invalidCount)
    messages.push($t('仅支持上传图片文件'))
  if (selection.duplicateCount)
    messages.push($t('已忽略重复图片'))
  if (selection.overflowCount)
    messages.push($t('最多上传 {count} 张图片', { count: MAX_FEEDBACK_IMAGES }))
  imageSelectionMessage.value = messages.join('；')
}

async function submitFeedback() {
  showValidation.value = true
  formError.value = ''
  if (!formValid.value || submitting.value)
    return

  submitting.value = true
  try {
    const imageFileIds: string[] = []
    for (const image of images.value) {
      const response = await agentApi.files.uploadFileV2V2FilesUploadPost({ file: image.file })
      imageFileIds.push(readFeedbackUpload(response, $t('图片上传失败')).file_id)
    }

    const response = await agentApi.feedback.submitFeedback({
      contact: contact.value.trim(),
      content: content.value.trim(),
      imageFileIds,
      appVersion: userStore.appVersion || globalThis.$appVersion || undefined,
      platform: resolveFeedbackPlatform(navigator),
    })
    readFeedbackSubmission(response, $t('反馈提交失败'))

    toast.add({
      severity: 'success',
      summary: $t('提交成功'),
      detail: $t('感谢你的反馈，我们会尽快处理。'),
      life: 3000,
    })
    dialogRef?.value.close({ submitted: true })
  }
  catch (error) {
    console.error('[agent-console] Failed to submit feedback:', error)
    formError.value = getFeedbackErrorMessage(error, $t('反馈提交失败，请稍后重试'))
  }
  finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  images.value.forEach(image => URL.revokeObjectURL(image.previewUrl))
})
</script>

<template>
  <form class="agent-console-dialog__shell feedback-dialog" @submit.prevent="submitFeedback">
    <header class="agent-console-dialog__header">
      <h2 class="agent-console-dialog__title">
        {{ $t('帮助与反馈') }}
      </h2>
      <button
        class="agent-console-dialog__close"
        type="button"
        :aria-label="$t('关闭')"
        :disabled="submitting"
        @click="closeDialog"
      />
    </header>

    <main class="agent-console-dialog__body feedback-dialog__body">
      <section class="feedback-dialog__consultant">
        <img
          class="feedback-dialog__qr"
          :src="feedbackQrSrc"
          :alt="$t('专属顾问服务二维码')"
          width="135"
          height="135"
        >
        <div class="feedback-dialog__consultant-content">
          <div>
            <h3 class="feedback-dialog__consultant-title">
              <SvgIcon name="roxy-agent/rx-ic-official-badge" size="22" aria-hidden="true" />
              <span>{{ $t('专属顾问服务') }}</span>
            </h3>
            <p>
              {{ $t('扫码添加专属技术顾问，获取一对一AI自动化方案咨询/模板定制/使用答疑等服务。') }}
            </p>
          </div>
        </div>
      </section>

      <div class="feedback-dialog__divider" />

      <section class="feedback-dialog__form-section">
        <h3>{{ $t('留言反馈') }}</h3>

        <div class="feedback-dialog__fields">
          <AgentFormField :label="$t('联系方式')">
            <AgentInput
              v-model="contact"
              type="text"
              maxlength="255"
              :placeholder="$t('微信号 / 手机号 / 邮箱，方便我们回复你')"
              :aria-invalid="contactInvalid"
              :disabled="submitting"
            />
            <p v-if="contactInvalid" class="feedback-dialog__field-error">
              {{ $t('请填写联系方式') }}
            </p>
          </AgentFormField>

          <AgentFormField :label="$t('反馈内容')">
            <AgentTextarea
              v-model="content"
              :rows="5"
              maxlength="10000"
              :placeholder="$t('描述你的需求或遇到的问题。')"
              :aria-invalid="contentInvalid"
              :disabled="submitting"
            />
            <p v-if="contentInvalid" class="feedback-dialog__field-error">
              {{ $t('请填写反馈内容') }}
            </p>
          </AgentFormField>

          <AgentFormField :label="$t('添加图片')">
            <input
              ref="fileInputRef"
              class="feedback-dialog__file-input"
              type="file"
              accept="image/*"
              multiple
              :disabled="submitting"
              @change="handleImageSelection"
            >
            <div class="feedback-dialog__images">
              <div v-for="image in images" :key="image.id" class="feedback-dialog__image">
                <img :src="image.previewUrl" :alt="image.file.name">
                <button
                  type="button"
                  :aria-label="$t('移除图片 {name}', { name: image.file.name })"
                  :disabled="submitting"
                  @click="removeImage(image.id)"
                >
                  <SvgIcon name="roxy-agent/rx-ic-close2" size="18" aria-hidden="true" />
                </button>
              </div>

              <button
                v-if="canAddImages"
                class="feedback-dialog__add-image"
                type="button"
                :aria-label="$t('添加图片')"
                @click="chooseImages"
              >
                <SvgIcon name="base/rx_ic_plus" size="18" aria-hidden="true" />
              </button>
            </div>
            <p v-if="imageSelectionMessage" class="feedback-dialog__selection-message">
              {{ imageSelectionMessage }}
            </p>
          </AgentFormField>
        </div>

        <p v-if="formError" class="feedback-dialog__submit-error" role="alert">
          {{ formError }}
        </p>
      </section>
    </main>

    <footer class="agent-console-dialog__footer">
      <div class="agent-console-dialog__actions feedback-dialog__actions">
        <AgentButton variant="secondary" :icon="false" :disabled="submitting" @click="closeDialog">
          {{ $t('取消') }}
        </AgentButton>
        <AgentButton variant="primary" native-type="submit" :icon="false" :loading="submitting">
          {{ $t('提交') }}
        </AgentButton>
      </div>
    </footer>
  </form>
</template>

<style lang="scss" scoped>
:global(.agent-console-feedback-dialog.p-dialog) {
  width: min(520px, calc(100vw - 32px));
}

.feedback-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feedback-dialog__consultant {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  padding: 16px;
  border-radius: 16px;
  background: var(--color-bg-tertiary);
}

.feedback-dialog__qr {
  display: block;
  width: 135px;
  max-width: 100%;
  max-height: 100%;
  height: auto;
  min-width: 0;
  aspect-ratio: 1;
  flex: 0 1 135px;
  object-fit: contain;
}

.feedback-dialog__consultant-content {
  display: flex;
  min-width: 0;
  align-self: stretch;
  flex: 1;
  flex-direction: column;
  justify-content: center;

  p {
    margin: 0;
  }

  p {
    margin-top: 10px;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 20px;
  }
}

.feedback-dialog__consultant-title {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 500;
  line-height: 20px;
}

.feedback-dialog__divider {
  width: 100%;
  border-top: 1px dashed var(--color-border-secondary);
}

.feedback-dialog__form-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;

  > h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: 500;
    line-height: 20px;
  }
}

.feedback-dialog__fields {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.feedback-dialog__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.feedback-dialog__images {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}

.feedback-dialog__image,
.feedback-dialog__add-image {
  position: relative;
  width: 80px;
  height: 80px;
  flex: 0 0 80px;
  border-radius: 8px;
}

.feedback-dialog__image {
  background: var(--color-bg-tertiary);

  > img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
  }

  > button {
    position: absolute;
    top: -9px;
    right: -9px;
    display: grid;
    width: 18px;
    height: 18px;
    padding: 0;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: var(--color-bg-primary-inverse);
    background: var(--color-bg-primary);
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }
}

.feedback-dialog__add-image {
  display: grid;
  place-items: center;
  border: 1px dashed var(--color-border-primary);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-secondary-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--color-border-primary-inverse);
    outline-offset: 2px;
  }
}

.feedback-dialog__field-error,
.feedback-dialog__selection-message,
.feedback-dialog__submit-error {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
}

.feedback-dialog__field-error,
.feedback-dialog__submit-error {
  color: var(--color-text-error-primary);
}

.feedback-dialog__selection-message {
  color: var(--color-text-secondary);
}

.feedback-dialog__submit-error {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--color-bg-error-primary);
}

.feedback-dialog__actions {
  gap: 10px;
}

@media (max-width: 520px) {
  .feedback-dialog__consultant {
    align-items: stretch;
    flex-direction: column;
  }

  .feedback-dialog__qr {
    align-self: center;
  }

  .feedback-dialog__consultant-content {
    gap: 12px;
  }
}
</style>
