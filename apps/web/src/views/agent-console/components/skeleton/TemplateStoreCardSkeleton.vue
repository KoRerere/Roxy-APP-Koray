<script setup lang="ts">
withDefaults(defineProps<{
  count?: number
}>(), {
  count: 6,
})
</script>

<template>
  <template v-for="index in count" :key="index">
    <div
      class="template-store-card-skeleton"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">{{ $t('加载中...') }}</span>

      <div class="template-store-card-skeleton__header" aria-hidden="true">
        <div class="template-store-card-skeleton__identity">
          <Skeleton width="44px" height="44px" border-radius="10px" />
          <Skeleton width="60%" height="20px" border-radius="6px" />
        </div>
        <Skeleton width="42px" height="20px" border-radius="4px" />
      </div>

      <div class="template-store-card-skeleton__divider" aria-hidden="true" />

      <div class="template-store-card-skeleton__tags" aria-hidden="true">
        <Skeleton width="52px" height="24px" border-radius="8px" />
        <Skeleton width="68px" height="24px" border-radius="8px" />
        <Skeleton width="44px" height="24px" border-radius="8px" />
      </div>

      <div class="template-store-card-skeleton__description" aria-hidden="true">
        <Skeleton width="100%" height="14px" border-radius="4px" />
        <Skeleton width="100%" height="14px" border-radius="4px" />
      </div>

      <div class="template-store-card-skeleton__actions" aria-hidden="true">
        <Skeleton width="86px" height="20px" border-radius="4px" />
        <div class="template-store-card-skeleton__action-buttons">
          <Skeleton height="32px" border-radius="10px" />
          <Skeleton height="32px" border-radius="10px" />
        </div>
      </div>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.template-store-card-skeleton {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 224px;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-tertiary);
  overflow: hidden;
}

.template-store-card-skeleton__header {
  display: flex;
  width: 100%;
  height: 44px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.template-store-card-skeleton__identity {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
}

.template-store-card-skeleton__actions {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 40px;

  > :deep(.p-skeleton) {
    flex: 0 0 auto;
  }

  @media (max-width: 520px) {
    gap: 12px;
  }
}

.template-store-card-skeleton__action-buttons {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;

  :deep(.p-skeleton) {
    min-width: 0;
    flex: 1 1 0;
  }
}

.template-store-card-skeleton__divider {
  width: 100%;
  height: 0;
  flex: 0 0 0;
  border-top: 1px dashed var(--color-border-secondary);
}

.template-store-card-skeleton__tags {
  display: flex;
  width: 100%;
  height: 24px;
  min-width: 0;
  flex: 0 0 24px;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.template-store-card-skeleton__description {
  display: flex;
  width: 100%;
  height: 40px;
  flex: 0 0 40px;
  flex-direction: column;
  justify-content: flex-start;
  gap: 6px;
}
</style>
