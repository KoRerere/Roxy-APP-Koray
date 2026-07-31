<script setup lang="ts">
import { h } from 'vue'
import ProxyFilterDrawerContent from './drawer-content.vue'
import { useDrawer } from '/@/hooks/useDrawer'
import type { useProxyFilter } from './useProxyFilter'

interface Props {
  title?: string
  filter: ReturnType<typeof useProxyFilter>
}

const { title = $t('筛选代理'), filter } = defineProps<Props>()

const { showDrawer, hideDrawer } = useDrawer()

/** 打开筛选抽屉 */
function openFilterDrawer() {
  filter.openDrawer()
  showDrawer({
    title,
    dismissable: false,
    slots: {
      container: () => h(ProxyFilterDrawerContent, {
        filter,
        onApply: () => {
          filter.apply()
          hideDrawer()
        },
      }),
    },
  })
}
</script>

<template>
  <div class="proxy-filter">
    <RxButton size="xxs" variant="outlined" :severity="filter.hasActiveFilters.value ? 'primary' : 'secondary'" @click.stop="openFilterDrawer">
      <SvgIcon name="base/rx_ic_filter" :size="14" />
      <span>{{ $t('筛选') }}</span>
      <span v-if="filter.activeFilterCount.value > 0" class="proxy-filter__badge">{{ filter.activeFilterCount.value }}</span>
    </RxButton>
  </div>
</template>

<style lang="scss" scoped>
.proxy-filter {
  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    border-radius: 9999px;
    background: var(--colors-background-bg-brand);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }
}
</style>
