<script setup lang="ts">
import { $t } from '/@/locales'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { API } from '/@/api'

const appVersion = ref('')
const selectedReasons = ref<string[]>([])
const feedbackText = ref('')
const isSubmitting = ref(false)
const isUninstallMode = ref(false) // 是否是卸载程序启动的模式

// 卸载原因选项
const uninstallReasons = [
  { value: 'slow', label: $t('运行速度慢,卡顿') },
  { value: 'missing-features', label: $t('缺少需要的功能') },
  { value: 'unfriendly-ui', label: $t('界面不够友好') },
  { value: 'price', label: $t('价格不合适') },
  { value: 'bugs', label: $t('遇到 Bug 或问题') },
  { value: 'better-alternative', label: $t('找到了更好的替代品') },
  { value: 'other', label: $t('其他原因') },
]

// 监听卸载反馈模式
window.electronAPI.on('app:uninstall-feedback-mode', (isUninstall) => {
  isUninstallMode.value = isUninstall
})

// 获取应用版本
window.electronAPI.send('app:getAppVersion').then((version) => {
  appVersion.value = version
})

// 切换选择原因
function toggleReason(value: string) {
  const index = selectedReasons.value.indexOf(value)
  if (index > -1) {
    selectedReasons.value.splice(index, 1)
  } else {
    selectedReasons.value.push(value)
  }
}

// 提交反馈
async function submitFeedback() {
  if (selectedReasons.value.length === 0 && !feedbackText.value.trim()) {
    return
  }

  isSubmitting.value = true
  try {
    // 发送反馈到服务器
    await API.base.userSetUserConfigCreate({
      uninstallFeedback: {
        reasons: selectedReasons.value,
        feedback: feedbackText.value.trim(),
        version: appVersion.value,
        timestamp: Date.now(),
      },
    }).catch(() => {
      // 即使发送失败也继续退出
      console.error('Failed to submit uninstall feedback')
    })

    // 通知主进程可以退出
    await window.electronAPI.send('app:uninstall-feedback-submitted', {
      reasons: selectedReasons.value,
      feedback: feedbackText.value.trim(),
    })
  } catch (error) {
    console.error('Submit feedback error:', error)
  } finally {
    isSubmitting.value = false
  }
}

// 跳过反馈
async function skipFeedback() {
  await window.electronAPI.send('app:uninstall-feedback-skipped')
}

// 直接卸载
async function uninstallDirectly() {
  await window.electronAPI.send('app:uninstall-directly')
}

// 取消卸载（仅在卸载模式下显示）
async function cancelUninstall() {
  await window.electronAPI.send('app:uninstall-cancelled')
}

// 联系客服
function contactSupport() {
  // 这里可以打开客服链接或窗口
  window.electronAPI.send('app:open-external-url', 'https://support.roxybrowser.com')
}
</script>

