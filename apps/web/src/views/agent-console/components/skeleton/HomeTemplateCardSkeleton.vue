<script setup lang="ts">
withDefaults(defineProps<{
  count?: number
}>(), {
  count: 8,
})
</script>

<template>
  <template v-for="index in count" :key="index">
    <article
      class="home-template-card-skeleton"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">{{ $t('加载中...') }}</span>

      <div class="home-template-card-skeleton__main" aria-hidden="true">
        <Skeleton width="44px" height="44px" border-radius="10px" />
        <div class="home-template-card-skeleton__copy">
          <Skeleton width="56%" height="18px" border-radius="6px" />
          <Skeleton width="84%" height="14px" border-radius="4px" />
        </div>
      </div>

      <div class="home-template-card-skeleton__footer" aria-hidden="true">
        <div class="home-template-card-skeleton__tags">
          <Skeleton width="44px" height="24px" border-radius="8px" />
          <Skeleton width="58px" height="24px" border-radius="8px" />
          <Skeleton width="52px" height="24px" border-radius="8px" />
        </div>
        <Skeleton width="38px" height="24px" border-radius="999px" />
      </div>
    </article>
  </template>
</template>

<style lang="scss" scoped>
.home-template-card-skeleton {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 110px;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 13px 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.home-template-card-skeleton__main {
  display: flex;
  width: 100%;
  height: 44px;
  min-width: 0;
  flex: 0 0 44px;
  align-items: center;
  gap: 8px;
}

.home-template-card-skeleton__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.home-template-card-skeleton__footer {
  display: flex;
  width: 100%;
  height: 24px;
  min-width: 0;
  flex: 0 0 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.home-template-card-skeleton__tags {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}
</style>
