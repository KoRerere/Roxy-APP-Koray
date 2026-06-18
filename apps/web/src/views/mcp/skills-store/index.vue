<script setup lang="ts">
import SkillsContent from './skills-content.vue'
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 顶部标题栏 -->
    <div class="w-full flex flex-col px-6 py-14px border-b border-b-solid border-[var(--colors-border-border-inactive)]">
      <div class="font-['Archivo'] font-semibold text-[var(--colors-text-text-primary)] text-lg leading-30px flex justify-between">
        {{ $t('Skills 商城') }}

        <div
          v-tooltip="$t('安装你需要的 Skills，Agent 将在对话中自动识别并调用。或者通过点击「去使用」，在 Agent 对话中补充任务信息即可开始执行任务。')"
          class="text-[var(--colors-text-text-brand)] text-3 cursor-pointer"
        >
          {{ $t('如何使用 Skills?') }}
        </div>
      </div>

      <div class="leading-18px text-3 text-[var(--colors-text-text-tertiary)] flex justify-between">
        {{ $t('专门服务于跨境电商和多账号矩阵玩家的技能合集，完美替代 RPA') }}
      </div>
    </div>

    <!-- 内容区 -->
    <SkillsContent />
  </div>
</template>
