<script setup lang="ts">
import SkillsContent from '/@/views/mcp/skills-store/skills-content.vue'
import { getImage } from '/@/utils'
import AutoThemeImage from '/@/views/account/list/components/platform-icon.vue'
</script>

<template>
  <div class="h-full overflow-x-hidden overflow-y-auto">
    <div class="h-208px relative flex justify-center">
      <AutoThemeImage class="w-full absolute top-0" :platform-icon-dark="getImage('mcp/skills/dark.svg')" :platform-icon="getImage('mcp/skills/light.svg')" />

      <div class="flex pt-18 flex-col items-center gap-4 relative z-10">
        <AutoThemeImage class="absolute -left-12 -translate-x-100% top-1%" :platform-icon-dark="getImage('mcp/skills/dark-left.svg')" :platform-icon="getImage('mcp/skills/light-left.svg')" />
        <div class="text-8 font-700 text-[var(--colors-text-text-primary)] flex items-center gap-3 font-['Archivo']">
          <div :style="{ background: 'linear-gradient(100deg, #3FAAF6 0%, #F359DC 50%, #F28FB0 100%)' }" class="rounded-full p-1.5 size-8 flex items-center justify-center">
            <img :src="getImage('mcp/roxyagent.svg')" alt="" class="size-5">
          </div>
          {{ $t('Roxy AI Skills 商城') }}
        </div>
        <div class="text-[var(--colors-text-text-tertiary)] text-14px">
          {{ $t('专门服务于跨境电商和多账号矩阵玩家的技能合集，完美替代 RPA') }}
        </div>
        <AutoThemeImage class="absolute -right-12 translate-x-100% top-1%" :platform-icon-dark="getImage('mcp/skills/dark-right.svg')" :platform-icon="getImage('mcp/skills/light-right.svg')" />
      </div>
    </div>
    <div class=" mx-auto relative max-w-820px xl:max-w-1140px">
      <SkillsContent type="app" />
    </div>
  </div>
</template>
