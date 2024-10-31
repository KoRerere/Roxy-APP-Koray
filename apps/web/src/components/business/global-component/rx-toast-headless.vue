<script setup lang="ts">
import type { SvgNames } from '../../rx-icon'

const iconMap: Record<string, SvgNames> = {
  success: 'base/rx_ic_check_fill',
  warn: 'base/rx_ic_delete_fill',
  error: 'base/rx_ic_info_fill',
  info: 'base/rx_ic_warn_fill',
}

const toastRef = useTemplateRef('toast')

const messageMap: Recordable = {}

console.log('totoastRefast', toastRef)

function handleMouseenter(slotData) {
  const { message } = slotData
  if (messageMap[message.id]) {
    clearTimeout(messageMap[message.id].closeTimeout)
  }
}

function handleMouseleave(slotData) {
  const { message, closeCallback } = slotData
  console.log('handleMouseleave', slotData, messageMap)
  if (messageMap[message.id]) {
    messageMap[message.id].closeTimeout = setTimeout(() => {
      closeCallback()
      Reflect.deleteProperty(messageMap, message.id)
    }, Math.max(1000, message.originLife - (Date.now() - message.startTimestamp)))
  }
}

function cacheToast(slotData) {
  const { message, closeCallback } = slotData

  const duplicateItem = Object.values(messageMap).find((item) => {
    const { message: { id, summary, detail, severity } } = item
    return id !== message.id && summary === message.summary && detail === message.detail && severity === message.severity
  })

  if (duplicateItem) {
    duplicateItem.message.count = 1
    message.hide = true
    message.life = 1
    setTimeout(closeCallback)
    return
  }

  if (!messageMap[message.id] && message.life) {
    message.originLife = message.life
    message.startTimestamp = Date.now()
    message.life = 0
    const closeTimeout = setTimeout(() => {
      closeCallback()
      Reflect.deleteProperty(messageMap, message.id)
    }, message.originLife)

    messageMap[message.id] = { message, closeCallback, closeTimeout }
  }
}
</script>

<template>
  <Toast ref="toast" position="top-center" unstyled :pt="{ root: 'translate-x-[-50%]' }">
    <template #container="{ message, closeCallback }">
      <OverlayBadge v-if="!message.hide" :value="message.count" class="badge" :class="[message.severity]">
        <section
          class="alert"
          :data-life="cacheToast({ message, closeCallback })"
          @mouseenter="handleMouseenter({ message, closeCallback })"
          @mouseleave="handleMouseleave({ message, closeCallback })"
        >
          <div class="alert-icon" :class="[message.severity]">
            <SvgIcon :name="iconMap[message.severity]" size="16" />
          </div>
          <div class="alert-content">
            <div class="alert-header">
              {{ message.summary }}
            </div>
            <div class="alert-message">
              {{ message.detail }}
            </div>
          </div>
          <div class="alert-close">
            <SvgIcon name="base/rx_ic_delete" size="16" class="cursor-pointer" @click="closeCallback" />
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
  margin-bottom: 20px;
  padding: var(--spacing-xl, 12px);
  align-items: flex-start;
  gap: 10px;
  border-radius: 4px;
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Colors-Background-bg-body, #fff);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
}

.alert-icon {
  &.success {
    color: var(--Colors-Text-text-success, #1cc94d);
  }
  &.warn {
    color: var(--Colors-Text-text-warning, #fc9d12);
  }
  &.error {
    color: var(--Colors-Text-text-error, #f53838);
  }
  &.info {
    color: var(--Colors-Text-text-info, #12a3fc);
  }
}
.badge {
  &.success :deep(.p-badge) {
    background-color: var(--Colors-Text-text-success, #1cc94d);
  }
  &.warn :deep(.p-badge) {
    background-color: var(--Colors-Text-text-warning, #fc9d12);
  }
  &.error :deep(.p-badge) {
    background-color: var(--Colors-Text-text-error, #f53838);
  }
  &.info :deep(.p-badge) {
    background-color: var(--Colors-Text-text-info, #12a3fc);
  }

  :deep(.p-badge-dot) {
    display: none;
  }
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
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .alert-message {
    align-self: stretch;
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px; /* 150% */
  }
}
</style>
