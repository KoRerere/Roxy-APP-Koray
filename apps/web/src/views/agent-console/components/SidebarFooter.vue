<script setup lang="ts">
import { usePermission } from '/@/hooks/usePermission'
import { useUserStore } from '/@/stores/user'
import { useBuyPoints } from './buy-points/useBuyPoints'

defineProps<{
  updateAvailable?: boolean
  updateTitle?: string
  updateLabel?: string
  updateDisabled?: boolean
}>()

const emit = defineEmits<{
  feedback: []
  update: []
}>()

const userStore = useUserStore()
const { userPayInfo } = storeToRefs(userStore)
const { buyPoints } = useBuyPoints()
const { check } = usePermission()
const creditBalance = computed(() => userPayInfo.value?.points ?? 0)
const canAccessCostCenter = computed(() => check('Cost_Center_all'))

function handleCreditsNavigate(event: MouseEvent, navigate: (event?: MouseEvent) => void) {
  if (!canAccessCostCenter.value) {
    event.preventDefault()
    return
  }

  navigate(event)
}

async function handleTopUp() {
  if (!canAccessCostCenter.value)
    return

  const success = await buyPoints()
  if (success)
    await userStore.getUserPayInfo()
}
</script>

<template>
  <div class="sidebar-footer">
    <button class="feedback-button" type="button" @click="emit('feedback')">
      <SvgIcon name="roxy-agent/rx-ic-contact-us" size="18" />
      <span>{{ $t('帮助与反馈') }}</span>
    </button>

    <RouterLink v-slot="{ href, isActive, navigate }" custom :to="{ name: 'agent-console-roxyclaw' }">
      <div class="footer-actions" :class="{ active: isActive }">
        <a
          :href="href"
          class="settings-button"
          @click="navigate"
        >
          <SvgIcon name="roxy-agent/rx-ic-settings" size="18" />
          <span>{{ $t('设置') }}</span>
        </a>
        <button
          v-if="updateAvailable"
          class="footer-update"
          type="button"
          :disabled="updateDisabled"
          :title="updateTitle || $t('更新 AI Agent')"
          @click.stop="emit('update')"
        >
          {{ updateLabel || $t('更新') }}
        </button>
      </div>
    </RouterLink>

    <RouterLink v-slot="{ href, isExactActive, navigate }" custom :to="{ name: 'agent-console-credits' }">
      <div
        class="credits-card"
        :class="{ active: isExactActive, disabled: !canAccessCostCenter }"
      >
        <a
          :href="canAccessCostCenter ? href : undefined"
          :aria-disabled="!canAccessCostCenter"
          class="credits-summary"
          @click="handleCreditsNavigate($event, navigate)"
        >
          <div class="credits-label">
            <SvgIcon name="roxy-agent/rx-ic-credits" size="18" />
            <span>{{ $t('积分') }}</span>
          </div>
          <div class="credits-balance">
            <span>{{ creditBalance }}</span>
          </div>
        </a>
        <button v-if="canAccessCostCenter" type="button" class="credits-recharge" @click.stop="handleTopUp">
          <span class="credits-recharge__inner">
            <span class="credits-recharge__text">{{ $t('充值') }}</span>
          </span>
        </button>
      </div>
    </RouterLink>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 16px;
}

.credits-card,
.feedback-button,
.settings-button {
  display: flex;
  width: 100%;
  border: 0;
  text-decoration: none;
}

.feedback-button {
  height: 36px;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 10px;
  color: var(--color-text-primary);
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--color-border-primary-inverse);
    outline-offset: 2px;
  }
}

.credits-card {
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  font-size: 14px;
  line-height: 20px;

  &.disabled {
    .credits-summary {
      cursor: default;
    }
  }
}

.credits-summary {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.credits-label,
.credits-balance {
  display: flex;
  align-items: center;
}

.credits-label {
  min-width: 0;
  gap: 8px;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.svg) {
    color: currentColor;
  }
}

.credits-balance {
  flex: 0 0 auto;
  white-space: nowrap;
}

.credits-recharge {
  display: inline-flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--agent-gradient) border-box;
  font: inherit;
  cursor: pointer;
  overflow: hidden;

  &:focus-visible {
    outline: 2px solid var(--color-border-primary-hover);
    outline-offset: 2px;
  }
}

.credits-recharge__inner {
  display: inline-flex;
  width: 100%;
  min-height: 29px;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  border-radius: 6.5px;
  background: var(--color-bg-primary);
}

.credits-recharge:hover .credits-recharge__inner {
  background: var(--color-bg-secondary-hover);
}

.credits-recharge__text {
  color: var(--color-text-primary);
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.footer-actions {
  display: flex;
  height: 36px;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
  border-radius: 10px;

  &:hover,
  &.active {
    background: var(--color-bg-tertiary-hover);
  }
}

.settings-button {
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  height: 100%;
  gap: 8px;
  padding: 0;
  border-radius: 0;
  color: var(--color-text-primary);
  background: transparent;
  font-size: 14px;

  .footer-actions.active & {
    color: var(--color-text-primary);
    font-weight: 500;
  }
}

.footer-update {
  display: inline-flex;
  height: 20px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border: 0;
  border-radius: 21px;
  color: #fcfcfc;
  background: #ee46bc;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    opacity: 0.72;
    cursor: default;
  }
}
</style>
