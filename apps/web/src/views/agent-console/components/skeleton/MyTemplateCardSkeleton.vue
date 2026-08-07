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
            <Skeleton width="86%" height="14px" border-radius="4px" />
          </div>
        </div>
        <Skeleton width="64px" height="24px" border-radius="8px" />
      </div>

      <div class="my-template-card-skeleton__divider" aria-hidden="true" />

      <div class="my-template-card-skeleton__actions" aria-hidden="true">
        <Skeleton width="34px" height="34px" border-radius="10px" />
        <div class="my-template-card-skeleton__primary-actions">
          <Skeleton width="80px" height="32px" border-radius="10px" />
          <Skeleton width="96px" height="32px" border-radius="10px" />
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
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  background: var(--color-bg-primary);
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
  gap: 8px;
}

.my-template-card-skeleton__primary-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
</style>
