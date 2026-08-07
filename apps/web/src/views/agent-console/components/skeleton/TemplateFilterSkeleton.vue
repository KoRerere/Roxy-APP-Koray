<script setup lang="ts">
const FILTER_GROUPS = [
  { titleWidth: '56px', pillWidths: ['48px', '72px', '60px', '84px', '56px'] },
  { titleWidth: '72px', pillWidths: ['48px', '64px', '80px', '56px'] },
] as const
</script>

<template>
  <div
    class="template-filter-skeleton"
    role="status"
    aria-busy="true"
  >
    <span class="sr-only">{{ $t('加载中...') }}</span>

    <section
      v-for="(group, groupIndex) in FILTER_GROUPS"
      :key="groupIndex"
      class="template-filter-skeleton__group"
      aria-hidden="true"
    >
      <Skeleton
        class="template-filter-skeleton__title"
        :width="group.titleWidth"
        height="14px"
        border-radius="4px"
      />
      <div class="template-filter-skeleton__pills">
        <Skeleton
          v-for="(pillWidth, pillIndex) in group.pillWidths"
          :key="pillIndex"
          :width="pillWidth"
          height="28px"
          border-radius="999px"
        />
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.template-filter-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.template-filter-skeleton__group {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 16px;
}

.template-filter-skeleton__title {
  flex: 0 0 auto;
  margin-top: 7px;
}

.template-filter-skeleton__pills {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
