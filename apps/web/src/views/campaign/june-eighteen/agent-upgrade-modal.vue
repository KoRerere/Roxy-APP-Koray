<script setup lang="ts">
import { getImage } from '/@/utils'
import { useThemeStore } from '/@/stores/theme'
import { useI18n } from 'vue-i18n'

const { agentSupported } = defineProps<{
  agentSupported: boolean
}>()

const emit = defineEmits(['close', 'confirm', 'neverRemind'])
const { locale } = useI18n()
const themeStore = useThemeStore()

const posterSrc = computed(() => {
  const language = locale.value.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  return getImage(`campaing/agent-upgrade/poster-${language}.svg`)
})

function onConfirm() {
  emit('confirm')
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-1.5 select-none">
    <div class="flex self-end gap-1.5">
      <RxButton
        class="agent-upgrade-modal__never-remind"
        :class="{ 'agent-upgrade-modal__never-remind--dark': themeStore.isDarkTheme }"
        size="xxs"
        severity="secondary"
        :label="$t('不再提醒')"
        @click="$emit('neverRemind')"
      />
      <RxButton size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="$emit('close')" />
    </div>

    <div class="agent-upgrade-modal__poster">
      <img draggable="false" class="agent-upgrade-modal__image" :src="posterSrc" alt="Roxy AI Agent">
      <div class="agent-upgrade-modal__actions">
        <RxButton
          class="agent-upgrade-modal__button flex-row-reverse !border-none"
          size="lg"
          icon="base/rx_ic_chevron_right"
          :label="agentSupported ? $t('立即体验') : $t('立即升级')"
          @click="onConfirm"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.agent-upgrade-modal__poster {
  position: relative;
  width: 640px;
  height: 460px;
  overflow: hidden;
  border-radius: 20px;
}

.agent-upgrade-modal__never-remind {
  min-width: auto;
  padding: 6px 8px;
  border: 0 !important;
  border-radius: 4px;
  color: color-mix(in srgb, var(--colors-text-text-primary, #111213) 60%, transparent) !important;
  background: var(--colors-background-bg-blur, rgba(255, 255, 255, 0.6)) !important;
  box-shadow: none;
  font-family: Inter, sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;

  &:not(:disabled):hover {
    border: 0 !important;
    color: color-mix(in srgb, var(--colors-text-text-primary, #111213) 100%, transparent) !important;
    background: #fff !important;
  }
}

.agent-upgrade-modal__never-remind--dark {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;

  &:not(:disabled):hover {
    border: 0 !important;
    color: var(--colors-text-text-primary, #fafafa) !important;
    background: transparent !important;
    box-shadow: none !important;
  }
}

.agent-upgrade-modal__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

.agent-upgrade-modal__actions {
  position: absolute;
  z-index: 2;
  top: 392px;
  right: 0;
  left: 0;
  display: flex;
  justify-content: center;
}

.agent-upgrade-modal__actions :deep(.agent-upgrade-modal__button) {
  min-width: 124px;
  font-size: 16px;
  line-height: 24px;

  svg {
    width: 20px;
    height: 20px;
  }
}
</style>
