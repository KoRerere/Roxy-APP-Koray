<script setup lang="ts">
import { useRemarkDisplay } from '/@/views/agent/shop/hooks/useRemarkDisplay'
import type { RemarkColumnCache } from '/@/views/agent/shop/hooks/useRemarkDisplay'

interface Props {
  /** 备注列配置，_cache.extend 控制展开图标与单元格正文 */
  column: {
    title: string
    _cache: RemarkColumnCache
  }
}

const { column } = defineProps<Props>()
const { toggleRemarkDisplayStatus } = useRemarkDisplay()
</script>

<template>
  <div class="flex items-center gap-2 text-3 font-600 leading-4 text-[var(--colors-text-text-primary)]">
    <span>{{ column.title }}</span>
    <SvgIcon v-tooltip.top="{ value: column._cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]"
             :name="column._cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" @click.stop="toggleRemarkDisplayStatus(column._cache)"
    />
  </div>
</template>
