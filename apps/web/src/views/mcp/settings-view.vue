<script setup lang="ts">
import McpSettings from './settings/mcp-settings.vue'
import SkillsSettings from './settings/skills-settings.vue'

type SettingsTab = 'mcp' | 'skills'

const activeTab = ref<SettingsTab>('mcp')

const tabs = [
  { key: 'mcp' as const, label: 'MCP' },
  { key: 'skills' as const, label: 'Skills' },
]
</script>

<template>
  <div class="h-full flex flex-col rounded-4 bg-[var(--colors-background-bg-page)] pt-15">
    <!-- 顶部标题栏 -->
    <div class="w-full h-15 flex items-center px-6 border border-b-solid border-[var(--colors-border-border-inactive)] absolute top-0 left-0">
      <div class="font-['Inter'] font-semibold text-[var(--colors-text-text-primary)] text-lg">
        MCP & Skills
      </div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧标签导航 -->
      <div class="border border-r-solid border-[var(--colors-border-border-inactive)] px-6 pt-8 pb-6">
        <div class="w-[180px] flex flex-col gap-0.5">
          <div
            v-for="tab in tabs"
            :key="tab.key"
            class="w-full h-9 flex items-center px-3 py-1.5 rounded-1.5 text-left cursor-pointer transition-colors"
            :class="
              activeTab === tab.key
                ? 'bg-[var(--component-table-bg-selected)] border border-[var(--component-table-border-selected)]'
                : 'hover:bg-[var(--component-table-bg-selected)]'
            "
            @click="activeTab = tab.key"
          >
            <span class="font-['Archivo'] text-[16px] text-[var(--colors-text-text-primary)]">
              {{ tab.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- 右侧内容 -->
      <div class="flex-1 pt-8 px-10 pb-10">
        <McpSettings v-if="activeTab === 'mcp'" />
        <SkillsSettings v-else />
      </div>
    </div>
  </div>
</template>
