<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
</script>

<template>
  <Message closable severity="warn" class="warn-message">
    <template #icon>
      <RxSvgIcon name="base/rx_ic_warn_fill" />
    </template>
    <div class="content">
      <div class="title">
        {{ $t('您的 IP 地址已变更') }}
      </div>

      <div class="description">
        {{ $t('请注意，您访问账户的操作可能存在风险') }}
      </div>
    </div>
  </Message>
</template>

<style lang="scss" scoped>
.warn-message {
  width: 100%;

  :deep(.p-message-content) {
    align-items: flex-start;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    align-self: stretch;
  }

  .title {
    color: var(--Color-neutrals-950, #0e1214);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }

  .description {
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
    /* 150% */
  }
}
</style>
