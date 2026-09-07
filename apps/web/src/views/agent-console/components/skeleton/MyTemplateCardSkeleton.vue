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
      class="my-template-card-skeleton"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">{{ $t('加载中...') }}</span>

      <div class="my-template-card-skeleton__header" aria-hidden="true">
        <div class="my-template-card-skeleton__identity">
          <Skeleton width="44px" height="44px" border-radius="7px" />
          <div class="my-template-card-skeleton__copy">
            <Skeleton width="58%" height="20px" border-radius="6px" />
            <Skeleton width="33px" height="16px" border-radius="4px" />
          </div>
        </div>
      </div>

      <div class="my-template-card-skeleton__divider" aria-hidden="true" />

      <div class="my-template-card-skeleton__tags" aria-hidden="true">
        <Skeleton width="39px" height="24px" border-radius="8px" />
        <Skeleton width="40px" height="24px" border-radius="8px" />
        <Skeleton width="55px" height="24px" border-radius="8px" />
      </div>

      <div class="my-template-card-skeleton__description" aria-hidden="true">
        <Skeleton width="94%" height="14px" border-radius="4px" />
        <Skeleton width="76%" height="14px" border-radius="4px" />
      </div>

      <div class="my-template-card-skeleton__actions" aria-hidden="true">
        <Skeleton width="32px" height="32px" border-radius="10px" />
        <div class="my-template-card-skeleton__primary-actions">
          <Skeleton height="32px" border-radius="10px" />
          <Skeleton height="32px" border-radius="10px" />
        </div>
      </div>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.my-template-card-skeleton {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 212px;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border-primary);
  border-radius: 16px;
  background: var(--color-bg-tertiary);
  overflow: hidden;
}

.my-template-card-skeleton__header {
  display: flex;
  width: 100%;
  height: 44px;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.my-template-card-skeleton__identity {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
}

.my-template-card-skeleton__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.my-template-card-skeleton__tags {
  display: flex;
  width: 100%;
  height: 24px;
  align-items: center;
  gap: 4px;
}

.my-template-card-skeleton__description {
  display: flex;
  width: 100%;
  height: 40px;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.my-template-card-skeleton__divider {
  width: 100%;
  height: 0;
  border-top: 1px dashed var(--color-border-secondary);
}

.my-template-card-skeleton__actions {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.my-template-card-skeleton__primary-actions {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;

  :deep(.p-skeleton) {
    flex: 1;
  }
}
</style>