<template>
  <div class="uninstall-feedback">
    <div class="drag-bar" />
    
    <!-- Header Section -->
    <div class="header">
      <div class="icon-wrapper">
        <RxSvgIcon name="base/logo" class="icon" size="48px" />
      </div>
      <h1 class="title">{{ $t('很遗憾看到您要离开') }}</h1>
      <p class="subtitle">{{ $t('您的反馈对我们很重要,帮助我们变得更好') }}</p>
    </div>

    <!-- Feedback Form Section -->
    <div class="feedback-form">
      <div class="form-title">
        <div class="title-bar" />
        <span>{{ $t('请告诉我们您卸载的原因 (可多选)') }}</span>
      </div>
      
      <div class="reasons-list">
        <label
          v-for="reason in uninstallReasons"
          :key="reason.value"
          class="reason-item"
        >
          <input
            type="checkbox"
            :checked="selectedReasons.includes(reason.value)"
            @change="toggleReason(reason.value)"
          >
          <span>{{ reason.label }}</span>
        </label>
      </div>

      <div class="feedback-textarea">
        <textarea
          v-model="feedbackText"
          :placeholder="$t('如果您愿意,可以详细说明一下原因,帮助我们改进...')"
          rows="4"
        />
      </div>
    </div>

    <!-- Retention Offer Section -->
    <div class="retention-offer">
      <div class="offer-title">
        <RxSvgIcon name="base/logo" class="offer-icon" size="20px" />
        <span>{{ $t('我们想挽留您') }}</span>
      </div>
      <p class="offer-desc">
        {{ $t('如果您愿意给我们一次改进的机会,联系我们的客服,我们将为您提供:') }}
      </p>
      <div class="offer-items">
        <div class="offer-item">
          <RxSvgIcon name="base/logo" class="offer-item-icon" size="16px" />
          <span>{{ $t('7天会员体验') }}</span>
        </div>
        <div class="offer-item">
          <RxSvgIcon name="base/logo" class="offer-item-icon" size="16px" />
          <span>{{ $t('优先技术支持') }}</span>
        </div>
        <div class="offer-item">
          <RxSvgIcon name="base/logo" class="offer-item-icon" size="16px" />
          <span>{{ $t('专属优惠券') }}</span>
        </div>
      </div>
      <button class="contact-btn" @click="contactSupport">
        {{ $t('联系客服') }} →
      </button>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button
        class="btn btn-primary"
        :disabled="isSubmitting || (selectedReasons.length === 0 && !feedbackText.trim())"
        @click="submitFeedback"
      >
        {{ $t('提交反馈') }}
      </button>
      <button class="btn btn-secondary" @click="skipFeedback">
        {{ $t('跳过') }}
      </button>
      <!-- 卸载模式下显示取消按钮 -->
      <button v-if="isUninstallMode" class="btn btn-cancel" @click="cancelUninstall">
        {{ $t('取消卸载') }}
      </button>
      <!-- 非卸载模式下显示"直接卸载"链接 -->
      <button v-if="!isUninstallMode" class="btn-link" @click="uninstallDirectly">
        {{ $t('直接卸载,无需反馈') }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.uninstall-feedback {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  overflow-y: auto;
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

.header {
  text-align: center;
  margin-bottom: 32px;
  z-index: 10;

  .icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    backdrop-filter: blur(10px);
  }

  .icon {
    color: #fff;
  }

  .title {
    color: #fff;
    font-size: 28px;
    font-weight: 600;
    margin: 0 0 8px;
  }

  .subtitle {
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    margin: 0;
  }
}

.feedback-form {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

  .form-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-bottom: 20px;

    .title-bar {
      width: 4px;
      height: 20px;
      background: #667eea;
      border-radius: 2px;
    }
  }

  .reasons-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;

    .reason-item {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background-color 0.2s;

      &:hover {
        background-color: #f5f5f5;
      }

      input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      span {
        font-size: 14px;
        color: #333;
        user-select: none;
      }
    }
  }

  .feedback-textarea {
    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 100px;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #667eea;
      }

      &::placeholder {
        color: #999;
      }
    }
  }
}

.retention-offer {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);

  .offer-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 12px;

    .offer-icon {
      color: #fff;
    }
  }

  .offer-desc {
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    margin: 0 0 16px;
    line-height: 1.6;
  }

  .offer-items {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 20px;

    .offer-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      font-size: 14px;

      .offer-item-icon {
        color: #fff;
      }
    }
  }

  .contact-btn {
    width: 100%;
    padding: 12px 24px;
    background: #fff;
    color: #667eea;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.action-buttons {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 600px;
  z-index: 10;

  .btn {
    flex: 1;
    padding: 14px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &.btn-primary {
      background: #667eea;
      color: #fff;

      &:hover:not(:disabled) {
        background: #5568d3;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &.btn-secondary {
      background: #fff;
      color: #667eea;
      border: 1px solid #e0e0e0;

      &:hover {
        background: #f5f5f5;
      }
    }

    &.btn-cancel {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.3);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }

  .btn-link {
    width: 100%;
    margin-top: 12px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    cursor: pointer;
    text-decoration: underline;
    padding: 8px;

    &:hover {
      color: #fff;
    }
  }
}

@media (max-width: 640px) {
  .uninstall-feedback {
    padding: 20px 16px;
  }

  .header .title {
    font-size: 24px;
  }

  .action-buttons {
    flex-direction: column;

    .btn-link {
      margin-top: 8px;
    }
  }
}
</style>
