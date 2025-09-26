<script setup lang="ts">
import { $t } from "/@/locales";

interface Disk {
  fs: string
  mount: string
  type: string
  rw: boolean
  size: number
  available: number
  used: number
  use: number
}

const { disk } = defineProps<{
  disk: Disk,
  data: any,
  softConfig: any,
}>()

const browserCacheSize = ref()

const used = computed(() => `${bytesToGB(disk.used ?? 0)}GB`)
const size = computed(() => `${bytesToGB(disk.size ?? 0)}GB`)
const available = computed(() => `${bytesToGB(disk.available ?? 0)}GB`)
const percent = computed(() => `${disk.use ?? 0}%`)
const roxyCache = computed(() => {
  return {
    size: `${bytesToGB(browserCacheSize.value ?? 0)}GB`,
    percent: `${Math.floor(browserCacheSize.value / disk.used * 100) / 100}%`
  }
})
const percentBg = computed(() => {
  const limit = Number(size.value.replace('GB', '')) - Number(used.value.replace('GB', '')) < 2
  if (limit) {
    return 'var(--colors-background-bg-error)'
  } else if (disk.use > 80) {
    return 'var(--colors-icon-icon-warning)'
  }
  return 'var(--colors-background-bg-brand)'
})
const legend = computed(() => {
  return [
    {
      text: $t('Roxy 缓存 ({value})', { value: roxyCache.value.size }),
      style: { background: percentBg.value }
    },
    {
      text: $t('已使用 ({value})', { value: used.value }),
      style: { background: percentBg.value, opacity: 0.3 }
    },
    {
      text: $t('剩余可用 ({value})', { value: available.value }),
      style: { background: 'var(--pattern-sidenav-metrics-progress)' }
    }
  ]
})

onMounted(() => {
  getBrowserCacheSize()
})

async function getBrowserCacheSize() {
  if (browserCacheSize.value !== undefined) return
  const size = await electronAPI.send("app:getBrowserCacheSize")
  browserCacheSize.value = size
}

function bytesToGB(bytes: number, fractionDigits = 2) {
  if (!bytes || isNaN(bytes)) return 0;
  return (bytes / (1024 ** 3)).toFixed(fractionDigits);
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="title">{{ $t('所在磁盘使用情况') }}</div>
    <div class="flex items-center gap-2">
      <div class="relative w-full h-4 rounded overflow-hidden progress"></div>
      <div class="shrink-0">{{ used }} / {{ size }}</div>
    </div>
    <div class="flex justify-between items-center text">
      <div class="flex items-center gap-2">
        <div v-for="item in legend" :key="item.text" class="flex items-center gap-1">
          <div class="w-3 h-3 rounded-sm" :style="item.style"></div>
          <div>{{ item.text }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary, #B2B6B8);
  font-family: Inter;
  font-size: 14px;
  font-weight: 500;
  line-height: normal;
  line-height: var(--Line-Height-text-xs, 20px);
}

.progress {
  background: var(--pattern-sidenav-metrics-progress);

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: v-bind(percent);
    height: 100%;
    background: v-bind(percentBg);
    opacity: 0.3;
  }

  &::after {
    width: v-bind('roxyCache.percent');
    opacity: 1;
    z-index: 1;
  }
}

.text {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 16px;
}
</style>
