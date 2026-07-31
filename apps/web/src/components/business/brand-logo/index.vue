<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'
import { useSimpleLocale } from '/@/stores/locale'

const { path = '/' } = defineProps<{
  path?: string
}>()

const { isDarkTheme } = storeToRefs(useThemeStore())
const { isZh } = storeToRefs(useSimpleLocale())
const { getOfficialWebsite } = useSimpleLocale()
</script>

<template>
  <a class="brand-logo" target="_blank" rel="noopener noreferrer" :href="getOfficialWebsite(path)">
    <template v-if="isZh">
      <SvgIcon name="base/chinese-logo" width="164" height="44" :color="isDarkTheme ? '#fff' : '#000'" />
    </template>
    <template v-else>
      <SvgIcon name="base/logo" size="36" />
      <div class="tt-primary font-[Archivo] text-4.5 font-bold leading-5">
        {{ $t('Roxy浏览器') }}
      </div>
    </template>
  </a>
</template>

<style scoped lang="scss">
.brand-logo {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: white;
  z-index: 10;

  @media (max-width: 768px) {
    gap: 6px;
  }
}
</style>
