<script setup lang="ts">
import { $t } from '/@/locales'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { API } from './api'
import { useElementBounding } from '@vueuse/core'
import type { UserGetUninstallReasonQuestionListListData } from '@roxy/backend-api'
import { useToast } from 'primevue/usetoast'
import LiveChat from './live-chat.vue'

const selectedReasons = ref<number[]>([])
const feedbackText = ref('')
const isSubmitting = ref(false)
const uninstallDialogEl = useTemplateRef('uninstallDialogEl')
const { height } = useElementBounding(uninstallDialogEl)
const toast = useToast()
const loading = ref(false)

// 卸载原因选项
const uninstallReasons = ref<UserGetUninstallReasonQuestionListListData['data']>()
const otherReasonId = computed(() => {
  return uninstallReasons.value?.find(reason => reason.code === 'other')?.id
})

// 监听窗口高度变化，调整窗口大小
watch(height, (height) => {
  console.log('Adjust window height to:', Math.ceil(height))
  globalThis.electronAPI.send('app:resizeWindow', { height: Math.ceil(height) })
})

/**
 * 切换选择原因
 */
function toggleReason(value: number) {
  const index = selectedReasons.value.findIndex(n => n === value)
  if (index > -1) {
    selectedReasons.value.splice(index, 1)
  }
  else {
    selectedReasons.value.push(value)
  }
}

/**
 * 提交反馈
 */
async function submitFeedback() {
  if (selectedReasons.value.length === 0 && !feedbackText.value.trim()) {
    return
  }

  isSubmitting.value = true
  try {
    // 发送反馈到服务器
    await API.userAddUninstallReasonAnswer.userAddUninstallReasonAnswerCreate({
      selectedReasonIds: selectedReasons.value,
      otherReasonText: feedbackText.value.trim(),
    }).catch(() => {
      // 即使发送失败也继续退出
      console.error('Failed to submit uninstall feedback')
    })

    // 通知主进程可以退出
    await globalThis.electronAPI.send('app:uninstall-feedback-submitted', {
      reasons: [...selectedReasons.value],
      feedback: feedbackText.value.trim(),
    })
  }
  catch (error) {
    console.error('Submit feedback error:', error)
  }
  finally {
    isSubmitting.value = false
  }
}

/**
 * 直接卸载
 */
async function uninstallDirectly() {
  await globalThis.electronAPI.send('app:uninstall-directly')
}

/**
 * 取消卸载（仅在卸载模式下显示）
 */
async function cancelUninstall() {
  await globalThis.electronAPI.send('app:uninstall-cancelled')
}

/**
 * 联系客服
 */
function contactSupport() {
  // 这里可以打开客服链接或窗口
  showLiveChat()
}

async function getUninstallReasonQuestionList() {
  loading.value = true
  const { code, data, msg } = await API.base.userGetUninstallReasonQuestionListList().finally(() => {
    loading.value = false
  })
  console.log('getUninstallReasonQuestionList', { code, data, msg })
  if (code === 0) {
    uninstallReasons.value = data
  }
  else {
    toast.add({
      severity: 'error',
      summary: msg,
      life: 3000,
    })
  }
}

getUninstallReasonQuestionList()
</script>

