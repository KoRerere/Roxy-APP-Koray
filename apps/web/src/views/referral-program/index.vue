<script setup lang="tsx">
import { useToast } from 'primevue/usetoast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { copyText } from '/@/utils/'
import { RxSvgIcon } from '/@/components/rx-icon/'

const toast = useToast()
const referralLink = ref('https://roxybrowser.com/invite?code=13122341233')

async function onCopy() {
  copyText(apiConfig.value.apiKey)
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('复制成功'), life: 2500 })
}

onBeforeMount(() => {
})
</script>

<template>
  <div class="flex flex-col w-full h-full referral-program">
    <ViewsHeader class="referral-program-header" :title="($route.meta.title as string)" />
    <div class="referral-program-body">
      <div class="row">
        <div class="title">{{ $t('推广计划介绍：') }}</div>
        <div class="referral-program-illustrate-content">{{ $t('通过邀请用户注册我们产品，您将在产品内获得权益与激励。激励的详情将和付费计划一起推出，敬请期待。') }}
        </div>
      </div>
      <div class="row">
        <div class="steps">
          <div class="step-item">
            <RxSvgIcon name="referral-program/copy-link" class="step-icon" />
            <div class="step-text">{{ $t('复制链接') }}</div>
          </div>
          <div class="step-item">
            <RxSvgIcon name="referral-program/invite-user" class="step-icon" />
            <div class="step-text">{{ $t('邀请用户') }}</div>
          </div>
          <div class="step-item">
            <RxSvgIcon name="referral-program/invite-user" class="step-icon" />
            <div class="step-text">{{ $t('激励') }}</div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="title">{{ $t('你的邀请链接：') }}</div>
        <div class="referral-link">
          <div class="flex items-center justify-between">
            <div class="referral-link-value">
              {{ referralLink }}
            </div>
            <RxButton severity="secondary" text size="xxs" icon="base/rx_ic_copy" :label="$t('复制')" @click="onCopy" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.referral-program {
  &-header {
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-body {
    width: 580px;
    margin: 0 auto;
    display: flex;
    padding: var(--spacing-4xl, 24px) 0px;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--oversize-spacing-2rem, 12px);
    align-self: stretch;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;
  }

  .referral-link {
    width: 100%;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-xl, 12px);
    gap: var(--spacing-xl, 12px);
    border-radius: var(--radius-md, 6px);
    border: 1px solid var(--Color-neutrals-900, #171c1f);
    background: var(--Color-neutrals-800, #252a2e);

    &-value {
      color: #fff;
      font-family: 'JetBrains Mono';
      font-size: 14px;
      font-weight: 500;
      line-height: 16px;
    }
  }

  .title {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;
  }

  &-illustrate {
    display: flex;
    flex-direction: column;

    &-content {
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }

  .steps {
    width: 100%;
    display: flex;
    justify-content: space-between;

    .step-item {
      display: flex;
      align-items: center;

      .step-icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
      }

      .step-text {
        color: var(--Colors-Text-text-primary, #171C1F);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }
    }
  }
}
</style>
