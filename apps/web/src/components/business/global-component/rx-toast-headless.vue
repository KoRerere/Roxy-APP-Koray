<script setup lang="ts">
import { isString } from 'es-toolkit'
import type { SvgNames } from '../../rx-icon'

const iconMap: Record<string, SvgNames> = {
  success: 'base/rx_ic_check_fill',
  warn: 'base/rx_ic_info_fill',
  error: 'base/rx_ic_info_fill',
  info: 'base/rx_ic_warn_fill',
}

const messageMap: Recordable = {}

function toastCacheKey(message: Recordable) {
  return `${String(message.id)}_${message.severity ?? ''}`
}

/** 从缓存移除并清除自动关闭定时器（手动关闭、自动关闭、鼠标移出后关闭均需调用，否则会残留 messageMap 导致无法再次弹出） */
function disposeToastFromMap(key: string) {
  const entry = messageMap[key]
  if (entry) {
    clearTimeout(entry.closeTimeout)
    Reflect.deleteProperty(messageMap, key)
  }
}

function closeToast(slotData: Recordable) {
  const { message, closeCallback } = slotData
  disposeToastFromMap(toastCacheKey(message))
  closeCallback()
}

function handleMouseenter(slotData: Recordable) {
  const { message } = slotData
  const key = toastCacheKey(message)
  if (messageMap[key]) {
    clearTimeout(messageMap[key].closeTimeout)
  }
}

function handleMouseleave(slotData: Recordable) {
  const { message, closeCallback } = slotData
  const key = toastCacheKey(message)
  if (messageMap[key]) {
    messageMap[key].closeTimeout = setTimeout(() => {
      closeToast({ message, closeCallback })
    }, Math.max(1000, message.originLife - (Date.now() - message.startTimestamp)))
  }
}

function cacheToast(slotData: Recordable) {
  const { message, closeCallback } = slotData
  // console.log('cacheToast', slotData)

  const cacheKey = toastCacheKey(message)

  // 首次入队前：PrimeVue 可能复用 message，life/hide 仍保留上次状态，需恢复才能再次弹出
  if (!messageMap[cacheKey]) {
    if (!Reflect.has(message, 'life') || message.life === 0) {
      message.life = 2500
    }
    if (message.hide) {
      message.hide = false
    }
  }

  const duplicateItem = Object.values(messageMap).find((item) => {
    const { message: { id, groupId, summary, detail, severity } } = item
    return id !== message.id
      && severity === message.severity
      && (groupId === message.groupId
        || (summary === message.summary && detail === message.detail))
  })

  if (duplicateItem) {
    message.hide = true
    message.life = 1
    setTimeout(closeCallback)
    duplicateItem.message.count = (duplicateItem.message.count || 1) + 1
    clearTimeout(duplicateItem.closeTimeout)
    duplicateItem.closeTimeout = setTimeout(() => {
      closeToast({ message: duplicateItem.message, closeCallback: duplicateItem.closeCallback })
    }, duplicateItem.message.originLife)
    return
  }

  if (!messageMap[cacheKey] && message.life) {
    message.originLife = message.life
    message.startTimestamp = Date.now()
    message.life = 0
    const closeTimeout = setTimeout(() => {
      closeToast({ message, closeCallback })
    }, message.originLife)

    messageMap[cacheKey] = { message, closeCallback, closeTimeout }
  }
}
</script>

<template>
  <Toast position="top-center" unstyled :pt="{ root: 'translate-x-[-50%] z-10' }">
    <template #container="{ message, closeCallback }">
      <OverlayBadge v-if="!message.hide" :value="message.count" class="badge" :class="[message.severity]" size="small">
        <section class="alert" :data-life="cacheToast({ message, closeCallback })"
                 @mouseenter="handleMouseenter({ message, closeCallback })"
                 @mouseleave="handleMouseleave({ message, closeCallback })"
        >
          <div class="alert-icon">
            <SvgIcon :name="iconMap[message.severity]" size="16" />
          </div>
          <div class="alert-content">
            <div class="alert-header">
              <template v-if="isString(message.summary)">
                {{ message.summary }}
              </template>
              <component :is="message.summary" v-else />
            </div>
            <div v-if="message.detail" class="alert-message">
              <template v-if="isString(message.detail)">
                {{ message.detail }}
              </template>
              <component :is="message.detail" v-else />
            </div>
          </div>
          <div class="alert-close">
            <SvgIcon name="base/rx_ic_delete" size="16" class="cursor-pointer" @click="closeToast({ message, closeCallback })" />
          </div>
        </section>
      </OverlayBadge>
    </template>
  </Toast>
</template>

<style lang="scss" scoped>
.alert {
  display: flex;
  width: 360px;
  word-break: break-all;
  white-space: pre-wrap;
  margin-bottom: 20px;
  padding: var(--spacing-xl, 12px);
  align-items: flex-start;
  gap: 10px;
  border-radius: 4px;
  border: 0.5px solid var(--colors-border-border-overlay);
  background: var(--colors-background-bg-overlay);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
}

.badge.success {
  :deep(.p-badge) {
    background-color: var(--colors-text-text-success, #1cc94d);
  }

  .alert-icon {
    color: var(--colors-text-text-success, #1cc94d);
  }
}

.badge.warn {
  :deep(.p-badge) {
    background-color: var(--colors-text-text-warning, #fc9d12);
  }

  .alert-icon {
    color: var(--colors-text-text-warning, #fc9d12);
  }
}

.badge.error {
  :deep(.p-badge) {
    background-color: var(--colors-text-text-error, #f53838);
  }

  .alert-icon {
    color: var(--colors-text-text-error, #f53838);
  }
}

.badge.info {
  :deep(.p-badge) {
    background-color: var(--colors-text-text-brand, #12a3fc);
  }

  .alert-icon {
    color: var(--colors-text-text-brand, #12a3fc);
  }
}

.badge :deep(.p-badge-dot) {
  display: none;
}

.alert-content {
  flex: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;

  .alert-header {
    align-self: stretch;
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .alert-message {
    align-self: stretch;
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
    word-break: normal;
    /* 150% */
  }
}
</style>
