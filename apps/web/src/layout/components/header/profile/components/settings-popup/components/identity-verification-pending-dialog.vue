<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { setIdentityPollingScope, type IdentityVerificationDetails } from '../identity-verification'

defineProps<{
  details?: IdentityVerificationDetails
  onClose: () => void
}>()

onMounted(() => {
  setIdentityPollingScope('dialog', true)
})

onUnmounted(() => {
  setIdentityPollingScope('dialog', false)
})
</script>

<template>
  <div class="identity-pending-modal">
    <div class="identity-pending-modal__header">
      <span class="identity-pending-modal__header-title">{{ $t('实名认证') }}</span>
      <RxButton text severity="secondary" size="sm" icon="base/rx_ic_delete" @click="onClose" />
    </div>

    <div class="identity-pending">
      <div class="identity-pending__status">
        <RxSvgIcon
          name="base/rx_ic_info_fill"
          class="identity-pending__icon"
          color="var(--colors-icon-icon-warning, #FD9F12)"
        />
        <div class="identity-pending__status-text">
          <p class="identity-pending__title">
            {{ $t('实名认证审核中') }}
          </p>
          <p class="identity-pending__desc">
            {{ $t('您的资料已提交，预计10分钟内完成，请稍后查看审核进度') }}
          </p>
        </div>
      </div>

      <div class="identity-pending__divider" />

      <div class="identity-pending__steps">
        <div class="identity-pending__step identity-pending__step--done">
          <RxSvgIcon name="base/rx_ic_edit" class="identity-pending__step-icon" color="var(--colors-icon-icon-inactive)" />
          <span>{{ $t('提交资料') }}</span>
        </div>
        <RxSvgIcon name="base/rx_ic_play" class="identity-pending__step-arrow" color="var(--colors-icon-icon-brand)" />
        <div class="identity-pending__step identity-pending__step--active">
          <RxSvgIcon name="base/rx_ic_progress_bar" class="identity-pending__step-icon identity-pending__step-icon--progress" color="var(--colors-icon-icon-brand)" />
          <span>{{ $t('审核中') }}</span>
        </div>
        <RxSvgIcon name="base/rx_ic_play" class="identity-pending__step-arrow" color="var(--colors-icon-icon-inactive)" />
        <div class="identity-pending__step">
          <RxSvgIcon name="base/rx_ic_check_line" class="identity-pending__step-icon" color="var(--colors-icon-icon-inactive)" />
          <span>{{ $t('认证完成') }}</span>
        </div>
      </div>

      <div v-if="details" class="identity-pending__card">
        <template v-if="details.type === 'personal'">
          <div class="identity-pending__row">
            <span class="identity-pending__label">{{ $t('姓名：') }}</span>
            <span class="identity-pending__value">{{ details.maskedName }}</span>
          </div>
          <div class="identity-pending__row">
            <span class="identity-pending__label">{{ $t('身份证号：') }}</span>
            <span class="identity-pending__value">{{ details.maskedIdNumber }}</span>
          </div>
        </template>

        <template v-else>
          <div class="identity-pending__row">
            <span class="identity-pending__label identity-pending__label--wide">{{ $t('企业名称：') }}</span>
            <span class="identity-pending__value">{{ details.companyName }}</span>
          </div>
          <div class="identity-pending__row">
            <span class="identity-pending__label identity-pending__label--wide">{{ $t('社会统一信用代码：') }}</span>
            <span class="identity-pending__value">{{ details.creditCode }}</span>
          </div>
          <div class="identity-pending__row">
            <span class="identity-pending__label identity-pending__label--wide">{{ $t('法人姓名：') }}</span>
            <span class="identity-pending__value">{{ details.maskedLegalName }}</span>
          </div>
          <div class="identity-pending__row">
            <span class="identity-pending__label identity-pending__label--wide">{{ $t('身份证号：') }}</span>
            <span class="identity-pending__value">{{ details.maskedIdNumber }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.identity-pending-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-height: 100%;
  padding: 16px 24px 24px;
  overflow: hidden;
  border-radius: inherit;
  background:
    radial-gradient(ellipse 140% 80% at 50% -10%, rgba(253, 37, 17, 0.12) 0%, rgba(253, 37, 17, 0) 30%),
    linear-gradient(200deg, rgba(243, 89, 220, 0.16) 4%, rgba(243, 89, 220, 0) 37%),
    linear-gradient(163deg, rgba(253, 166, 17, 0.12) 7%, rgba(253, 166, 17, 0) 36%),
    var(--colors-background-bg-page, #fff);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__header-title {
    font-size: 16px;
    font-weight: 600;
    line-height: normal;
    color: var(--colors-text-text-primary);
  }
}

.identity-pending {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;

  &__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  &__icon {
    width: 48px;
    height: 48px;
  }

  &__status-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    width: 100%;
    text-align: center;
  }

  &__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
    color: var(--colors-text-text-primary);
    letter-spacing: -0.2px;
  }

  &__desc {
    margin: 0;
    font-size: 12px;
    line-height: 16px;
    color: var(--colors-text-text-tertiary, #575d60);
    letter-spacing: -0.12px;
  }

  &__divider {
    width: 100%;
    height: 0;
    border-top: 1px dashed var(--colors-border-border-subtle, #c7d1d6);
  }

  &__steps {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  &__step {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 12px;
    line-height: 17px;
    color: var(--colors-text-text-inactive, #7d8387);
    letter-spacing: -0.12px;

    &--active {
      font-size: 13px;
      font-weight: 600;
      line-height: 18px;
      color: var(--colors-text-text-brand, #11a3fd);
      letter-spacing: -0.13px;
    }
  }

  &__step-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;

    &--progress {
      width: 14px;
      height: 14px;
    }
  }

  &__step-arrow {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  &__card {
    width: 100%;
    padding: 16px;
    border-radius: 6px;
    background: var(--colors-background-bg-block, #f1f5f8);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__row {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: -0.12px;
  }

  &__label {
    flex-shrink: 0;
    width: 70px;
    color: var(--colors-text-text-tertiary, #575d60);

    &--wide {
      width: 110px;
    }
  }

  &__value {
    font-weight: 600;
    color: var(--colors-text-text-primary);
    word-break: break-all;
  }
}
</style>
