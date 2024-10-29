<script setup>
import { useToast } from 'primevue/usetoast'
import { onUnmounted, ref } from 'vue'

const toast = useToast()

function show() {
  toast.add({ severity: 'success', type: 'success', summary: 'Success Message', detail: 'Message Content', group: 'headless' })
}
</script>

<template>
  <Toast position="top-center" group="headless" unstyled>
    <template #container="{ message, closeCallback }">
      <section class="alert">
        <div class="alert-icon" :class="[message.severity]">
          <SvgIcon name="base/rx_ic_check_fill" size="16" />
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
    </template>
  </Toast>
  <Button label="View" @click="show" />
</template>

<style lang="scss" scoped>
.alert {
  display: flex;
  gap: 8px;
  width: 360px;
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
