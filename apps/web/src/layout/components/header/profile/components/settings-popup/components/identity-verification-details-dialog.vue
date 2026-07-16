<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import type { IdentityVerificationDetails } from '../identity-verification'

defineProps<{
  details: IdentityVerificationDetails
  onClose: () => void
}>()
</script>

<template>
  <div class="identity-details-modal">
    <div class="identity-details-modal__header">
      <span class="identity-details-modal__header-title">{{ $t('实名认证') }}</span>
      <RxButton text severity="secondary" size="sm" icon="base/rx_ic_delete" @click="onClose" />
    </div>

    <div class="identity-details">
      <div class="identity-details__header">
        <RxSvgIcon name="status/rx_ic_check_fill" class="identity-details__icon" color="var(--colors-icon-icon-success)" />
        <p class="identity-details__title">
          {{ $t('您已通过实名认证') }}
        </p>
      </div>

      <div class="identity-details__card">
        <template v-if="details.type === 'personal'">
          <div class="identity-details__row">
            <span class="identity-details__label">{{ $t('姓名：') }}</span>
            <span class="identity-details__value">{{ details.maskedName }}</span>
          </div>
          <div class="identity-details__row">
            <span class="identity-details__label">{{ $t('身份证号：') }}</span>
            <span class="identity-details__value">{{ details.maskedIdNumber }}</span>
          </div>
        </template>

        <template v-else>
          <div class="identity-details__row">
            <span class="identity-details__label identity-details__label--wide">{{ $t('企业名称：') }}</span>
            <span class="identity-details__value">{{ details.companyName }}</span>
          </div>
          <div class="identity-details__row">
            <span class="identity-details__label identity-details__label--wide">{{ $t('社会统一信用代码：') }}</span>
            <span class="identity-details__value">{{ details.creditCode }}</span>
          </div>
          <div class="identity-details__row">
            <span class="identity-details__label identity-details__label--wide">{{ $t('法人姓名：') }}</span>
            <span class="identity-details__value">{{ details.maskedLegalName }}</span>
          </div>
          <div class="identity-details__row">
            <span class="identity-details__label identity-details__label--wide">{{ $t('身份证号：') }}</span>
            <span class="identity-details__value">{{ details.maskedIdNumber }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.identity-details-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-height: 100%;
  padding: 16px 24px 24px;
  overflow: hidden;
  border-radius: inherit;
  background:
    radial-gradient(ellipse 140% 80% at 50% -10%, rgba(17, 163, 253, 0.2) 0%, rgba(17, 163, 253, 0) 58%),
    linear-gradient(199deg, rgba(243, 89, 220, 0.16) 4%, rgba(243, 89, 220, 0) 37%),
    linear-gradient(164deg, rgba(17, 253, 151, 0.12) 7%, rgba(17, 253, 151, 0) 36%),
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

.identity-details {
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;

  &__header {
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

  &__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    line-height: 28px;
    text-align: center;
    color: var(--colors-text-text-primary);
    letter-spacing: -0.2px;
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

    &--top {
      align-items: flex-start;
    }
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

  &__license {
    width: 160px;
    height: 107px;
    border-radius: 6px;
    object-fit: cover;
  }
}
</style>
