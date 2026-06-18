<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'
import { validatePromotionCode } from './utils'

const {
  promotionCode,
  promotionLink,
  nextModifyTime,
  hideFn,
  onSuccess,
} = defineProps<{
  promotionCode: string
  promotionLink: string
  nextModifyTime?: number
  hideFn: () => void
  onSuccess: () => Promise<void>
}>()

const [showToast, onlyErrorToast] = useResponseToast()
const { isZh } = storeToRefs(useSimpleLocale())

const newPromotionCode = ref(promotionCode)
const hasEdited = ref(false)
const alertVisible = ref(true)
const submitting = ref(false)
const remainingSeconds = ref(0)

let countdownTimer: ReturnType<typeof setInterval> | undefined

const canModify = computed(() => remainingSeconds.value <= 0)

const promotionCodeValidation = computed(() => validatePromotionCode(newPromotionCode.value))

const modifiedLink = computed(() => buildModifiedLink(promotionLink, newPromotionCode.value.trim()))

const cooldownText = computed(() => {
  if (remainingSeconds.value <= 0)
    return ''
  return formatRemainingTime(remainingSeconds.value)
})

const showValidationError = computed(() => {
  if (!hasEdited.value || !canModify.value)
    return false
  return !promotionCodeValidation.value.isValid
})

const submitDisabled = computed(() => {
  if (!canModify.value || submitting.value || !hasEdited.value)
    return true

  const code = newPromotionCode.value.trim()
  if (!code || code === promotionCode)
    return true

  return !promotionCodeValidation.value.isValid
})

function handlePromotionCodeInput() {
  hasEdited.value = true
}

watch(() => nextModifyTime, () => {
  updateRemainingSeconds()
}, { immediate: true })

onMounted(() => {
  countdownTimer = setInterval(updateRemainingSeconds, 60_000)
})

onUnmounted(() => {
  if (countdownTimer)
    clearInterval(countdownTimer)
})

function updateRemainingSeconds() {
  if (!nextModifyTime)
    remainingSeconds.value = 0
  else
    remainingSeconds.value = Math.max(0, nextModifyTime - Math.floor(Date.now() / 1000))
}

function buildModifiedLink(originalLink: string, newCode: string) {
  if (!originalLink || !newCode)
    return originalLink

  try {
    const url = new URL(originalLink)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      segments[segments.length - 1] = newCode
      url.pathname = `/${segments.join('/')}`
    }
    return url.toString()
  }
  catch {
    return originalLink.replace(/[^/?#]+$/, newCode)
  }
}

function formatRemainingTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (isZh.value)
    return `${days} 天 ${hours} 小时 ${minutes} 分钟`
  return `${days}d ${hours}h ${minutes}m`
}

async function handleConfirm() {
  if (submitDisabled.value)
    return

  submitting.value = true
  try {
    const { code, msg } = await API.base.userModifyPromotionLinkCreate({
      promotionCode,
      newPromotionCode: newPromotionCode.value.trim(),
    })
    if (code === 0) {
      showToast(0, msg || $t('操作成功'))
      await onSuccess()
      hideFn()
      return
    }
    onlyErrorToast(code, msg)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="edit-promotion-code-modal">
    <RxAlert
      v-if="!canModify && cooldownText && alertVisible"
      v-model:visible="alertVisible"
      class="w-full"
      type="info"
      :content="$t('您的邀请码已更新，下次可修改时间剩余 {time}。', { time: cooldownText })"
    />

    <div class="field">
      <div class="field-label">
        {{ $t('邀请码:') }}
      </div>
      <input
        v-model="newPromotionCode"
        type="text"
        class="promotion-code-native-input w-full"
        :class="{ 'is-invalid': showValidationError }"
        :placeholder="$t('6-16 位字母或数字')"
        :disabled="!canModify"
        autocomplete="off"
        spellcheck="false"
        @input="handlePromotionCodeInput"
      >
      <Message v-if="showValidationError" severity="error" size="small" variant="simple">
        {{ promotionCodeValidation.message }}
      </Message>
    </div>

    <div class="modified-link">
      <div class="modified-link-label">
        {{ $t('修改后链接:') }}
      </div>
      <div class="modified-link-value">
        {{ modifiedLink }}
      </div>
    </div>

    <div class="tip">
      <SvgIcon name="base/rx_ic_info" size="16" color="var(--colors-icon-icon-tertiary)" />
      <div class="tip-text">
        {{ $t('30 天内最多允许修改一次') }}
      </div>
    </div>

    <div class="actions">
      <RxButton
        size="lg"
        :label="$t('确认修改')"
        :disabled="submitDisabled"
        :loading="submitting"
        @click="handleConfirm"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.edit-promotion-code-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  color: var(--colors-text-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.promotion-code-native-input {
  box-sizing: border-box;
  height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--colors-border-border-base);
  border-radius: 6px;
  background: var(--colors-background-bg-primary);
  color: var(--colors-text-text-primary);
  font-family:
    JetBrains Mono,
    monospace;
  font-size: 14px;
  line-height: 20px;
  outline: none;

  &::placeholder {
    color: var(--colors-text-text-quaternary);
    font-family: Inter, sans-serif;
  }

  &:focus {
    border-color: var(--colors-border-border-brand);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.is-invalid {
    border-color: var(--colors-border-border-error);
  }
}

.modified-link {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modified-link-label {
  color: var(--colors-text-text-tertiary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.modified-link-value {
  color: var(--colors-text-text-primary);
  font-family:
    JetBrains Mono,
    monospace;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  word-break: break-all;
}

.tip {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.tip-text {
  flex: 1;
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