<template>
  <div class="uninstall-feedback">
    <div class="drag-bar" />
    <div ref="uninstallDialogEl" class="uninstall-dialog">
      <div class="dialog-header">
        <div class="dialog-title">
          {{ $t('卸载原因') }}
        </div>
        <button class="close-btn" type="button" @click="cancelUninstall">
          <RxSvgIcon name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary, #575d60)" />
        </button>
      </div>

      <div class="dialog-subtitle">
        {{ $t('请告诉我们您卸载的原因（可多选）') }}
      </div>

      <div class="reasons-list">
        <template v-if="loading">
          <Skeleton v-for="i in 6" :key="i" height="2rem" class="mb-2" />
        </template>
        <template v-else>
          <button
            v-for="reason in uninstallReasons"
            :key="reason.id"
            type="button"
            class="reason-item"
            :class="{ selected: selectedReasons.some(id => id === reason.id) }"
            @click="toggleReason(reason.id)"
          >
            <RxSvgIcon
              class="reason-icon"
              :name="selectedReasons.some(id => id === reason.id) ? 'base/rx_ic_check_fill' : 'base/rx_ic_uncheck'"
              size="12"
              :color="selectedReasons.some(id => id === reason.id) ? 'var(--colors-background-bg-brand, #11a3fd)' : 'var(--colors-text-text-tertiary, #575d60)'"
            />
            <span>{{ reason.title }}</span>
          </button>
        </template>
      </div>

      <div v-if="selectedReasons.some(id => id === otherReasonId)" class="feedback-textarea">
        <textarea
          v-model="feedbackText"
          :placeholder="$t('如果您愿意，可以详细说明一下原因，帮助我们改进...')"
          rows="5"
        />
      </div>

      <div class="retention-offer">
        <p class="offer-desc">
          {{ $t('如果您愿意给我们一次改进的机会，联系我们的客服，我们将为您提供：') }}
        </p>
        <div class="offer-items">
          <div class="offer-item">
            🔧 {{ $t('优先技术支持') }}
          </div>
        </div>
        <button class="contact-btn" type="button" @click="contactSupport">
          <span>{{ $t('联系客服') }}</span>
          <RxSvgIcon name="base/rx_ic_arrow_right" size="16" color="var(--colors-text-text-link, #11a3fd)" />
        </button>
      </div>

      <div class="action-buttons">
        <button
          class="btn btn-primary"
          :disabled="isSubmitting || (selectedReasons.length === 0 && !feedbackText.trim())"
          @click="submitFeedback"
        >
          {{ $t('提交反馈') }}
        </button>
        <button class="btn-link" type="button" @click="uninstallDirectly">
          {{ $t('直接卸载，无需反馈') }}
        </button>
      </div>
    </div>
  </div>
  <Toast group="tr" />
  <LiveChat />
</template>

<style>
body {
  margin: 0;
  background: transparent;
}
</style>

<style lang="scss" scoped>
.uninstall-feedback {
  width: 100vw;
  height: 100vh;
  background: #d7d9db;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.drag-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  z-index: 1000;
  -webkit-app-region: drag;
}

.uninstall-dialog {
  width: 100%;
  height: auto;
  background: #fff;
  padding: 24px;
  border: 0.5px solid #989ca0;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dialog-title {
  font-size: 20px;
  font-weight: 600;
  color: #111213;
}

.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.dialog-subtitle {
  font-size: 16px;
  color: #111213;
  margin-bottom: 16px;
}

.reasons-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  flex: 1;
}

.reason-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 10px 12px;
  background: #fff;
  border: 1px solid #c7d1d6;
  border-radius: 8px;
  box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
  cursor: pointer;
  text-align: left;

  span {
    font-size: 14px;
    color: var(--colors-text-text-tertiary, #575d60);
  }

  &.selected {
    border-color: #11a3fd;

    span {
      color: #11a3fd;
    }
  }
}

.feedback-textarea {
  margin-bottom: 16px;

  textarea {
    width: 100%;
    min-height: 149px;
    padding: 12px;
    border: 1px solid #c7d1d6;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
    color: #111213;

    &:focus {
      outline: none;
      border-color: #11a3fd;
    }

    &::placeholder {
      color: #575d60;
    }
  }
}

.retention-offer {
  margin-top: auto;
  border: 1px solid #11a3fd;
  border-radius: 8px;
  padding: 16px 12px 14px;
  background: linear-gradient(180deg, #def3ff 0%, rgba(255, 255, 255, 0) 140.94%), #fff;
  margin-bottom: 16px;

  .offer-desc {
    font-size: 14px;
    color: #575d60;
    margin: 0 0 10px;
    line-height: 20px;
  }

  .offer-items {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-bottom: 12px;
  }

  .offer-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border-radius: 100px;
    background: #fff;
    color: #575d60;
    font-size: 14px;
    font-weight: 600;
  }

  .contact-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: #11a3fd;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .btn {
    width: 100%;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;

    &.btn-primary {
      background: #11a3fd;
      border-color: #0282d4;
      color: #fff;
      box-shadow:
        0px 4px 4px -1px rgba(0, 0, 0, 0.02),
        0px 1px 1px rgba(0, 0, 0, 0.06);

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }

  .btn-link {
    width: 100%;
    text-align: center;
    background: transparent;
    border: none;
    color: #7d8387;
    font-size: 14px;
    cursor: pointer;
  }
}
</style>
